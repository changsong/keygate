package handler

import (
	"database/sql"
	"errors"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/config"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
	"github.com/tabloy/keygate/pkg/apperr"
	"github.com/tabloy/keygate/pkg/response"
)

// PlatformHandler is the platform console: it manages workspaces and
// their owners/members. It is reachable only on PLATFORM_HOST by a
// platform admin (see middleware.RequirePlatformAdmin).
type PlatformHandler struct {
	Store  *store.Store
	Config *config.Config
}

func NewPlatformHandler(s *store.Store, cfg *config.Config) *PlatformHandler {
	return &PlatformHandler{Store: s, Config: cfg}
}

// ListTenants returns every workspace with its member and license
// counts. GET /api/v1/platform/tenants
func (h *PlatformHandler) ListTenants(c *gin.Context) {
	tenants, err := h.Store.ListTenantSummaries(c.Request.Context())
	if err != nil {
		response.Internal(c, err)
		return
	}
	response.OK(c, gin.H{"tenants": tenants, "total": len(tenants)})
}

// CreateTenant opens a workspace and names its first owner.
// POST /api/v1/platform/tenants
func (h *PlatformHandler) CreateTenant(c *gin.Context) {
	var req struct {
		Slug       string `json:"slug" binding:"required"`
		Name       string `json:"name" binding:"required"`
		OwnerEmail string `json:"owner_email" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "slug, name and owner_email are required")
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.Name = strings.TrimSpace(req.Name)
	req.OwnerEmail = strings.ToLower(strings.TrimSpace(req.OwnerEmail))
	if !model.IsValidTenantSlug(req.Slug) {
		response.BadRequest(c, "slug must be 2-32 lower-case letters, digits or hyphens, start and end alphanumeric, and not a reserved name")
		return
	}
	if err := apperr.ValidateName("name", req.Name); err != nil {
		response.BadRequest(c, err.Message)
		return
	}
	if err := apperr.ValidateEmail(req.OwnerEmail); err != nil {
		response.BadRequest(c, err.Message)
		return
	}

	tenant := &model.Tenant{Slug: req.Slug, Name: req.Name, Status: model.TenantStatusActive}
	owner, err := h.Store.CreateTenantWithOwner(c.Request.Context(), tenant, req.OwnerEmail)
	if err != nil {
		if store.IsUniqueViolation(err) {
			response.Err(c, http.StatusConflict, "TENANT_EXISTS", "that slug is already taken")
			return
		}
		response.Internal(c, err)
		return
	}

	h.Store.Audit(c, &model.AuditLog{
		Entity: "tenant", EntityID: tenant.ID, Action: "tenant_created",
		ActorType: "platform_admin", ActorID: adminID(c),
		Changes: map[string]any{"slug": tenant.Slug, "owner_email": req.OwnerEmail},
	})
	response.Created(c, gin.H{"tenant": tenant, "owner": owner})
}

// GetTenant returns one workspace. GET /api/v1/platform/tenants/:id
func (h *PlatformHandler) GetTenant(c *gin.Context) {
	tenant, err := h.Store.FindTenantByID(c.Request.Context(), c.Param("id"))
	if errors.Is(err, sql.ErrNoRows) {
		response.NotFound(c, "tenant not found")
		return
	}
	if err != nil {
		response.Internal(c, err)
		return
	}
	members, err := h.Store.CountTenantMembers(c.Request.Context(), tenant.ID)
	if err != nil {
		response.Internal(c, err)
		return
	}
	licenses, err := h.Store.CountTenantLicenses(c.Request.Context(), tenant.ID)
	if err != nil {
		response.Internal(c, err)
		return
	}
	response.OK(c, gin.H{
		"tenant": tenant, "member_count": members, "license_count": licenses,
		"base_url": h.Config.TenantBaseURL(tenant.Slug),
	})
}

// UpdateTenant renames or suspends a workspace.
// PATCH /api/v1/platform/tenants/:id
func (h *PlatformHandler) UpdateTenant(c *gin.Context) {
	var req struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	if req.Status != "" && req.Status != model.TenantStatusActive && req.Status != model.TenantStatusSuspended {
		response.BadRequest(c, "status must be 'active' or 'suspended'")
		return
	}
	if req.Name != "" {
		if err := apperr.ValidateName("name", req.Name); err != nil {
			response.BadRequest(c, err.Message)
			return
		}
	}
	if req.Name == "" && req.Status == "" {
		response.BadRequest(c, "nothing to change")
		return
	}
	id := c.Param("id")
	if err := h.Store.UpdateTenant(c.Request.Context(), id, req.Name, req.Status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(c, "tenant not found")
			return
		}
		response.Internal(c, err)
		return
	}
	tenant, err := h.Store.FindTenantByID(c.Request.Context(), id)
	if err != nil {
		response.Internal(c, err)
		return
	}
	h.Store.Audit(c, &model.AuditLog{
		Entity: "tenant", EntityID: id, Action: "tenant_updated",
		ActorType: "platform_admin", ActorID: adminID(c),
		Changes: map[string]any{"name": req.Name, "status": req.Status},
	})
	response.OK(c, tenant)
}

// ListMembers returns a workspace's members.
// GET /api/v1/platform/tenants/:id/members
func (h *PlatformHandler) ListMembers(c *gin.Context) {
	members, err := h.Store.ListTenantMembers(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.Internal(c, err)
		return
	}
	views := make([]teamMemberView, 0, len(members))
	for _, m := range members {
		views = append(views, memberView(m))
	}
	response.OK(c, gin.H{"members": views, "total": len(views)})
}

// AddMember adds a global account to a workspace.
// POST /api/v1/platform/tenants/:id/members
func (h *PlatformHandler) AddMember(c *gin.Context) {
	tenant, ok := h.tenantFromParam(c)
	if !ok {
		return
	}
	var req struct {
		Email string `json:"email" binding:"required"`
		Role  string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "email is required")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if err := apperr.ValidateEmail(req.Email); err != nil {
		response.BadRequest(c, err.Message)
		return
	}
	role := req.Role
	if role == "" {
		role = model.TenantRoleMember
	}
	if !model.IsValidTenantRole(role) {
		response.BadRequest(c, "role must be 'member', 'admin' or 'owner'")
		return
	}
	user, err := h.Store.FindUserByEmail(c, req.Email)
	if errors.Is(err, sql.ErrNoRows) {
		if err := h.Store.CreatePlaceholderUser(c, req.Email); err != nil {
			response.Internal(c, err)
			return
		}
		if user, err = h.Store.FindUserByEmail(c, req.Email); err != nil {
			response.Internal(c, err)
			return
		}
	} else if err != nil {
		response.Internal(c, err)
		return
	}

	if _, _, _, err := h.Store.UpsertTenantMemberAtomic(c, tenant.ID, adminID(c), user.ID, role, true); err != nil {
		teamRoleError(c, err)
		return
	}
	h.Store.Audit(c, &model.AuditLog{
		TenantID: tenant.ID,
		Entity:   "team", EntityID: user.ID, Action: "member_added",
		ActorType: "platform_admin", ActorID: adminID(c),
		Changes: map[string]any{"email": req.Email, "role": role},
	})
	response.OK(c, memberView(&model.TenantMember{User: user, Role: role}))
}

// SetMemberRole changes an existing member's role.
// PATCH /api/v1/platform/tenants/:id/members/:user_id
func (h *PlatformHandler) SetMemberRole(c *gin.Context) {
	tenant, ok := h.tenantFromParam(c)
	if !ok {
		return
	}
	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !model.IsValidTenantRole(req.Role) {
		response.BadRequest(c, "role must be 'member', 'admin' or 'owner'")
		return
	}
	userID := c.Param("user_id")
	previous, _, changed, err := h.Store.UpsertTenantMemberAtomic(c, tenant.ID, adminID(c), userID, req.Role, true)
	if err != nil {
		teamRoleError(c, err)
		return
	}
	if !changed {
		response.OK(c, gin.H{"status": "unchanged", "role": req.Role})
		return
	}
	h.Store.Audit(c, &model.AuditLog{
		TenantID: tenant.ID,
		Entity:   "team", EntityID: userID, Action: "member_role_changed",
		ActorType: "platform_admin", ActorID: adminID(c),
		Changes: map[string]any{"role": req.Role, "previous_role": previous},
	})
	response.OK(c, gin.H{"status": "updated", "role": req.Role})
}

// RemoveMember removes a membership; the global account stays.
// DELETE /api/v1/platform/tenants/:id/members/:user_id
func (h *PlatformHandler) RemoveMember(c *gin.Context) {
	tenant, ok := h.tenantFromParam(c)
	if !ok {
		return
	}
	userID := c.Param("user_id")
	previous, changed, err := h.Store.RemoveTenantMemberAtomic(c, tenant.ID, adminID(c), userID, true)
	if err != nil {
		teamRoleError(c, err)
		return
	}
	if changed {
		h.Store.Audit(c, &model.AuditLog{
			TenantID: tenant.ID,
			Entity:   "team", EntityID: userID, Action: "member_removed",
			ActorType: "platform_admin", ActorID: adminID(c),
			Changes: map[string]any{"previous_role": previous},
		})
	}
	response.OK(c, gin.H{"status": "removed"})
}

func (h *PlatformHandler) tenantFromParam(c *gin.Context) (*model.Tenant, bool) {
	tenant, err := h.Store.FindTenantByID(c.Request.Context(), c.Param("id"))
	if errors.Is(err, sql.ErrNoRows) {
		response.NotFound(c, "tenant not found")
		return nil, false
	}
	if err != nil {
		response.Internal(c, err)
		return nil, false
	}
	return tenant, true
}

// MyTenants lists the workspaces the signed-in account belongs to.
// GET /api/v1/me/tenants
func (h *PlatformHandler) MyTenants(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "unauthorized")
		return
	}
	memberships, err := h.Store.ListMembershipsForUser(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c, err)
		return
	}
	type space struct {
		ID      string `json:"id"`
		Slug    string `json:"slug"`
		Name    string `json:"name"`
		Status  string `json:"status"`
		Role    string `json:"role"`
		BaseURL string `json:"base_url"`
	}
	out := make([]space, 0, len(memberships))
	for _, m := range memberships {
		if m.Tenant == nil {
			continue
		}
		out = append(out, space{
			ID: m.Tenant.ID, Slug: m.Tenant.Slug, Name: m.Tenant.Name,
			Status: m.Tenant.Status, Role: m.Role,
			BaseURL: h.Config.TenantBaseURL(m.Tenant.Slug),
		})
	}
	response.OK(c, gin.H{"tenants": out, "total": len(out)})
}

// GetSettings returns the platform-wide settings, with secrets and
// server-owned keys withheld exactly as the tenant settings endpoint
// does. GET /api/v1/platform/settings
func (h *PlatformHandler) GetSettings(c *gin.Context) {
	settings, err := h.Store.GetSettings(c.Request.Context())
	if err != nil {
		response.Internal(c, err)
		return
	}
	out := make(map[string]string, len(settings))
	for k, v := range settings {
		if settingsServerOwned[k] || settingsSecret[k] {
			continue
		}
		out[k] = v
	}
	response.OK(c, gin.H{"settings": out})
}

// UpdateSettings writes platform-wide settings.
// PUT /api/v1/platform/settings
func (h *PlatformHandler) UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request")
		return
	}
	for key, value := range req {
		if !settingsWritable[key] || settingsServerOwned[key] {
			response.BadRequest(c, "unknown setting: "+key)
			return
		}
		if allowed, ok := settingsEnum[key]; ok {
			valid := false
			for _, v := range allowed {
				if value == v {
					valid = true
					break
				}
			}
			if !valid {
				response.BadRequest(c, "invalid value for "+key)
				return
			}
		}
	}
	// Blank secrets mean "unchanged", as they do for a workspace: the
	// console never sees the stored value, so an ordinary save must not
	// wipe a credential it could not display.
	writes := make(map[string]string, len(req))
	for key, value := range req {
		if settingsSecret[key] && value == "" {
			continue
		}
		writes[key] = value
	}
	if len(writes) == 0 {
		response.OK(c, gin.H{"status": "saved"})
		return
	}
	if err := h.Store.SetSettings(c.Request.Context(), writes); err != nil {
		response.Internal(c, err)
		return
	}
	keys := make([]string, 0, len(writes))
	for key := range writes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	h.Store.Audit(c, &model.AuditLog{
		Entity: "settings", EntityID: "platform", Action: "updated",
		ActorType: "platform_admin", ActorID: adminID(c),
		Changes: map[string]any{"keys": keys},
	})
	response.OK(c, gin.H{"status": "saved"})
}
