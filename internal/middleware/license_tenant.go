package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/store"
)

// LicenseTenantScope keeps a license key inside its own workspace when
// the request names one with its host.
//
// license_key is the SDK credential. A key minted for one workspace
// answering on another workspace's host is answered exactly like a key
// that does not exist, so a tenant host never operates on — or confirms
// — another tenant's licence. Requests on the bare root domain, on the
// platform console, or on an install with multi-tenancy off carry no
// explicit workspace: there the key alone resolves the tenant, which is
// what keeps clients configured with BASE_URL working across the switch.
//
// The lookup here is a second read of a row the handler resolves again;
// it runs only on an explicit tenant host, never on the hot legacy path.
func LicenseTenantScope(db *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !TenantScoped(c) || IsPlatformContext(c) || !TenantExplicitFrom(c) {
			c.Next()
			return
		}
		key := licenseKeyFromRequest(c)
		if key == "" {
			c.Next()
			return
		}
		lic, err := db.FindLicenseByKey(c.Request.Context(), key)
		if err != nil || lic.TenantID == TenantIDFrom(c) {
			// Unknown or unusable keys keep the handler's answer and its
			// failure accounting; only a key that resolves to another
			// workspace is refused here.
			c.Next()
			return
		}
		recordLicenceFailure(c)
		abortWithError(c, http.StatusNotFound, "LICENSE_NOT_FOUND", "license not found")
	}
}

// licenseKeyFromRequest reads the SDK credential without consuming the
// body: every /license/* endpoint takes license_key in its JSON body,
// and the X-License-Key header is accepted too so an updater-style call
// that puts the key there is covered.
func licenseKeyFromRequest(c *gin.Context) string {
	if key := strings.TrimSpace(c.GetHeader("X-License-Key")); key != "" {
		return key
	}
	if c.Request.Body == nil || c.Request.Method != http.MethodPost {
		return ""
	}
	raw, err := c.GetRawData()
	if raw != nil {
		c.Request.Body = io.NopCloser(bytes.NewReader(raw))
	}
	if err != nil {
		return ""
	}
	var body struct {
		LicenseKey string `json:"license_key"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return ""
	}
	return strings.TrimSpace(body.LicenseKey)
}

// recordLicenceFailure charges a cross-workspace probe to the same
// per-IP budget the service uses for a key that does not exist.
func recordLicenceFailure(c *gin.Context) {
	bf, ok := c.Get("brute_force")
	if !ok {
		return
	}
	if p, ok := bf.(*BruteForceProtection); ok && p != nil {
		p.RecordFailure(FailureKeyIP(c.ClientIP()))
	}
}
