package store_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/testsupport"
)

// The migration seeds the default tenant and puts existing users in
// it; an install that never turns tenancy on lives there.
func TestDefaultTenantSeeded(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()
	ctx := context.Background()

	bySlug, err := s.FindTenantBySlug(ctx, model.DefaultTenantSlug)
	if err != nil {
		t.Fatalf("default tenant by slug: %v", err)
	}
	if bySlug.ID != model.DefaultTenantID {
		t.Errorf("default tenant id %q, want %q", bySlug.ID, model.DefaultTenantID)
	}
	byID, err := s.FindTenantByID(ctx, model.DefaultTenantID)
	if err != nil || byID.Slug != model.DefaultTenantSlug {
		t.Fatalf("default tenant by id: %+v, %v", byID, err)
	}
	if !byID.IsActive() {
		t.Errorf("default tenant status %q, want active", byID.Status)
	}
}

func TestTenantMembership(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()
	ctx := context.Background()

	suffix := time.Now().UnixNano()
	tenant := &model.Tenant{Slug: fmt.Sprintf("acme-%d", suffix), Name: "Acme"}
	if err := s.CreateTenant(ctx, tenant); err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	t.Cleanup(func() {
		_, _ = s.DB.NewRaw("DELETE FROM tenant_members WHERE tenant_id = ?", tenant.ID).Exec(ctx)
		_, _ = s.DB.NewRaw("DELETE FROM tenants WHERE id = ?", tenant.ID).Exec(ctx)
	})
	if tenant.ID == "" {
		t.Fatal("CreateTenant left the id empty")
	}

	user := &model.User{Email: fmt.Sprintf("member-%d@example.com", suffix), Name: "M", Role: "user"}
	if err := s.UpsertUser(ctx, user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() { _, _ = s.DB.NewRaw("DELETE FROM users WHERE id = ?", user.ID).Exec(ctx) })

	if _, err := s.FindTenantMembership(ctx, tenant.ID, user.ID); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("membership before insert: %v, want ErrNoRows", err)
	}
	if err := s.AddTenantMember(ctx, tenant.ID, user.ID, model.TenantRoleOwner); err != nil {
		t.Fatalf("add member: %v", err)
	}
	// EnsureTenantMember must not demote an owner.
	if err := s.EnsureTenantMember(ctx, tenant.ID, user.ID); err != nil {
		t.Fatalf("ensure member: %v", err)
	}
	m, err := s.FindTenantMembership(ctx, tenant.ID, user.ID)
	if err != nil || m.Role != model.TenantRoleOwner {
		t.Fatalf("membership: %+v, %v", m, err)
	}
	members, err := s.ListTenantMembers(ctx, tenant.ID)
	if err != nil || len(members) != 1 || members[0].User == nil || members[0].User.ID != user.ID {
		t.Fatalf("list members: %+v, %v", members, err)
	}
	if owners, err := s.CountTenantOwners(ctx, tenant.ID); err != nil || owners != 1 {
		t.Errorf("owners: %d, %v", owners, err)
	}

	if err := s.SetTenantMemberRole(ctx, tenant.ID, user.ID, model.TenantRoleAdmin); err != nil {
		t.Fatalf("set role: %v", err)
	}
	if m, _ := s.FindTenantMembership(ctx, tenant.ID, user.ID); m.Role != model.TenantRoleAdmin {
		t.Errorf("role after update: %q", m.Role)
	}
	if err := s.SetTenantMemberRole(ctx, tenant.ID, user.ID, "superuser"); err == nil {
		t.Error("an invalid tenant role was accepted")
	}

	spaces, err := s.ListMembershipsForUser(ctx, user.ID)
	if err != nil || len(spaces) != 1 || spaces[0].Tenant == nil || spaces[0].Tenant.ID != tenant.ID {
		t.Fatalf("memberships for user: %+v, %v", spaces, err)
	}

	if err := s.RemoveTenantMember(ctx, tenant.ID, user.ID); err != nil {
		t.Fatalf("remove member: %v", err)
	}
	if err := s.RemoveTenantMember(ctx, tenant.ID, user.ID); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("second remove: %v, want ErrNoRows", err)
	}
}

func TestTenantSettingsOverride(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()
	ctx := context.Background()
	testsupport.LockSettings(t, s.DB)

	slug := fmt.Sprintf("brand-%d", time.Now().UnixNano())
	tenant := &model.Tenant{Slug: slug, Name: "Brand"}
	if err := s.CreateTenant(ctx, tenant); err != nil {
		t.Fatalf("create tenant: %v", err)
	}

	if err := s.SetSettingForTenant(ctx, tenant.ID, "site_name", "Tenant Brand"); err != nil {
		t.Fatalf("set tenant setting: %v", err)
	}
	if got, err := s.GetSettingForTenant(ctx, tenant.ID, "site_name"); err != nil || got != "Tenant Brand" {
		t.Errorf("tenant override = %q, %v", got, err)
	}
	if got, err := s.GetSettingForTenant(ctx, model.DefaultTenantID, "site_name"); err != nil {
		t.Fatal(err)
	} else if got == "Tenant Brand" {
		t.Error("the tenant override leaked into another workspace")
	}
	if got, err := s.GetSettingForTenant(ctx, tenant.ID, "brand_color"); err != nil || got != "" {
		t.Errorf("unset key = %q, %v, want empty", got, err)
	}
	public, err := s.GetPublicSettingsForTenant(ctx, tenant.ID)
	if err != nil || public["site_name"] != "Tenant Brand" {
		t.Errorf("public settings = %v, %v", public, err)
	}
}
