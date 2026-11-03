package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
)

func testUser(t *testing.T, s *store.Store, ctx context.Context, prefix string) *model.User {
	t.Helper()
	u := &model.User{Email: prefix + "-" + time.Now().Format("150405.000000000") + "@example.com"}
	if err := s.UpsertUser(ctx, u); err != nil {
		t.Fatalf("create user: %v", err)
	}
	found, err := s.FindUserByEmail(ctx, u.Email)
	if err != nil {
		t.Fatalf("find user: %v", err)
	}
	return found
}

// A claim moves an unowned licence once: the same account retrying is
// idempotent, and another account is refused without the row changing.
func TestClaimLicense_GuardedAndIdempotent(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()
	ctx := context.Background()
	lic := createTestLicense(t, s, ctx)
	alice := testUser(t, s, ctx, "claim-alice")
	bob := testUser(t, s, ctx, "claim-bob")

	claimed, err := s.ClaimLicense(ctx, lic.ID, alice.ID)
	if err != nil || !claimed {
		t.Fatalf("first claim: claimed=%v err=%v", claimed, err)
	}
	claimed, err = s.ClaimLicense(ctx, lic.ID, alice.ID)
	if err != nil || claimed {
		t.Fatalf("retry by same account: claimed=%v err=%v, want false,nil", claimed, err)
	}
	claimed, err = s.ClaimLicense(ctx, lic.ID, bob.ID)
	if !errors.Is(err, store.ErrLicenseAlreadyClaimed) || claimed {
		t.Fatalf("other account: claimed=%v err=%v, want false,ErrLicenseAlreadyClaimed", claimed, err)
	}
	got, err := s.FindLicenseByID(ctx, lic.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.UserID != alice.ID {
		t.Fatalf("user_id = %q, want %q", got.UserID, alice.ID)
	}
}

// A guarded bind never takes a licence from its holder; the override
// does, and reports who held it for the audit trail.
func TestBindLicenseOwner_GuardedThenOverride(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()
	ctx := context.Background()
	lic := createTestLicense(t, s, ctx)
	alice := testUser(t, s, ctx, "bind-alice")
	bob := testUser(t, s, ctx, "bind-bob")

	prev, err := s.BindLicenseOwner(ctx, lic.ID, alice.ID, false)
	if err != nil || prev != "" {
		t.Fatalf("bind unowned: prev=%q err=%v", prev, err)
	}
	prev, err = s.BindLicenseOwner(ctx, lic.ID, bob.ID, false)
	if !errors.Is(err, store.ErrLicenseAlreadyClaimed) || prev != alice.ID {
		t.Fatalf("guarded rebind: prev=%q err=%v, want %q,ErrLicenseAlreadyClaimed", prev, err, alice.ID)
	}
	prev, err = s.BindLicenseOwner(ctx, lic.ID, bob.ID, true)
	if err != nil || prev != alice.ID {
		t.Fatalf("override: prev=%q err=%v, want %q", prev, err, alice.ID)
	}
	got, err := s.FindLicenseByID(ctx, lic.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.UserID != bob.ID {
		t.Fatalf("user_id = %q, want %q", got.UserID, bob.ID)
	}
}
