package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
)

// tenantID is the workspace a handler must scope its work to. Handler
// tests call handlers without the tenant middleware, and those act on
// the default tenant, which is also what a single-tenant install is.
func tenantID(c *gin.Context) string {
	if id := middleware.TenantIDFrom(c); id != "" {
		return id
	}
	return model.DefaultTenantID
}

// settingsTenant is the row namespace settings are read from and
// written to. With multi-tenancy off that is the platform-wide set
// ("") every existing install already has; when it is on, a tenant host
// reads the platform set merged with its own overrides.
func settingsTenant(c *gin.Context) string {
	if !middleware.TenantScoped(c) {
		return ""
	}
	return middleware.TenantIDFrom(c)
}

// actingAsPlatformAdmin reports whether a platform admin is reaching
// into a tenant for support. TenantAccess sets it; a handler called
// directly by a test sees false.
func actingAsPlatformAdmin(c *gin.Context) bool {
	v, _ := c.Get("is_platform_admin")
	b, _ := v.(bool)
	return b
}

// platformAdminSession refuses API keys on endpoints that only an
// interactive administrator should call (team management). An API key
// with the admin scope reaches every admin route; some of them hand out
// human roles, which a machine credential should not do.
func platformAdminSession(c *gin.Context) bool {
	return c.GetString("auth_type") != "api_key"
}
