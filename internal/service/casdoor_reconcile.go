package service

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"time"

	"github.com/tabloy/keygate/internal/casdoor"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
)

const (
	// casdoorReconcileLockKey serialises the pass across replicas so two
	// instances do not page the same organization at once.
	casdoorReconcileLockKey  int64 = 20261103
	casdoorReconcilePageSize       = 100
	casdoorReconcileInterval       = 24 * time.Hour
	casdoorReconcileMaxPages       = 1000
	// casdoorProvider is the provider key used for every Casdoor link.
	casdoorProvider = "casdoor"
)

// CasdoorReconciler repairs identity links the event-driven paths
// missed: a user whose webhook was dropped, or whose licence arrived
// after they signed in. It never creates an account — reconciliation is
// not a sign-up — and only binds licences and seats that are unowned,
// exactly as an interactive login would.
type CasdoorReconciler struct {
	client   *casdoor.Client
	store    *store.Store
	identity *IdentityService
	org      string
	logger   *slog.Logger
}

func NewCasdoorReconciler(client *casdoor.Client, st *store.Store, identity *IdentityService, org string, logger *slog.Logger) *CasdoorReconciler {
	if logger == nil {
		logger = slog.Default()
	}
	return &CasdoorReconciler{client: client, store: st, identity: identity, org: org, logger: logger}
}

// Start runs a pass immediately, then once a day with up to an hour of
// jitter so replicas started together do not converge on one instant.
func (r *CasdoorReconciler) Start(ctx context.Context) {
	go func() {
		r.RunOnce(ctx)
		for {
			jitter := time.Duration(rand.Int64N(int64(time.Hour)))
			select {
			case <-ctx.Done():
				return
			case <-time.After(casdoorReconcileInterval + jitter):
				r.RunOnce(ctx)
			}
		}
	}()
}

// RunOnce takes the cross-replica lock and runs one pass. A pass another
// replica is already running is skipped by waiting for the lock; the
// caller's context still aborts a shutdown.
func (r *CasdoorReconciler) RunOnce(ctx context.Context) {
	err := r.store.WithAdvisoryLock(ctx, casdoorReconcileLockKey, r.reconcile)
	if err != nil && !errors.Is(err, context.Canceled) {
		r.logger.Error("casdoor reconcile: pass failed", "error", err)
	}
}

func (r *CasdoorReconciler) reconcile(ctx context.Context) error {
	var scanned, verified, linked, skipped int
	for page := 1; page <= casdoorReconcileMaxPages; page++ {
		users, err := r.client.ListUsers(ctx, r.org, page, casdoorReconcilePageSize)
		if err != nil {
			return err
		}
		scanned += len(users)
		for _, u := range users {
			subject, email, name, avatar, verifiedFlag := u.ProviderIdentity()
			if !verifiedFlag || email == "" || subject == "" {
				skipped++
				continue
			}
			verified++
			_, outcome, err := r.identity.Resolve(ctx, ProviderIdentity{
				Provider: casdoorProvider, Subject: subject, Email: email,
				Name: name, AvatarURL: avatar, EmailVerified: true,
			}, ResolveOptions{AllowCreate: false, ActorType: "system"})
			switch {
			case err == nil:
				if outcome != store.LinkIdentityLogin {
					linked++
				}
			case errors.Is(err, store.ErrAccountNotAllowed),
				errors.Is(err, store.ErrIdentityConflict),
				errors.Is(err, store.ErrEmailNotVerified):
				// An address Keygate has no account for, or one whose
				// subject is held by a different Casdoor identity. A
				// retry will not change either; an operator decides.
				skipped++
			default:
				return err
			}
		}
		if len(users) < casdoorReconcilePageSize {
			break
		}
	}

	if scanned > 0 {
		r.store.Audit(ctx, &model.AuditLog{
			Entity: "identity", EntityID: "casdoor_reconcile", Action: "casdoor_reconcile",
			ActorType: "system",
			Changes: map[string]any{
				"scanned": scanned, "verified": verified,
				"linked": linked, "skipped": skipped,
			},
		})
	}
	r.logger.Info("casdoor reconcile: pass done",
		"scanned", scanned, "verified", verified, "linked", linked, "skipped", skipped)
	return nil
}
