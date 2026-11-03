package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/config"
)

func tenantTestContext(t *testing.T, target string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", target, nil)
	return c
}

func TestDevTenantOverride(t *testing.T) {
	dev := &config.Config{Environment: "development", TenantDevOverride: true}
	c := tenantTestContext(t, "/")
	c.Request.Header.Set("X-Tenant", "Acme")
	if got := devTenantOverride(c, dev); got != "acme" {
		t.Errorf("X-Tenant override = %q, want acme", got)
	}

	c = tenantTestContext(t, "/?tenant=beta")
	if got := devTenantOverride(c, dev); got != "beta" {
		t.Errorf("query override = %q, want beta", got)
	}

	// Reserved and malformed slugs are ignored rather than looked up.
	for _, bad := range []string{"app", "a", "-x", "a.b", "a_b"} {
		c := tenantTestContext(t, "/")
		c.Request.Header.Set("X-Tenant", bad)
		if got := devTenantOverride(c, dev); got != "" {
			t.Errorf("override %q accepted as %q", bad, got)
		}
	}

	// Never in production, and off unless enabled.
	prod := &config.Config{Environment: "production", TenantDevOverride: true}
	c = tenantTestContext(t, "/")
	c.Request.Header.Set("X-Tenant", "acme")
	if got := devTenantOverride(c, prod); got != "" {
		t.Errorf("override in production = %q, want ignored", got)
	}
	off := &config.Config{Environment: "development"}
	if got := devTenantOverride(c, off); got != "" {
		t.Errorf("override with TENANT_DEV_OVERRIDE off = %q, want ignored", got)
	}
}

func TestRequestHost(t *testing.T) {
	c := tenantTestContext(t, "/")
	c.Request.Host = "Acme.Keygate.App:443"

	// Without declared proxies the Host header is the truth.
	if got := requestHost(c, &config.Config{}); got != "acme.keygate.app:443" {
		t.Errorf("host = %q", got)
	}
	c.Request.Header.Set("X-Forwarded-Host", "Ignored.Example, proxy.internal")
	if got := requestHost(c, &config.Config{}); got != "acme.keygate.app:443" {
		t.Errorf("host without trusted proxies = %q, forwarded header must be ignored", got)
	}
	// With proxies declared, the first forwarded host wins.
	if got := requestHost(c, &config.Config{TrustedProxies: "127.0.0.1"}); got != "ignored.example" {
		t.Errorf("forwarded host = %q", got)
	}
}
