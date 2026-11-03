package middleware

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/config"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
)

// Context keys set by TenantResolver. Handlers read them through the
// helpers below rather than by name, so a rename stays in one file.
const (
	ckTenant         = "tenant"
	ckTenantID       = "tenant_id"
	ckTenantSlug     = "tenant_slug"
	ckTenantName     = "tenant_name"
	ckTenantURL      = "tenant_base_url"
	ckTenantPlatform = "tenant_platform"
	ckTenantScoped   = "tenant_scoped"
	ckTenantExplicit = "tenant_explicit"
)

// TenantResolver decides which workspace a request belongs to and puts
// it in the context.
//
// With multi-tenancy off this is the default tenant for every request,
// so the rest of the code can always ask for a tenant id and the
// single-tenant install behaves exactly as before.
//
// With it on, a tenant host is <slug>.<ROOT_DOMAIN>, the bare root
// domain is the default tenant, and PLATFORM_HOST is the platform
// console, which has no tenant. An unknown or suspended tenant does not
// reach a handler.
func TenantResolver(db *store.Store, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		host := requestHost(c, cfg)
		c.Set(ckTenantScoped, cfg.TenantEnabled)

		if cfg.TenantEnabled && cfg.IsPlatformHost(host) {
			c.Set(ckTenantPlatform, true)
			c.Next()
			return
		}

		// explicit marks a host that names one workspace rather than the
		// bare root domain, which maps to the default tenant for
		// compatibility. Only an explicit choice may be held against a
		// license key (see LicenseTenantScope).
		explicit := false
		slug := ""
		if cfg.TenantEnabled {
			var ok bool
			var root bool
			slug, root, ok = cfg.TenantSlugFromHost(host)
			if ok {
				explicit = !root
			} else if override := devTenantOverride(c, cfg); override != "" {
				slug, ok, explicit = override, true, true
			}
			if !ok {
				abortWithError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "unknown tenant")
				return
			}
		}

		var (
			t   *model.Tenant
			err error
		)
		if slug == "" {
			t, err = db.DefaultTenant(ctx)
			if errors.Is(err, sql.ErrNoRows) {
				// The migration seeds this row; an install whose schema
				// predates it still serves its single workspace.
				t, err = &model.Tenant{ID: model.DefaultTenantID, Slug: model.DefaultTenantSlug, Name: "Default", Status: model.TenantStatusActive}, nil
			}
		} else {
			t, err = db.FindTenantBySlug(ctx, slug)
			if errors.Is(err, sql.ErrNoRows) {
				abortWithError(c, http.StatusNotFound, "TENANT_NOT_FOUND", "unknown tenant")
				return
			}
		}
		if err != nil {
			abortInternal(c, err)
			return
		}
		if !t.IsActive() {
			abortWithError(c, http.StatusForbidden, "TENANT_SUSPENDED", "this workspace is suspended")
			return
		}

		c.Set(ckTenant, t)
		c.Set(ckTenantID, t.ID)
		c.Set(ckTenantSlug, t.Slug)
		c.Set(ckTenantName, t.Name)
		c.Set(ckTenantURL, cfg.TenantBaseURL(t.Slug))
		c.Set(ckTenantPlatform, false)
		c.Set(ckTenantExplicit, explicit)
		c.Next()
	}
}

// requestHost is the host the request names, lower-cased with no port.
// X-Forwarded-Host is believed only when the deployment declared its
// proxies; otherwise any caller could choose the tenant directly.
func requestHost(c *gin.Context, cfg *config.Config) string {
	host := c.Request.Host
	if cfg.TrustedProxies != "" {
		if forwarded := c.GetHeader("X-Forwarded-Host"); forwarded != "" {
			host = strings.Split(forwarded, ",")[0]
		}
	}
	return strings.ToLower(strings.TrimSpace(host))
}

func devTenantOverride(c *gin.Context, cfg *config.Config) string {
	if !cfg.IsTenantDevOverrideAllowed() {
		return ""
	}
	slug := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Tenant")))
	if slug == "" {
		slug = strings.ToLower(strings.TrimSpace(c.Query("tenant")))
	}
	if !model.IsValidTenantSlug(slug) {
		return ""
	}
	return slug
}

// TenantAccess turns the global identity SessionAuth established into
// the request's rights inside the workspace TenantResolver chose.
//
// A session's is_admin becomes true when the account is a platform
// admin (users.role) or holds owner/admin in this tenant. An API key is
// accepted only at its own tenant's host: a key minted for A must not
// reach B even with an admin scope. On the platform console an API key
// has no meaning and is refused.
//
// It does not reject a session that is not a member: admin routes then
// fail the RequireScope/AdminOnly check, and the portal asks for
// membership explicitly. This is what keeps a platform admin able to
// enter a tenant for support without a membership row.
func TenantAccess(db *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString("auth_type") == "api_key" {
			v, _ := c.Get("api_key")
			ak, _ := v.(*model.APIKey)
			if ak == nil {
				abortWithError(c, http.StatusForbidden, "FORBIDDEN", "missing api key context")
				return
			}
			if IsPlatformContext(c) {
				abortWithError(c, http.StatusForbidden, "FORBIDDEN", "api keys are not accepted on the platform console")
				return
			}
			if ak.TenantID != TenantIDFrom(c) {
				// Same answer as a key that does not exist: a cross-tenant
				// probe must not learn that the key is real.
				abortWithError(c, http.StatusNotFound, "NOT_FOUND", "not found")
				return
			}
			c.Next()
			return
		}

		userID := c.GetString("user_id")
		if userID == "" {
			abortWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "unauthorized")
			return
		}
		platformAdmin, _ := c.Get("is_admin")
		isPlatformAdmin := platformAdmin == true
		c.Set("is_platform_admin", isPlatformAdmin)
		c.Set("is_member", false)
		c.Set("is_tenant_admin", false)
		c.Set("tenant_role", "")

		if IsPlatformContext(c) {
			c.Next()
			return
		}

		m, err := db.FindTenantMembership(c.Request.Context(), TenantIDFrom(c), userID)
		switch {
		case errors.Is(err, sql.ErrNoRows):
			// Not a member. A platform admin passes; everyone else is
			// refused by the route's own check.
			c.Set("is_admin", isPlatformAdmin)
		case err != nil:
			abortInternal(c, err)
			return
		default:
			c.Set("is_member", true)
			c.Set("tenant_role", m.Role)
			c.Set("is_tenant_admin", m.IsAdmin())
			c.Set("is_admin", isPlatformAdmin || m.IsAdmin())
		}
		c.Next()
	}
}

// RequireTenantMember closes a tenant route to signed-in accounts that
// have no place in this workspace. Platform admins pass: they handle
// support and every such access is audited by the handler.
func RequireTenantMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		if IsPlatformContext(c) {
			abortWithError(c, http.StatusNotFound, "NOT_FOUND", "not found")
			return
		}
		member, _ := c.Get("is_member")
		admin, _ := c.Get("is_platform_admin")
		if member != true && admin != true {
			abortWithError(c, http.StatusForbidden, "TENANT_ACCESS_DENIED", "you do not have access to this workspace")
			return
		}
		c.Next()
	}
}

// RequirePlatformAdmin guards the console: it exists only on
// PLATFORM_HOST, and only for platform admins. A tenant host answers
// 404, so the console is invisible from a customer's workspace.
func RequirePlatformAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsPlatformContext(c) {
			abortWithError(c, http.StatusNotFound, "NOT_FOUND", "not found")
			return
		}
		if v, _ := c.Get("is_admin"); v != true {
			abortWithError(c, http.StatusForbidden, "FORBIDDEN", "platform admin required")
			return
		}
		c.Next()
	}
}

// TenantFrom returns the workspace of the request. The bool is false on
// the platform console, where there is no tenant.
func TenantFrom(c *gin.Context) (*model.Tenant, bool) {
	v, ok := c.Get(ckTenant)
	if !ok {
		return nil, false
	}
	t, ok := v.(*model.Tenant)
	return t, ok
}

// TenantIDFrom is the workspace a handler must scope its queries to.
func TenantIDFrom(c *gin.Context) string {
	return c.GetString(ckTenantID)
}

func TenantSlugFrom(c *gin.Context) string {
	return c.GetString(ckTenantSlug)
}

// TenantBaseURLFrom is the public origin to build links with: the
// tenant's subdomain, or BaseURL for the default tenant.
func TenantBaseURLFrom(c *gin.Context) string {
	return c.GetString(ckTenantURL)
}

// TenantScoped reports whether the request is being routed by tenant at
// all. With multi-tenancy off the default tenant is only a compatibility
// shim, and settings stay the single platform-wide set they always were.
func TenantScoped(c *gin.Context) bool {
	v, _ := c.Get(ckTenantScoped)
	b, _ := v.(bool)
	return b
}

// TenantExplicitFrom reports whether the request named one workspace
// with its host (or a development override) rather than arriving on the
// bare root domain, which maps to the default tenant.
func TenantExplicitFrom(c *gin.Context) bool {
	v, _ := c.Get(ckTenantExplicit)
	b, _ := v.(bool)
	return b
}

func IsPlatformContext(c *gin.Context) bool {
	v, _ := c.Get(ckTenantPlatform)
	b, _ := v.(bool)
	return b
}
