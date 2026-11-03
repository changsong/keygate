package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
)

// A license key names its workspace, but a tenant host is a claim about
// which workspace is being asked. The two must agree there; on the bare
// root domain the key alone still resolves the tenant, so a client that
// only knows BASE_URL keeps working.
func TestLicenseTenantScope(t *testing.T) {
	s := scratchStore(t)
	cfg := platformConfig()
	gin.SetMode(gin.TestMode)

	for _, slug := range []string{"acme", "globex"} {
		if err := s.CreateTenant(t.Context(), &model.Tenant{Slug: slug, Name: slug}); err != nil {
			t.Fatalf("create tenant %s: %v", slug, err)
		}
	}
	acme, err := s.FindTenantBySlug(t.Context(), "acme")
	if err != nil {
		t.Fatal(err)
	}
	prod := &model.Product{Name: "Acme", Slug: "acme-product", Type: "saas", TenantID: acme.ID}
	if err := s.CreateProduct(t.Context(), prod); err != nil {
		t.Fatalf("create product: %v", err)
	}
	lic := &model.License{
		ProductID: prod.ID, Email: "holder@example.com", LicenseKey: "TENANT-SCOPE-KEY",
		Status: "active", TenantID: acme.ID,
	}
	if err := s.CreateLicense(t.Context(), lic); err != nil {
		t.Fatalf("create license: %v", err)
	}

	// The handler echoes the body it received so the test can prove the
	// middleware restored a body it had to read to find the key.
	var seen string
	r := gin.New()
	r.Use(middleware.TenantResolver(s, cfg))
	r.POST("/license/activate", middleware.LicenseTenantScope(s), func(c *gin.Context) {
		var body struct {
			LicenseKey string `json:"license_key"`
		}
		_ = c.ShouldBindJSON(&body)
		seen = body.LicenseKey
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	call := func(host, key string) (*httptest.ResponseRecorder, string) {
		t.Helper()
		seen = ""
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/license/activate",
			strings.NewReader(`{"license_key":"`+key+`","identifier":"dev-1"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Host = host
		r.ServeHTTP(w, req)
		var out struct {
			Error *struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		if out.Error != nil {
			return w, out.Error.Code
		}
		return w, ""
	}

	// The key's own workspace answers, and the handler still sees the body.
	if w, code := call("acme.keygate.example", "TENANT-SCOPE-KEY"); w.Code != http.StatusOK || code != "" {
		t.Fatalf("acme host: %d %s", w.Code, code)
	}
	if seen != "TENANT-SCOPE-KEY" {
		t.Errorf("handler saw key %q, want the request body restored", seen)
	}

	// Another workspace's host answers like a key that does not exist.
	w, code := call("globex.keygate.example", "TENANT-SCOPE-KEY")
	if w.Code != http.StatusNotFound || code != "LICENSE_NOT_FOUND" {
		t.Fatalf("globex host: %d %q, want 404 LICENSE_NOT_FOUND", w.Code, code)
	}
	if seen != "" {
		t.Errorf("handler ran on a cross-workspace key")
	}

	// The bare root domain keeps the key-only path for legacy clients.
	if w, code := call("keygate.example", "TENANT-SCOPE-KEY"); w.Code != http.StatusOK || code != "" {
		t.Fatalf("root host: %d %s", w.Code, code)
	}

	// With multi-tenancy off there is no host claim to check.
	off := *cfg
	off.TenantEnabled = false
	r2 := gin.New()
	r2.Use(middleware.TenantResolver(s, &off))
	r2.POST("/license/activate", middleware.LicenseTenantScope(s), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	w = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/license/activate",
		strings.NewReader(`{"license_key":"TENANT-SCOPE-KEY","identifier":"dev-1"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Host = "globex.keygate.example"
	r2.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("tenancy off: %d, want 200", w.Code)
	}
}
