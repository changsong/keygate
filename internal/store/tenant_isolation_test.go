package store_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/tabloy/keygate/internal/model"
)

// A licence lives in exactly one workspace. The same address can hold a
// licence in two of them; each workspace's portal list returns only its
// own, and a licence id from the other workspace is not found rather
// than readable.
func TestLicensesAreIsolatedByTenant(t *testing.T) {
	s := setupTestDB(t)
	defer s.Close()
	ctx := context.Background()
	suffix := time.Now().UnixNano()

	mkTenant := func(slug string) *model.Tenant {
		t.Helper()
		tn := &model.Tenant{Slug: fmt.Sprintf("iso-%s-%d", slug, suffix), Name: slug}
		if err := s.CreateTenant(ctx, tn); err != nil {
			t.Fatalf("create tenant %s: %v", slug, err)
		}
		t.Cleanup(func() {
			_, _ = s.DB.NewRaw("DELETE FROM licenses WHERE tenant_id = ?", tn.ID).Exec(ctx)
			_, _ = s.DB.NewRaw("DELETE FROM products WHERE tenant_id = ?", tn.ID).Exec(ctx)
			_, _ = s.DB.NewRaw("DELETE FROM tenants WHERE id = ?", tn.ID).Exec(ctx)
		})
		return tn
	}
	a := mkTenant("a")
	b := mkTenant("b")

	mkLicense := func(tn *model.Tenant, email, key string) *model.License {
		t.Helper()
		p := &model.Product{
			Name: "Product " + tn.Slug, Slug: "p-" + tn.Slug,
			Type: "saas", TenantID: tn.ID,
		}
		if err := s.CreateProduct(ctx, p); err != nil {
			t.Fatalf("create product in %s: %v", tn.Slug, err)
		}
		l := &model.License{
			ProductID: p.ID, Email: email, LicenseKey: key,
			Status: "active", TenantID: tn.ID,
		}
		if err := s.CreateLicense(ctx, l); err != nil {
			t.Fatalf("create license in %s: %v", tn.Slug, err)
		}
		return l
	}
	const email = "shared@example.com"
	la := mkLicense(a, email, fmt.Sprintf("ISO-A-%d", suffix))
	lb := mkLicense(b, email, fmt.Sprintf("ISO-B-%d", suffix))

	for _, tc := range []struct {
		name string
		tn   *model.Tenant
		want *model.License
	}{{"a", a, la}, {"b", b, lb}} {
		got, err := s.ListLicensesByEmailIn(ctx, tc.tn.ID, "", email)
		if err != nil {
			t.Fatalf("%s list: %v", tc.name, err)
		}
		if len(got) != 1 || got[0].ID != tc.want.ID {
			t.Errorf("%s sees %d licenses (%v), want only %s", tc.name, len(got), ids(got), tc.want.ID)
		}
	}

	// A licence id named across workspaces is not found.
	if _, err := s.FindLicenseForTenant(ctx, a.ID, lb.ID); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("acme lookup of globex licence: %v, want sql.ErrNoRows", err)
	}
	if got, err := s.FindLicenseForTenant(ctx, b.ID, lb.ID); err != nil || got.ID != lb.ID {
		t.Errorf("globex lookup of its own licence: %+v, %v", got, err)
	}

	// Same for the assets probe a sign-in uses to decide membership.
	holds, err := s.UserHoldsTenantAssets(ctx, a.ID, "", email)
	if err != nil || !holds {
		t.Errorf("user holds assets in a: %v, %v", holds, err)
	}
	holds, err = s.UserHoldsTenantAssets(ctx, a.ID, "", "nobody@example.com")
	if err != nil || holds {
		t.Errorf("stranger holds assets in a: %v, %v", holds, err)
	}
}

func ids(licenses []*model.License) []string {
	out := make([]string, 0, len(licenses))
	for _, l := range licenses {
		out = append(out, l.ID)
	}
	return out
}
