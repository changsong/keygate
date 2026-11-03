package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
	"github.com/tabloy/keygate/pkg/response"
)

// PortalClaimHandler lets a signed-in user bind a licence to their
// account by entering its key — the path for a customer who bought with
// one address (or through a reseller) and signs in with another. The
// owner's key claims ownership of an unowned licence; a member's key
// only binds their own seat, never the licence.
//
//	POST /api/v1/portal/licenses/claim  { license_key }
type PortalClaimHandler struct {
	store *store.Store
}

func NewPortalClaimHandler(s *store.Store) *PortalClaimHandler {
	return &PortalClaimHandler{store: s}
}

const portalClaimMaxBody = 4 * 1024

// Claim handles POST /api/v1/portal/licenses/claim.
func (h *PortalClaimHandler) Claim(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, portalClaimMaxBody)
	var req struct {
		LicenseKey string `json:"license_key"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
		if errors.Is(err, io.EOF) {
			response.BadRequest(c, "license_key is required")
			return
		}
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			response.Err(c, http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE",
				"request body exceeds 4 KiB")
			return
		}
		response.BadRequest(c, "invalid request body")
		return
	}
	key := strings.TrimSpace(req.LicenseKey)
	if key == "" {
		response.BadRequest(c, "license_key is required")
		return
	}

	id := middleware.IdentityFrom(c)
	if id.UserID == "" {
		response.Unauthorized(c, "unauthorized")
		return
	}

	lic, err := h.store.FindLicenseByKey(c.Request.Context(), key)
	if errors.Is(err, sql.ErrNoRows) {
		// Same answer as "not yours": the endpoint must not say whether a
		// key exists to someone guessing them.
		response.Err(c, http.StatusNotFound, "LICENSE_NOT_FOUND", "license not found")
		return
	}
	if err != nil {
		response.Internal(c, err)
		return
	}
	// A key bought in another workspace is not a key here. Same 404 as a
	// key that does not exist, so the claim cannot probe other tenants.
	tenant := middleware.TenantIDFrom(c)
	if tenant != "" && lic.TenantID != tenant {
		response.Err(c, http.StatusNotFound, "LICENSE_NOT_FOUND", "license not found")
		return
	}

	// A member's key proves the seat, not the licence. It binds that seat
	// to the account and stops there; it must never make the caller the
	// owner.
	if lic.KeySeat != nil {
		if !lic.KeySeat.HeldBy(id) {
			response.Err(c, http.StatusNotFound, "LICENSE_NOT_FOUND", "license not found")
			return
		}
		if lic.KeySeat.UserID == "" {
			if err := h.store.BindSeatIdentity(c.Request.Context(), lic.KeySeat.ID, id.UserID); err != nil {
				response.Internal(c, err)
				return
			}
			if tenant != "" {
				if err := h.store.EnsureTenantMember(c.Request.Context(), tenant, id.UserID); err != nil {
					response.Internal(c, err)
					return
				}
			}
			h.store.Audit(c, &model.AuditLog{
				Entity: "seat", EntityID: lic.KeySeat.ID, Action: "claimed",
				ActorType: "portal", ActorID: id.Email, IPAddress: c.ClientIP(), ProductID: lic.ProductID,
				Changes: map[string]any{"license_id": lic.ID, "user_id": id.UserID},
			})
		}
		response.OK(c, gin.H{"status": "already_member", "license_id": lic.ID})
		return
	}

	if lic.OwnedBy(id) {
		response.OK(c, gin.H{"status": "already_owned", "license_id": lic.ID})
		return
	}
	claimed, err := h.store.ClaimLicense(c.Request.Context(), lic.ID, id.UserID)
	switch {
	case errors.Is(err, store.ErrLicenseAlreadyClaimed):
		response.Err(c, http.StatusConflict, "LICENSE_ALREADY_CLAIMED",
			"this license is already bound to another account; contact support to transfer it")
		return
	case err != nil:
		response.Internal(c, err)
		return
	}
	if !claimed {
		// Bound by this user between the read and the claim: the retry
		// finds the outcome it asked for.
		response.OK(c, gin.H{"status": "already_owned", "license_id": lic.ID})
		return
	}
	// Claiming a licence makes the account a member of the workspace
	// that owns it, which is the only way in for a customer who bought
	// with another address.
	if tenant != "" {
		if err := h.store.EnsureTenantMember(c.Request.Context(), tenant, id.UserID); err != nil {
			response.Internal(c, err)
			return
		}
	}
	// The key itself never reaches the audit log.
	h.store.Audit(c, &model.AuditLog{
		Entity: "license", EntityID: lic.ID, Action: "claimed",
		ActorType: "portal", ActorID: id.Email, IPAddress: c.ClientIP(), ProductID: lic.ProductID,
		Changes: map[string]any{"user_id": id.UserID},
	})
	response.OK(c, gin.H{"status": "claimed", "license_id": lic.ID})
}
