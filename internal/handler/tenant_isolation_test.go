package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
)

// Each admin list is scoped to the workspace in the request: a row
// created in one workspace never appears in another's catalogue,
// licence list, key list or audit trail, even though both workspaces
// hold a copy of every entity kind.
func TestAdminListsAreTenantScoped(t *testing.T) {
	s := scratchStore(t)
	ctx := t.Context()
	gin.SetMode(gin.TestMode)
	h := &AdminHandler{Store: s}

	type fixture struct {
		tenant *model.Tenant
		prod   *model.Product
		lic    *model.License
		key    *model.APIKey
	}
	mk := func(slug string) fixture {
		t.Helper()
		tn := &model.Tenant{Slug: slug, Name: slug}
		if err := s.CreateTenant(ctx, tn); err != nil {
			t.Fatalf("create tenant %s: %v", slug, err)
		}
		p := &model.Product{Name: slug, Slug: slug + "-product", Type: "saas", TenantID: tn.ID}
		if err := s.CreateProduct(ctx, p); err != nil {
			t.Fatalf("create product in %s: %v", slug, err)
		}
		l := &model.License{
			ProductID: p.ID, Email: slug + "@example.com", LicenseKey: "KEY-" + slug,
			Status: "active", TenantID: tn.ID,
		}
		if err := s.CreateLicense(ctx, l); err != nil {
			t.Fatalf("create license in %s: %v", slug, err)
		}
		ak := &model.APIKey{TenantID: tn.ID, Name: slug + " key", Prefix: "kg_live_", Scopes: []string{"admin"}}
		if err := s.CreateAPIKey(ctx, ak, "kg_live_"+slug); err != nil {
			t.Fatalf("create api key in %s: %v", slug, err)
		}
		if _, err := s.DB.NewInsert().Model(&model.AuditLog{
			ID: store.NewID(), TenantID: tn.ID, Entity: "product", EntityID: p.ID,
			Action: "created_" + slug, ActorType: "admin",
		}).Exec(ctx); err != nil {
			t.Fatalf("create audit log in %s: %v", slug, err)
		}
		return fixture{tenant: tn, prod: p, lic: l, key: ak}
	}
	a := mk("acme")
	b := mk("globex")

	list := func(tenantID, key string, fn func(*gin.Context)) (int, []map[string]any) {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
		c.Set("tenant_id", tenantID)
		fn(c)
		var body struct {
			Data map[string]json.RawMessage `json:"data"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		var items []map[string]any
		_ = json.Unmarshal(body.Data[key], &items)
		return w.Code, items
	}

	cases := []struct {
		name  string
		key   string
		field string
		fn    func(*gin.Context)
		id    func(fixture) string
	}{
		{"products", "products", "id", h.ListProducts, func(f fixture) string { return f.prod.ID }},
		{"licenses", "licenses", "id", h.ListLicenses, func(f fixture) string { return f.lic.ID }},
		{"api keys", "api_keys", "id", h.ListAPIKeys, func(f fixture) string { return f.key.ID }},
		{"audit", "audit_logs", "entity_id", h.ListAuditLogs, func(f fixture) string { return f.prod.ID }},
	}
	for _, tc := range cases {
		for name, f := range map[string]fixture{"acme": a, "globex": b} {
			code, items := list(f.tenant.ID, tc.key, tc.fn)
			if code != http.StatusOK {
				t.Fatalf("%s list for %s: %d", tc.name, name, code)
			}
			if len(items) != 1 {
				t.Errorf("%s list for %s: %d rows, want 1", tc.name, name, len(items))
				continue
			}
			if got := items[0][tc.field]; got != tc.id(f) {
				t.Errorf("%s list for %s returned another workspace's row: %v", tc.name, name, items[0])
			}
		}
	}

	// A licence id from the other workspace is not found through its own
	// detail route either.
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/admin/licenses/"+b.lic.ID, nil)
	c.Params = gin.Params{{Key: "id", Value: b.lic.ID}}
	c.Set("tenant_id", a.tenant.ID)
	h.GetLicense(c)
	if w.Code != http.StatusNotFound {
		t.Errorf("acme reading globex licence: %d, want 404", w.Code)
	}
}

// Deleting an API key is scoped like every other admin mutation: the id
// alone must not let one workspace destroy another's key.
func TestDeleteAPIKeyIsTenantScoped(t *testing.T) {
	s := scratchStore(t)
	ctx := t.Context()
	gin.SetMode(gin.TestMode)
	h := &AdminHandler{Store: s}

	mk := func(slug string) (*model.Tenant, *model.APIKey) {
		t.Helper()
		tn := &model.Tenant{Slug: slug, Name: slug}
		if err := s.CreateTenant(ctx, tn); err != nil {
			t.Fatalf("create tenant %s: %v", slug, err)
		}
		ak := &model.APIKey{TenantID: tn.ID, Name: slug + " key", Prefix: "kg_live_", Scopes: []string{"admin"}}
		if err := s.CreateAPIKey(ctx, ak, "kg_live_"+slug); err != nil {
			t.Fatalf("create api key in %s: %v", slug, err)
		}
		return tn, ak
	}
	acme, acmeKey := mk("acme")
	_, globexKey := mk("globex")

	del := func(tenantID, id string) int {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodDelete, "/admin/api-keys/"+id, nil)
		c.Params = gin.Params{{Key: "id", Value: id}}
		c.Set("tenant_id", tenantID)
		h.DeleteAPIKey(c)
		// A 204 has no body, so the recorder never sees the status.
		return c.Writer.Status()
	}

	if code := del(acme.ID, globexKey.ID); code != http.StatusNotFound {
		t.Errorf("acme deleting globex key: %d, want 404", code)
	}
	if _, err := s.FindAPIKeyByID(ctx, globexKey.ID); err != nil {
		t.Errorf("globex key was deleted by another workspace: %v", err)
	}
	if code := del(acme.ID, acmeKey.ID); code != http.StatusNoContent {
		t.Errorf("acme deleting own key: %d, want 204", code)
	}
}
