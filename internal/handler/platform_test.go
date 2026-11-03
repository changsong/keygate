package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/config"
	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
)

func platformConfig() *config.Config {
	return &config.Config{
		BaseURL:          "https://keygate.example",
		TenantEnabled:    true,
		TenantRootDomain: "keygate.example",
		PlatformHost:     "app.keygate.example",
	}
}

// The platform console opens workspaces and names their owners; members
// listed for one workspace never appear in another.
func TestPlatformTenantLifecycle(t *testing.T) {
	s := scratchStore(t)
	cfg := platformConfig()
	gin.SetMode(gin.TestMode)
	h := NewPlatformHandler(s, cfg)

	create := func(slug, name, owner string) (int, struct {
		Data struct {
			Tenant struct {
				ID   string `json:"id"`
				Slug string `json:"slug"`
			} `json:"tenant"`
			Owner struct {
				ID string `json:"id"`
			} `json:"owner"`
		} `json:"data"`
		Error *struct {
			Code string `json:"code"`
		} `json:"error"`
	}) {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/platform/tenants",
			strings.NewReader(`{"slug":"`+slug+`","name":"`+name+`","owner_email":"`+owner+`"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("user_id", "admin-1")
		h.CreateTenant(c)
		var out struct {
			Data struct {
				Tenant struct {
					ID   string `json:"id"`
					Slug string `json:"slug"`
				} `json:"tenant"`
				Owner struct {
					ID string `json:"id"`
				} `json:"owner"`
			} `json:"data"`
			Error *struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}

	code, a := create("acme", "Acme", "owner-a@example.com")
	if code != http.StatusCreated {
		t.Fatalf("create acme: %d", code)
	}
	code, b := create("globex", "Globex", "owner-b@example.com")
	if code != http.StatusCreated {
		t.Fatalf("create globex: %d", code)
	}
	if code, dup := create("acme", "Again", "x@example.com"); code != http.StatusConflict || dup.Error == nil || dup.Error.Code != "TENANT_EXISTS" {
		t.Fatalf("duplicate slug: %d %+v, want 409 TENANT_EXISTS", code, dup.Error)
	}

	// A platform admin adds a member to Acme only.
	add := func(tenantID, email, role string) (int, string) {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/platform/tenants/"+tenantID+"/members",
			strings.NewReader(`{"email":"`+email+`","role":"`+role+`"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Params = gin.Params{{Key: "id", Value: tenantID}}
		c.Set("user_id", "admin-1")
		h.AddMember(c)
		var out struct {
			Data struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out.Data.ID
	}
	if code, _ := add(a.Data.Tenant.ID, "bob@example.com", "admin"); code != http.StatusOK {
		t.Fatalf("add bob to acme: %d", code)
	}
	bobID, err := s.FindUserByEmail(t.Context(), "bob@example.com")
	if err != nil {
		t.Fatal(err)
	}

	members := func(tenantID string) int {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/platform/tenants/"+tenantID+"/members", nil)
		c.Params = gin.Params{{Key: "id", Value: tenantID}}
		h.ListMembers(c)
		var out struct {
			Data struct {
				Total int `json:"total"`
			} `json:"data"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return out.Data.Total
	}
	if n := members(a.Data.Tenant.ID); n != 2 {
		t.Errorf("acme members: %d, want 2", n)
	}
	if n := members(b.Data.Tenant.ID); n != 1 {
		t.Errorf("globex members: %d, want 1", n)
	}

	// The workspace switcher shows only Acme to Bob.
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/me/tenants", nil)
	c.Set("user_id", bobID.ID)
	h.MyTenants(c)
	var me struct {
		Data struct {
			Tenants []struct {
				Slug string `json:"slug"`
			} `json:"tenants"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &me)
	if len(me.Data.Tenants) != 1 || me.Data.Tenants[0].Slug != "acme" {
		t.Errorf("bob's workspaces: %+v, want [acme]", me.Data.Tenants)
	}
}

// A suspended workspace leaves the resolver refused, and a host naming no
// tenant is unknown rather than falling through to the default one.
func TestTenantResolverRefusesSuspendedAndUnknown(t *testing.T) {
	s := scratchStore(t)
	cfg := platformConfig()
	gin.SetMode(gin.TestMode)

	if err := s.CreateTenant(t.Context(), &model.Tenant{Slug: "acme", Name: "Acme"}); err != nil {
		t.Fatal(err)
	}
	tenant, err := s.FindTenantBySlug(t.Context(), "acme")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateTenant(t.Context(), tenant.ID, "", model.TenantStatusSuspended); err != nil {
		t.Fatal(err)
	}

	resolve := func(host string) int {
		t.Helper()
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/config", nil)
		c.Request.Host = host
		middleware.TenantResolver(s, cfg)(c)
		return w.Code
	}
	if code := resolve("acme.keygate.example"); code != http.StatusForbidden {
		t.Errorf("suspended tenant host: %d, want 403", code)
	}
	if code := resolve("nobody.keygate.example"); code != http.StatusNotFound {
		t.Errorf("unknown tenant host: %d, want 404", code)
	}
	if code := resolve("app.keygate.example"); code != http.StatusOK {
		t.Errorf("platform host: %d, want 200", code)
	}
}
