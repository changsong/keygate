package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/uptrace/bun"

	"github.com/tabloy/keygate/internal/model"
)

// ErrTenantMemberNotFound is returned when a team change names a user
// who is not a member of the tenant.
var ErrTenantMemberNotFound = errors.New("tenant member not found")

// CreateTenant inserts a workspace. The slug is stored lower-case; the
// migration's unique index is on lower(slug), so the caller gets the
// usual unique violation for a duplicate.
func (s *Store) CreateTenant(ctx context.Context, t *model.Tenant) error {
	if t.ID == "" {
		t.ID = newID()
	}
	t.Slug = strings.ToLower(strings.TrimSpace(t.Slug))
	t.Name = strings.TrimSpace(t.Name)
	if t.Status == "" {
		t.Status = model.TenantStatusActive
	}
	_, err := s.DB.NewInsert().Model(t).Exec(ctx)
	return err
}

func (s *Store) FindTenantByID(ctx context.Context, id string) (*model.Tenant, error) {
	t := new(model.Tenant)
	return t, s.DB.NewSelect().Model(t).Where("id = ?", id).Scan(ctx)
}

func (s *Store) FindTenantBySlug(ctx context.Context, slug string) (*model.Tenant, error) {
	t := new(model.Tenant)
	return t, s.DB.NewSelect().Model(t).Where("lower(slug) = ?", strings.ToLower(strings.TrimSpace(slug))).Scan(ctx)
}

// DefaultTenant is the workspace every request resolves to while
// TENANT_ENABLED is off, and the one pre-multi-tenant data belongs to.
func (s *Store) DefaultTenant(ctx context.Context) (*model.Tenant, error) {
	return s.FindTenantBySlug(ctx, model.DefaultTenantSlug)
}

func (s *Store) ListTenants(ctx context.Context) ([]*model.Tenant, error) {
	var out []*model.Tenant
	err := s.DB.NewSelect().Model(&out).Order("created_at ASC").Scan(ctx)
	return out, err
}

func (s *Store) CountTenants(ctx context.Context) (int, error) {
	return s.DB.NewSelect().Model((*model.Tenant)(nil)).Count(ctx)
}

// UpdateTenant changes the name and/or status of a tenant. Empty
// arguments leave that column alone; an id that matches no row returns
// sql.ErrNoRows.
func (s *Store) UpdateTenant(ctx context.Context, id, name, status string) error {
	q := s.DB.NewUpdate().Model((*model.Tenant)(nil)).
		Set("updated_at = now()").
		Where("id = ?", id)
	if name = strings.TrimSpace(name); name != "" {
		q = q.Set("name = ?", name)
	}
	if status != "" {
		q = q.Set("status = ?", status)
	}
	res, err := q.Exec(ctx)
	return deletedOne(res, err)
}

func (s *Store) AddTenantMember(ctx context.Context, tenantID, userID, role string) error {
	if !model.IsValidTenantRole(role) {
		return fmt.Errorf("invalid tenant role %q", role)
	}
	_, err := s.DB.NewInsert().Model(&model.TenantMember{
		TenantID: tenantID,
		UserID:   userID,
		Role:     role,
	}).On("CONFLICT (tenant_id, user_id) DO UPDATE").
		Set("role = EXCLUDED.role").
		Exec(ctx)
	return err
}

// EnsureTenantMember adds a member at the lowest role if the user has
// no membership yet, and leaves an existing role alone: an owner who
// happens to own a license must not be demoted to member by a claim.
func (s *Store) EnsureTenantMember(ctx context.Context, tenantID, userID string) error {
	_, err := s.DB.NewInsert().Model(&model.TenantMember{
		TenantID: tenantID,
		UserID:   userID,
		Role:     model.TenantRoleMember,
	}).On("CONFLICT (tenant_id, user_id) DO NOTHING").Exec(ctx)
	return err
}

func (s *Store) SetTenantMemberRole(ctx context.Context, tenantID, userID, role string) error {
	if !model.IsValidTenantRole(role) {
		return fmt.Errorf("invalid tenant role %q", role)
	}
	res, err := s.DB.NewUpdate().Model((*model.TenantMember)(nil)).
		Set("role = ?", role).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).Exec(ctx)
	return deletedOne(res, err)
}

func (s *Store) RemoveTenantMember(ctx context.Context, tenantID, userID string) error {
	res, err := s.DB.NewDelete().Model((*model.TenantMember)(nil)).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).Exec(ctx)
	return deletedOne(res, err)
}

func (s *Store) FindTenantMembership(ctx context.Context, tenantID, userID string) (*model.TenantMember, error) {
	m := new(model.TenantMember)
	return m, s.DB.NewSelect().Model(m).
		Where("tenant_id = ? AND user_id = ?", tenantID, userID).Scan(ctx)
}

// ListTenantMembers returns the members of a tenant with their global
// user row attached, so a console can show names without a second query
// per member.
func (s *Store) ListTenantMembers(ctx context.Context, tenantID string) ([]*model.TenantMember, error) {
	var out []*model.TenantMember
	err := s.DB.NewSelect().Model(&out).Relation("User").
		Where("tenant_id = ?", tenantID).
		Order("created_at ASC").
		Scan(ctx)
	return out, err
}

// ListTenantMembersPage is ListTenantMembers with the shared paging
// window.
func (s *Store) ListTenantMembersPage(ctx context.Context, tenantID string, p Page) ([]*model.TenantMember, int, error) {
	var out []*model.TenantMember
	q := s.DB.NewSelect().Model(&out).Relation("User").
		Where("tenant_id = ?", tenantID).
		Order("created_at ASC, user_id ASC")
	total, err := scanPage(ctx, q, p)
	if err != nil {
		return nil, 0, err
	}
	if p.Limit <= 0 {
		total = len(out)
	}
	return out, total, nil
}

// ListMembershipsForUser is what a signed-in account sees as its
// workspaces ("my spaces").
func (s *Store) ListMembershipsForUser(ctx context.Context, userID string) ([]*model.TenantMember, error) {
	var out []*model.TenantMember
	err := s.DB.NewSelect().Model(&out).Relation("Tenant").
		Where("user_id = ?", userID).
		Order("created_at ASC").
		Scan(ctx)
	return out, err
}

// TenantSummary is a tenant with the counts the platform console shows
// in its list.
type TenantSummary struct {
	ID           string    `bun:"id" json:"id"`
	Slug         string    `bun:"slug" json:"slug"`
	Name         string    `bun:"name" json:"name"`
	Status       string    `bun:"status" json:"status"`
	CreatedAt    time.Time `bun:"created_at" json:"created_at"`
	UpdatedAt    time.Time `bun:"updated_at" json:"updated_at"`
	MemberCount  int       `bun:"member_count" json:"member_count"`
	LicenseCount int       `bun:"license_count" json:"license_count"`
}

func (s *Store) ListTenantSummaries(ctx context.Context) ([]*TenantSummary, error) {
	var out []*TenantSummary
	err := s.DB.NewRaw(`
		SELECT t.id, t.slug, t.name, t.status, t.created_at, t.updated_at,
			(SELECT COUNT(*) FROM tenant_members m WHERE m.tenant_id = t.id) AS member_count,
			(SELECT COUNT(*) FROM licenses l WHERE l.tenant_id = t.id) AS license_count
		FROM tenants t
		ORDER BY t.created_at ASC, t.id ASC`).Scan(ctx, &out)
	return out, err
}

func (s *Store) CountTenantLicenses(ctx context.Context, tenantID string) (int, error) {
	return s.DB.NewSelect().Model((*model.License)(nil)).
		Where("tenant_id = ?", tenantID).Count(ctx)
}

// CreateTenantWithOwner creates a workspace and its first owner in one
// transaction. An owner address not seen before gets a placeholder
// global account; its name arrives on first sign-in.
func (s *Store) CreateTenantWithOwner(ctx context.Context, t *model.Tenant, ownerEmail string) (*model.User, error) {
	if t.ID == "" {
		t.ID = newID()
	}
	t.Slug = strings.ToLower(strings.TrimSpace(t.Slug))
	t.Name = strings.TrimSpace(t.Name)
	if t.Status == "" {
		t.Status = model.TenantStatusActive
	}
	ownerEmail = normalizeEmail(ownerEmail)
	var owner *model.User
	err := RunInTx(ctx, s.DB, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(t).Exec(ctx); err != nil {
			return err
		}
		// A brand new workspace starts with its own name, not the
		// platform's, until its owner changes it.
		if _, err := tx.NewRaw(`INSERT INTO settings (tenant_id, key, value) VALUES (?, 'site_name', ?)
			ON CONFLICT (tenant_id, key) DO NOTHING`, t.ID, t.Name).Exec(ctx); err != nil {
			return err
		}

		owner = new(model.User)
		err := tx.NewSelect().Model(owner).Where("email = ?", ownerEmail).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			u := &model.User{ID: newID(), Email: ownerEmail, Role: model.RoleUser}
			if _, err := tx.NewInsert().Model(u).On("CONFLICT (email) DO NOTHING").Exec(ctx); err != nil {
				return err
			}
			// Read back: a concurrent creation may have won the insert.
			err = tx.NewSelect().Model(owner).Where("email = ?", ownerEmail).Scan(ctx)
		}
		if err != nil {
			return err
		}
		_, err = tx.NewInsert().Model(&model.TenantMember{
			TenantID: t.ID, UserID: owner.ID, Role: model.TenantRoleOwner,
		}).On("CONFLICT (tenant_id, user_id) DO UPDATE").Set("role = EXCLUDED.role").Exec(ctx)
		return err
	})
	if err != nil {
		return nil, err
	}
	return owner, nil
}

func (s *Store) CountTenantMembers(ctx context.Context, tenantID string) (int, error) {
	return s.DB.NewSelect().Model((*model.TenantMember)(nil)).
		Where("tenant_id = ?", tenantID).Count(ctx)
}

func (s *Store) CountTenantOwners(ctx context.Context, tenantID string) (int, error) {
	return s.DB.NewSelect().Model((*model.TenantMember)(nil)).
		Where("tenant_id = ? AND role = ?", tenantID, model.TenantRoleOwner).Count(ctx)
}

// UpsertTenantMemberAtomic invites or re-roles a tenant member under the
// team lock. The actor must be the tenant's owner unless it is a
// platform admin; the target's current role is read under the same lock,
// so concurrent identical invites report a single change and two
// demotions cannot leave the tenant with no owner. It returns the role
// held before, whether the membership row was created, and whether
// anything changed.
func (s *Store) UpsertTenantMemberAtomic(ctx context.Context, tenantID, actorID, targetUserID, role string, platformAdmin bool) (previous string, created, changed bool, err error) {
	if !model.IsValidTenantRole(role) {
		return "", false, false, fmt.Errorf("invalid tenant role %q", role)
	}
	err = s.WithXactLock(ctx, TeamLockKey, func(ctx context.Context, tx bun.Tx) error {
		if !platformAdmin {
			var actorRole string
			err := tx.NewRaw("SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?", tenantID, actorID).Scan(ctx, &actorRole)
			if errors.Is(err, sql.ErrNoRows) || (err == nil && actorRole != model.TenantRoleOwner) {
				return ErrNotOwner
			}
			if err != nil {
				return err
			}
		}

		err := tx.NewRaw("SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?", tenantID, targetUserID).Scan(ctx, &previous)
		if errors.Is(err, sql.ErrNoRows) {
			_, err = tx.NewInsert().Model(&model.TenantMember{
				TenantID: tenantID, UserID: targetUserID, Role: role,
			}).Exec(ctx)
			if err == nil {
				created, changed = true, true
			}
			return err
		}
		if err != nil {
			return err
		}
		if previous == role {
			return nil
		}
		if previous == model.TenantRoleOwner {
			var owners int
			if err := tx.NewRaw("SELECT COUNT(*) FROM tenant_members WHERE tenant_id = ? AND role = ?", tenantID, model.TenantRoleOwner).Scan(ctx, &owners); err != nil {
				return err
			}
			if owners <= 1 {
				return ErrLastOwner
			}
		}
		if _, err := tx.NewRaw("UPDATE tenant_members SET role = ? WHERE tenant_id = ? AND user_id = ?", role, tenantID, targetUserID).Exec(ctx); err != nil {
			return err
		}
		changed = true
		return nil
	})
	if err != nil {
		return "", false, false, err
	}
	return previous, created, changed, nil
}

// RemoveTenantMemberAtomic removes a membership under the team lock,
// refusing to take the last owner away. Only an owner (or a platform
// admin) may do it.
func (s *Store) RemoveTenantMemberAtomic(ctx context.Context, tenantID, actorID, targetUserID string, platformAdmin bool) (previous string, changed bool, err error) {
	err = s.WithXactLock(ctx, TeamLockKey, func(ctx context.Context, tx bun.Tx) error {
		if !platformAdmin {
			var actorRole string
			err := tx.NewRaw("SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?", tenantID, actorID).Scan(ctx, &actorRole)
			if errors.Is(err, sql.ErrNoRows) || (err == nil && actorRole != model.TenantRoleOwner) {
				return ErrNotOwner
			}
			if err != nil {
				return err
			}
		}
		err := tx.NewRaw("SELECT role FROM tenant_members WHERE tenant_id = ? AND user_id = ?", tenantID, targetUserID).Scan(ctx, &previous)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrTenantMemberNotFound
		}
		if err != nil {
			return err
		}
		if previous == model.TenantRoleOwner {
			var owners int
			if err := tx.NewRaw("SELECT COUNT(*) FROM tenant_members WHERE tenant_id = ? AND role = ?", tenantID, model.TenantRoleOwner).Scan(ctx, &owners); err != nil {
				return err
			}
			if owners <= 1 {
				return ErrLastOwner
			}
		}
		if _, err := tx.NewRaw("DELETE FROM tenant_members WHERE tenant_id = ? AND user_id = ?", tenantID, targetUserID).Exec(ctx); err != nil {
			return err
		}
		changed = true
		return nil
	})
	if err != nil {
		return "", false, err
	}
	return previous, changed, nil
}

// seedDefaultTenant makes sure the migration's default tenant exists on
// an install whose schema predates it (or where the row was removed).
// Setup and tests call it before writing default-tenant rows.
func (s *Store) seedDefaultTenant(ctx context.Context) (*model.Tenant, error) {
	t, err := s.DefaultTenant(ctx)
	if err == nil {
		return t, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	t = &model.Tenant{ID: model.DefaultTenantID, Slug: model.DefaultTenantSlug, Name: "Default"}
	if err := s.CreateTenant(ctx, t); err != nil {
		if isUniqueViolation(err) {
			return s.DefaultTenant(ctx)
		}
		return nil, err
	}
	return t, nil
}
