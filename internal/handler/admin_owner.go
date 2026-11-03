package handler

import (
	"database/sql"
	"errors"
	"log/slog"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
	"github.com/tabloy/keygate/pkg/response"
)

// Admin owner binding: an operator attaches a licence to the Keygate
// account that should see it in the portal, without changing the
// licence's billing address. Binding is guarded (only an unowned
// licence or the same account); reassigning one already held elsewhere
// is a separate, admin-only action so a licenses:write key cannot take
// a customer's licence.
//
//	POST /api/v1/admin/licenses/:id/owner           { user_id | email }
//	POST /api/v1/admin/licenses/:id/owner/override  { user_id | email }

type ownerBinding struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

// resolveTargetUser finds the account named by user_id or email without
// creating one: a typo must not mint an account that then owns a
// licence. The response is written when ok is false.
func (h *AdminHandler) resolveTargetUser(c *gin.Context, req ownerBinding) (userID string, ok bool) {
	userID = strings.TrimSpace(req.UserID)
	email := strings.TrimSpace(req.Email)
	if userID == "" && email == "" {
		response.BadRequest(c, "user_id or email is required")
		return "", false
	}
	if userID != "" {
		u, err := h.Store.FindUserByID(c, userID)
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(c, "user not found")
			return "", false
		}
		if err != nil {
			response.Internal(c, err)
			return "", false
		}
		return u.ID, true
	}
	u, err := h.Store.FindUserByEmail(c, email)
	if errors.Is(err, sql.ErrNoRows) {
		response.NotFound(c, "user not found")
		return "", false
	}
	if err != nil {
		response.Internal(c, err)
		return "", false
	}
	return u.ID, true
}

// ensureTenantMemberOfLicense lets the account that now owns the licence
// into the workspace, so it can find it in the portal. The binding
// stands even if this fails; the next sign-in retries it.
func (h *AdminHandler) ensureTenantMemberOfLicense(c *gin.Context, licenseID, userID string) {
	lic, err := h.Store.FindLicenseForTenant(c, tenantID(c), licenseID)
	if err != nil {
		slog.Warn("owner binding: licence lookup failed", "license_id", licenseID, "error", err)
		return
	}
	if err := h.Store.EnsureTenantMember(c, lic.TenantID, userID); err != nil {
		slog.Warn("owner binding: could not add the owner to the workspace",
			"tenant_id", lic.TenantID, "user_id", userID, "error", err)
	}
}

// BindLicenseOwner handles POST /admin/licenses/:id/owner.
func (h *AdminHandler) BindLicenseOwner(c *gin.Context) {
	id := c.Param("id")
	if !h.checkLicenseScope(c, id) {
		return
	}
	var req ownerBinding
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "user_id or email is required")
		return
	}
	targetID, ok := h.resolveTargetUser(c, req)
	if !ok {
		return
	}
	previous, err := h.Store.BindLicenseOwner(c, id, targetID, false)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		response.NotFound(c, "license not found")
		return
	case errors.Is(err, store.ErrLicenseAlreadyClaimed):
		response.Conflict(c, "LICENSE_ALREADY_CLAIMED",
			"this license is bound to another account; use the override action to reassign it", nil)
		return
	case err != nil:
		response.Internal(c, err)
		return
	}
	status := "bound"
	if previous == targetID {
		status = "already_bound"
	} else {
		h.ensureTenantMemberOfLicense(c, id, targetID)
		lic, _ := h.Store.FindLicenseForTenant(c, tenantID(c), id)
		entry := &model.AuditLog{
			Entity: "license", EntityID: id, Action: "bind_owner",
			ActorType: "admin", ActorID: adminID(c), IPAddress: c.ClientIP(),
			Changes: map[string]any{"from": previous, "to": targetID},
		}
		if lic != nil {
			entry.ProductID = lic.ProductID
		}
		h.Store.Audit(c, entry)
	}
	response.OK(c, gin.H{"status": status, "license_id": id, "user_id": targetID})
}

// OverrideLicenseOwner handles POST /admin/licenses/:id/owner/override:
// reassign a licence another account already holds. Admin-only at the
// router; the audit records both sides.
func (h *AdminHandler) OverrideLicenseOwner(c *gin.Context) {
	id := c.Param("id")
	if !h.checkLicenseScope(c, id) {
		return
	}
	var req ownerBinding
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "user_id or email is required")
		return
	}
	targetID, ok := h.resolveTargetUser(c, req)
	if !ok {
		return
	}
	previous, err := h.Store.BindLicenseOwner(c, id, targetID, true)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		response.NotFound(c, "license not found")
		return
	case err != nil:
		response.Internal(c, err)
		return
	}
	if previous != targetID {
		h.ensureTenantMemberOfLicense(c, id, targetID)
		lic, _ := h.Store.FindLicenseForTenant(c, tenantID(c), id)
		entry := &model.AuditLog{
			Entity: "license", EntityID: id, Action: "reassign_owner",
			ActorType: "admin", ActorID: adminID(c), IPAddress: c.ClientIP(),
			Changes: map[string]any{"from": previous, "to": targetID},
		}
		if lic != nil {
			entry.ProductID = lic.ProductID
		}
		h.Store.Audit(c, entry)
	}
	response.OK(c, gin.H{"status": "reassigned", "license_id": id, "user_id": targetID})
}
