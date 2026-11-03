package service

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
)

// ProviderIdentity is a verified identity from an external provider.
// Subject is the provider's stable user identifier (the OIDC `sub`),
// never the email: an address can change, a subject cannot.
type ProviderIdentity struct {
	Provider      string
	Subject       string
	Email         string
	Name          string
	AvatarURL     string
	EmailVerified bool
}

type ResolveOptions struct {
	// AllowCreate lets an unknown address become a new Keygate account.
	// Interactive sign-up and the provider's own "new user" events set
	// it; webhook logins and reconciliation do not.
	AllowCreate bool
	// ActorType is recorded in the audit row ("casdoor", "casdoor_webhook",
	// "system", ...).
	ActorType string
	IP        string
	// TenantID, when set, confines the licence/seat binding to the
	// workspace the person signed in through. Empty keeps the
	// platform-wide binding the webhook and reconciliation use.
	TenantID string
}

// IdentityService resolves Casdoor subjects to Keygate users and keeps
// the audit trail. Token handling stays in the handler; this layer only
// ever sees claims.
type IdentityService struct {
	store  *store.Store
	logger *slog.Logger
}

func NewIdentityService(s *store.Store, logger *slog.Logger) *IdentityService {
	return &IdentityService{store: s, logger: logger}
}

// Resolve links or creates the account and binds unowned licenses and
// seats. It returns the provider-level errors unchanged so callers can
// map them to their own status codes.
func (s *IdentityService) Resolve(ctx context.Context, id ProviderIdentity, opts ResolveOptions) (*model.User, store.LinkIdentityOutcome, error) {
	user, outcome, err := s.store.LinkIdentity(ctx, store.LinkIdentityParams{
		Provider:      id.Provider,
		ProviderID:    id.Subject,
		Email:         id.Email,
		Name:          id.Name,
		AvatarURL:     id.AvatarURL,
		EmailVerified: id.EmailVerified,
		AllowCreate:   opts.AllowCreate,
		TenantID:      opts.TenantID,
	})
	if err != nil {
		return nil, "", err
	}

	action := "casdoor_login"
	switch outcome {
	case store.LinkIdentityCreated:
		action = "casdoor_create"
	case store.LinkIdentityLinked:
		action = "casdoor_link"
	}
	actorType := opts.ActorType
	if actorType == "" {
		actorType = "casdoor"
	}
	s.store.Audit(ctx, &model.AuditLog{
		Entity: "identity", EntityID: user.ID, Action: action,
		ActorType: actorType, ActorID: user.ID, IPAddress: opts.IP, TenantID: opts.TenantID,
		Changes: map[string]any{
			"provider": id.Provider, "provider_id": id.Subject, "outcome": string(outcome),
		},
	})
	s.logger.Info("identity resolved", "provider", id.Provider, "user_id", user.ID, "outcome", outcome)
	return user, outcome, nil
}

// SignupAllowed reports whether an unknown address may create an
// account, matching the OTP sign-up gate: the default is open, and
// signup_mode=licensed_only requires an existing membership or license
// in the workspace the person is signing in to. An empty tenantID asks
// the platform-wide question, for the platform console and the
// webhook. A lookup that cannot run fails closed.
func (s *IdentityService) SignupAllowed(ctx context.Context, tenantID, email string) bool {
	mode, err := s.store.GetSettingForTenant(ctx, tenantID, "signup_mode")
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			s.logger.Error("signup gate: reading signup_mode failed", "error", err)
			return false
		}
		return true
	}
	if strings.TrimSpace(mode) != "licensed_only" {
		return true
	}
	known, err := s.store.HasAccountOrLicenseIn(ctx, tenantID, email)
	if err != nil {
		s.logger.Error("signup gate lookup failed", "email", email, "error", err)
		return false
	}
	return known
}
