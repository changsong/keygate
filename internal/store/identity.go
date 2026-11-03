package store

import (
	"context"
	"database/sql"
	"errors"

	"github.com/uptrace/bun"

	"github.com/tabloy/keygate/internal/model"
)

// identityLockSeed namespaces advisory locks that serialise identity
// linking per email, so two logins for one address cannot both create
// the user row or bind the same licenses.
const identityLockSeed int64 = 0x6b676964656e74 // "kgident"

var (
	// ErrEmailNotVerified means the provider did not vouch for the
	// address, so it may not be used to match an account or license.
	ErrEmailNotVerified = errors.New("provider email is not verified")
	// ErrIdentityConflict means this Keygate account already has a
	// different identity for the same provider. An administrator must
	// unlink it; silently rebinding would hand the account to whoever
	// holds the newer identity.
	ErrIdentityConflict = errors.New("account is linked to a different identity")
	// ErrAccountNotAllowed means no Keygate account or license exists for
	// the address and sign-ups are closed.
	ErrAccountNotAllowed = errors.New("no account or license for this email")
	// ErrLicenseAlreadyClaimed means another account bound the licence
	// first; only an administrator may reassign it.
	ErrLicenseAlreadyClaimed = errors.New("license is already claimed by another account")
)

// ClaimLicense binds an unowned licence to userID. claimed is true when
// this call made the binding; false with no error when the same user
// already held it (an idempotent retry), and ErrLicenseAlreadyClaimed
// when someone else did. The guarded UPDATE never overwrites an existing
// binding.
func (s *Store) ClaimLicense(ctx context.Context, licenseID, userID string) (claimed bool, err error) {
	res, err := s.DB.NewUpdate().Model((*model.License)(nil)).
		Set("user_id = ?", userID).
		Set("updated_at = now()").
		Where("id = ? AND user_id IS NULL", licenseID).
		Exec(ctx)
	if err != nil {
		return false, err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		return true, nil
	}
	var current sql.NullString
	err = s.DB.NewSelect().Model((*model.License)(nil)).
		Column("user_id").
		Where("id = ?", licenseID).
		Scan(ctx, &current)
	if err != nil {
		return false, err
	}
	if current.String == userID {
		return false, nil
	}
	return false, ErrLicenseAlreadyClaimed
}

// BindLicenseOwner binds userID to the licence and reports the binding
// it found ("" when unbound), for the audit trail. Unless override it
// only binds an unowned licence or one already held by userID, so a
// support action never takes a customer's licence by accident; a
// conflict leaves the row untouched. The address on the licence is not
// changed — it stays the billing contact whatever the account is.
func (s *Store) BindLicenseOwner(ctx context.Context, licenseID, userID string, override bool) (previous string, err error) {
	var prev sql.NullString
	if err := s.DB.NewSelect().Model((*model.License)(nil)).
		Column("user_id").
		Where("id = ?", licenseID).
		Scan(ctx, &prev); err != nil {
		return "", err
	}
	q := s.DB.NewUpdate().Model((*model.License)(nil)).
		Set("user_id = ?", userID).
		Set("updated_at = now()").
		Where("id = ?", licenseID)
	if !override {
		q = q.Where("(user_id IS NULL OR user_id = ?)", userID)
	}
	res, err := q.Exec(ctx)
	if err != nil {
		return prev.String, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return prev.String, ErrLicenseAlreadyClaimed
	}
	return prev.String, nil
}

// BindSeatIdentity binds an accepted seat to userID, so the member's
// access follows the account rather than the address. Only an unbound
// seat moves: an administrator's explicit binding is never overwritten.
func (s *Store) BindSeatIdentity(ctx context.Context, seatID, userID string) error {
	_, err := s.DB.NewUpdate().Model((*model.Seat)(nil)).
		Set("user_id = ?", userID).
		Where("id = ? AND user_id IS NULL AND removed_at IS NULL AND accepted_at IS NOT NULL", seatID).
		Exec(ctx)
	return err
}

// LinkIdentityOutcome says how an identity resolved.
type LinkIdentityOutcome string

const (
	// LinkIdentityLogin: the provider subject was already linked.
	LinkIdentityLogin LinkIdentityOutcome = "login"
	// LinkIdentityLinked: an existing account was found by email and
	// linked to the provider subject.
	LinkIdentityLinked LinkIdentityOutcome = "linked"
	// LinkIdentityCreated: a new account was created.
	LinkIdentityCreated LinkIdentityOutcome = "created"
)

type LinkIdentityParams struct {
	Provider      string
	ProviderID    string
	Email         string
	Name          string
	AvatarURL     string
	EmailVerified bool
	AllowCreate   bool
	// TenantID, when set, narrows the binding to one workspace: a
	// sign-in through a tenant's host must not take an unowned licence
	// that happens to carry the same address in another tenant. Empty
	// keeps the platform-wide binding the Casdoor webhook and the daily
	// reconciliation rely on.
	TenantID string
}

// LinkIdentity resolves a provider identity to a Keygate user, creating
// or linking as needed, and binds every unowned license and seat that
// carries the verified address. One transaction under a per-email
// advisory lock means concurrent logins for the same address cannot
// create duplicate users or miss a binding; the unique indexes
// (provider, provider_id) and (user_id, provider) back it up.
func (s *Store) LinkIdentity(ctx context.Context, p LinkIdentityParams) (*model.User, LinkIdentityOutcome, error) {
	email := normalizeEmail(p.Email)
	if email == "" {
		return nil, "", ErrEmailNotVerified
	}

	var (
		user    *model.User
		outcome LinkIdentityOutcome
	)
	err := s.WithXactLock(ctx, identityLockSeed^stringHash(email), func(ctx context.Context, tx bun.Tx) error {
		// 1. A known subject logs in regardless of what the address
		// says now: the link is the proof, not the email.
		linked := new(model.OAuthAccount)
		err := tx.NewSelect().Model(linked).
			Where("provider = ? AND provider_id = ?", p.Provider, p.ProviderID).
			Scan(ctx)
		if err == nil {
			user = new(model.User)
			if err := tx.NewSelect().Model(user).Where("id = ?", linked.UserID).Scan(ctx); err != nil {
				return err
			}
			outcome = LinkIdentityLogin
			if p.EmailVerified {
				return bindUnownedIdentity(ctx, tx, user.ID, email, p.TenantID)
			}
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		// 2. An unverified address may not match an account or license.
		if !p.EmailVerified {
			return ErrEmailNotVerified
		}

		// 3. Existing account by email: link, unless it already holds a
		// different subject for this provider (refuse; admin resolves).
		user = new(model.User)
		err = tx.NewSelect().Model(user).Where("email = ?", email).Scan(ctx)
		switch {
		case err == nil:
			outcome = LinkIdentityLinked
		case errors.Is(err, sql.ErrNoRows):
			if !p.AllowCreate {
				return ErrAccountNotAllowed
			}
			user = &model.User{ID: newID(), Email: email, Name: p.Name, AvatarURL: p.AvatarURL}
			// OTP login may create the same row concurrently outside this
			// lock; DO NOTHING then re-read so both paths share one user.
			res, err := tx.NewInsert().Model(user).On("CONFLICT (email) DO NOTHING").Exec(ctx)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 0 {
				if err := tx.NewSelect().Model(user).Where("email = ?", email).Scan(ctx); err != nil {
					return err
				}
				outcome = LinkIdentityLinked
			} else {
				outcome = LinkIdentityCreated
			}
		default:
			return err
		}

		// 4. One identity per provider per account. The unique index
		// added in 20261103 backs this up; checking first produces a
		// clear conflict instead of a constraint error.
		existing := new(model.OAuthAccount)
		err = tx.NewSelect().Model(existing).
			Where("user_id = ? AND provider = ?", user.ID, p.Provider).
			Scan(ctx)
		switch {
		case err == nil && existing.ProviderID != p.ProviderID:
			return ErrIdentityConflict
		case err == nil:
			// Same subject already linked to this user through another
			// email; keep the link and continue.
		case errors.Is(err, sql.ErrNoRows):
			link := &model.OAuthAccount{
				ID: newID(), UserID: user.ID, Provider: p.Provider,
				ProviderID: p.ProviderID, Email: email,
			}
			if _, err := tx.NewInsert().Model(link).
				On("CONFLICT (provider, provider_id) DO NOTHING").Exec(ctx); err != nil {
				return err
			}
		default:
			return err
		}

		// The subject may have been linked to another account between
		// the select and the insert; the unique key kept us honest, so
		// re-read and report the conflict rather than pretending.
		actual := new(model.OAuthAccount)
		if err := tx.NewSelect().Model(actual).
			Where("provider = ? AND provider_id = ?", p.Provider, p.ProviderID).
			Scan(ctx); err != nil {
			return err
		}
		if actual.UserID != user.ID {
			return ErrIdentityConflict
		}
		return bindUnownedIdentity(ctx, tx, user.ID, email, p.TenantID)
	})
	if err != nil {
		return nil, "", err
	}
	return user, outcome, nil
}

// bindUnownedIdentity attaches every unowned license and accepted seat
// that carries email to userID. Only rows with user_id NULL move: an
// administrator's explicit binding is never overwritten by a login.
// A non-empty tenantID confines the binding to that workspace, so a
// sign-in through one tenant's host never reaches into another's.
func bindUnownedIdentity(ctx context.Context, tx bun.Tx, userID, email, tenantID string) error {
	if tenantID != "" {
		if _, err := tx.NewRaw(`
			UPDATE licenses SET user_id = ?, updated_at = now()
			WHERE tenant_id = ? AND user_id IS NULL AND lower(email) = ?`,
			userID, tenantID, email).Exec(ctx); err != nil {
			return err
		}
		_, err := tx.NewRaw(`
			UPDATE seats SET user_id = ?
			WHERE tenant_id = ?
			  AND user_id IS NULL
			  AND removed_at IS NULL
			  AND accepted_at IS NOT NULL
			  AND lower(email) = ?`,
			userID, tenantID, email).Exec(ctx)
		return err
	}
	if _, err := tx.NewRaw(`
		UPDATE licenses SET user_id = ?, updated_at = now()
		WHERE user_id IS NULL AND lower(email) = ?`,
		userID, email).Exec(ctx); err != nil {
		return err
	}
	_, err := tx.NewRaw(`
		UPDATE seats SET user_id = ?
		WHERE user_id IS NULL
		  AND removed_at IS NULL
		  AND accepted_at IS NOT NULL
		  AND lower(email) = ?`,
		userID, email).Exec(ctx)
	return err
}

// UserHoldsTenantAssets reports whether the account holds a licence or
// an accepted seat in the workspace, bound to it already or still
// carrying its address unbound. A sign-in that lands on one of them
// earns the lowest membership; nothing else does.
func (s *Store) UserHoldsTenantAssets(ctx context.Context, tenantID, userID, email string) (bool, error) {
	e := normalizeEmail(email)
	var exists bool
	err := s.DB.NewRaw(`SELECT EXISTS (
		SELECT 1 FROM licenses
		WHERE tenant_id = ? AND (user_id = ? OR (user_id IS NULL AND lower(email) = ?))
		UNION ALL
		SELECT 1 FROM seats
		WHERE tenant_id = ? AND removed_at IS NULL AND accepted_at IS NOT NULL
		  AND (user_id = ? OR (user_id IS NULL AND lower(email) = ?))
	)`, tenantID, userID, e, tenantID, userID, e).Scan(ctx, &exists)
	return exists, err
}
