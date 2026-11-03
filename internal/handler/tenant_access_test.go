package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
)

// TenantAccess turns a global identity into this workspace's rights, and
// refuses an API key at any host but its own — the same 404 as a key
// that does not exist.
func TestTenantAccessMatrix(t *testing.T) {
	s := scratchStore(t)
	ctx := t.Context()
	cfg := platformConfig()
	gin.SetMode(gin.TestMode)

	for _, slug := range []string{"acme", "globex"} {
		if err := s.CreateTenant(ctx, &model.Tenant{Slug: slug, Name: slug}); err != nil {
			t.Fatalf("create tenant %s: %v", slug, err)
		}
	}
	acme, err := s.FindTenantBySlug(ctx, "acme")
	if err != nil {
		t.Fatal(err)
	}

	bob := &model.User{Email: "bob@example.com", Name: "Bob"}
	if err := s.UpsertUser(ctx, bob); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := s.AddTenantMember(ctx, acme.ID, bob.ID, "admin"); err != nil {
		t.Fatalf("add member: %v", err)
	}

	r := gin.New()
	r.Use(middleware.TenantResolver(s, cfg))
	// Stand in for SessionAuth: identity comes from test headers.
	r.Use(func(c *gin.Context) {
		if c.GetHeader("X-Test-Auth") == "api" {
			c.Set("auth_type", "api_key")
			c.Set("api_key", &model.APIKey{TenantID: c.GetHeader("X-Test-Key-Tenant")})
		} else {
			c.Set("user_id", c.GetHeader("X-Test-User"))
			c.Set("is_admin", c.GetHeader("X-Test-Platform-Admin") == "1")
		}
		c.Next()
	})
	r.GET("/whoami", middleware.TenantAccess(s), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"is_platform_admin": c.GetBool("is_platform_admin"),
			"is_member":         c.GetBool("is_member"),
			"is_tenant_admin":   c.GetBool("is_tenant_admin"),
			"tenant_role":       c.GetString("tenant_role"),
			"is_admin":          c.GetBool("is_admin"),
		})
	})

	who := func(host string, headers map[string]string) (int, map[string]any, string) {
		t.Helper()
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
		req.Host = host
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		r.ServeHTTP(w, req)
		var body map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		code := ""
		if e, ok := body["error"].(map[string]any); ok {
			code, _ = e["code"].(string)
		}
		return w.Code, body, code
	}

	// A member of Acme is an admin there and nobody in Globex.
	code, got, _ := who("acme.keygate.example", map[string]string{"X-Test-User": bob.ID})
	if code != http.StatusOK || got["is_member"] != true || got["is_tenant_admin"] != true ||
		got["tenant_role"] != "admin" || got["is_admin"] != true {
		t.Errorf("bob in acme: %d %+v", code, got)
	}
	code, got, _ = who("globex.keygate.example", map[string]string{"X-Test-User": bob.ID})
	if code != http.StatusOK || got["is_member"] != false || got["is_admin"] != false || got["tenant_role"] != "" {
		t.Errorf("bob in globex: %d %+v", code, got)
	}

	// A platform admin passes the admin check everywhere without becoming
	// a member of the workspace.
	code, got, _ = who("globex.keygate.example", map[string]string{
		"X-Test-User": "platform-1", "X-Test-Platform-Admin": "1",
	})
	if code != http.StatusOK || got["is_member"] != false || got["is_admin"] != true || got["is_platform_admin"] != true {
		t.Errorf("platform admin in globex: %d %+v", code, got)
	}
	if code, got, _ = who("app.keygate.example", map[string]string{
		"X-Test-User": "platform-1", "X-Test-Platform-Admin": "1",
	}); code != http.StatusOK || got["is_platform_admin"] != true {
		t.Errorf("platform admin on console: %d %+v", code, got)
	}

	// An API key opens only its own workspace's host.
	key := map[string]string{"X-Test-Auth": "api", "X-Test-Key-Tenant": acme.ID}
	if code, _, _ := who("acme.keygate.example", key); code != http.StatusOK {
		t.Errorf("acme key on acme host: %d, want 200", code)
	}
	if code, _, errCode := who("globex.keygate.example", key); code != http.StatusNotFound || errCode != "NOT_FOUND" {
		t.Errorf("acme key on globex host: %d %q, want 404 NOT_FOUND", code, errCode)
	}
	if code, _, errCode := who("app.keygate.example", key); code != http.StatusForbidden || errCode != "FORBIDDEN" {
		t.Errorf("api key on platform console: %d %q, want 403 FORBIDDEN", code, errCode)
	}
}
