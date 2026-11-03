package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/store"
	"github.com/tabloy/keygate/pkg/response"
)

// PortalLicenseView shapes a licence for the signed-in identity on the
// portal's licence list. Each person gets their own key: the owner the
// licence's, a member theirs, made the first time they get here (see
// Store.MemberKey). A member sees the devices their key activated and
// the members who have joined; activation_count stays the team's. ok is false when the identity is
// neither the owner nor a member any more, as when the seat went in
// between the queries that read the list, or when the product has no
// seats now, so a member's key opens nothing: they get nothing, and
// never the owner's key. lic.Product, lic.Seats and lic.Activations
// must be loaded.
func PortalLicenseView(ctx context.Context, st *store.Store, lic *model.License, id model.Identity) (key string, ok bool, err error) {
	if lic.OwnedBy(id) {
		key = st.DecryptLicenseKey(lic)
		trimForOwner(lic)
	} else {
		viewer := PortalViewerSeat(lic, id)
		if viewer == nil || lic.Product == nil || !model.ProductSupports(lic.Product.Type, model.CapSeats) {
			return "", false, nil
		}
		// Read the seat again: the list's copy may predate a removal,
		// and still hold the key the removal cleared.
		fresh, err := st.FindSeatByID(ctx, viewer.ID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return "", false, err
		}
		if err != nil || fresh.RemovedAt != nil || fresh.AcceptedAt == nil {
			return "", false, nil
		}
		if key, err = st.MemberKey(ctx, fresh); err != nil {
			return "", false, err
		}
		// Removed between that read and making the key: none was made.
		if key == "" {
			return "", false, nil
		}
		lic.Activations = OwnDevices(lic.Activations, viewer.ID)
		lic.Seats = model.JoinedSeats(lic.Seats)
		trimForMember(lic)
		// Over the seat limit, their key opens nothing usable: they are
		// told why, not left with a key that silently fails.
		if lic.KeySeatPaused, err = st.SeatPaused(ctx, fresh.ID); err != nil {
			return "", false, err
		}
	}
	if err := st.MarkPausedSeats(ctx, lic.ID, lic.Seats); err != nil {
		return "", false, err
	}
	if err := st.FillMemberEmails(ctx, lic.Activations); err != nil {
		return "", false, err
	}
	return key, true, nil
}

// trimForOwner leaves out of the owner's copy what is the operator's: the
// admin's notes, the references an integration or the checkout keeps,
// and how the licence was signed up for. The portal shows none of it;
// what it uses (the subscription, the provider, a held change) stays.
func trimForOwner(lic *model.License) {
	lic.Notes = ""
	lic.UserID = ""
	lic.StripeCustomerID = ""
	lic.StripePaymentIntentID = ""
	lic.StripeCheckoutSessionID = ""
	lic.ExternalCustomerID = ""
	lic.ExternalWorkspaceID = ""
	lic.SignupSource = ""
	lic.SignupPlanID = ""
	for _, seat := range lic.Seats {
		seat.UserID = ""
	}
}

// trimForMember leaves out of a member's copy of the licence what is the
// owner's alone: the billing references, the admin's notes, the owner's
// marketing consent and sign-up details, and the accounts behind the
// other seats. The portal shows a member none of it; billing actions are
// the owner's.
func trimForMember(lic *model.License) {
	lic.UserID = ""
	lic.StripeCustomerID = ""
	lic.StripeSubscriptionID = ""
	lic.StripePaymentIntentID = ""
	lic.StripeCheckoutSessionID = ""
	lic.StripePendingUpdateExpiresAt = nil
	lic.Notes = ""
	lic.ExternalCustomerID = ""
	lic.ExternalWorkspaceID = ""
	lic.SignupSource = ""
	lic.SignupPlanID = ""
	lic.MarketingConsent = false
	lic.MarketingConsentAt = nil
	for _, seat := range lic.Seats {
		seat.UserID = ""
	}
}

// The portal guards read license_key from the request body. Without an
// explicit cap a logged-in user could stream gigabytes through the body
// buffer; session auth is a weak defense against compromised
// credentials sending memory-exhaustion payloads. 64 KiB is comfortably
// above any real portal request (license_key + a handful of fields).
const portalGuardMaxBody = 64 * 1024

// guardedLicense reads the request's license_key and the licence it
// opens, for the portal guards. It caps the body and restores an
// in-memory reader for the handler, so c.ShouldBindJSON still sees the
// same bytes. The response is written when ok is false, a lookup that
// failed for any reason but "no such licence" included; lic is nil, with
// ok true, when there is no key or no such licence, and the handler
// answers that.
func guardedLicense(c *gin.Context, st *store.Store) (lic *model.License, id model.Identity, ok bool) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, portalGuardMaxBody)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		response.Err(c, http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE",
			"request body exceeds 64 KiB")
		c.Abort()
		return nil, model.Identity{}, false
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
	var req struct {
		LicenseKey string `json:"license_key"`
	}
	// Read as c.ShouldBindJSON reads it, the first JSON value with
	// anything after it ignored, so the key checked here is the key the
	// handler acts on. json.Unmarshal refused a body with trailing bytes
	// that the handler accepted, and the guard waved such a request
	// through as one with no key. A body that does not parse is refused
	// here, as the handler would refuse it.
	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		response.BadRequest(c, "invalid request body")
		c.Abort()
		return nil, model.Identity{}, false
	}
	if req.LicenseKey == "" {
		return nil, model.Identity{}, true
	}
	// Defense in depth: an empty identity must not fall through to seat
	// lookups.
	id = middleware.IdentityFrom(c)
	if id.UserID == "" && id.Email == "" {
		response.Unauthorized(c, "unauthorized")
		c.Abort()
		return nil, model.Identity{}, false
	}
	lic, err = st.FindLicenseByKey(c.Request.Context(), req.LicenseKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, id, true
	}
	// Any other failure stops here: letting it through would skip the
	// check this guard exists for.
	if err != nil {
		response.Internal(c, err)
		c.Abort()
		return nil, model.Identity{}, false
	}
	// A licence belongs to one workspace; presenting its key on another
	// tenant's host must read as "no such licence". The handler then
	// answers its own not-found, so no oracle is added here.
	if tenant := middleware.TenantIDFrom(c); tenant != "" && lic.TenantID != tenant {
		return nil, id, true
	}
	return lic, id, true
}

// notYours turns the caller away with the same 404, code included, the
// handler returns when the licence does not exist: a differential
// between "exists but not yours" and "doesn't exist" would be a
// licence-existence oracle.
func notYours(c *gin.Context) {
	response.Err(c, http.StatusNotFound, "LICENSE_NOT_FOUND", "license not found")
	c.Abort()
}

// PortalLicenseGuard lets through the licence's owner and its accepted
// members; an invite not yet accepted gives no access. Emails compare
// case-insensitively while the licence is unbound: admin-created
// licences may have stored mixed case.
func PortalLicenseGuard(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		lic, id, ok := guardedLicense(c, st)
		if !ok {
			return
		}
		if lic != nil && !lic.OwnedBy(id) {
			seat, err := st.FindSeatForIdentity(c.Request.Context(), lic.ID, id)
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				response.Internal(c, err)
				c.Abort()
				return
			}
			if err != nil || seat.AcceptedAt == nil {
				notYours(c)
				return
			}
		}
		c.Next()
	}
}

// PortalSeatOwnerGuard lets through the licence's owner alone: the
// owner manages the team, members use the licence.
func PortalSeatOwnerGuard(st *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		lic, id, ok := guardedLicense(c, st)
		if !ok {
			return
		}
		if lic != nil && !lic.OwnedBy(id) {
			notYours(c)
			return
		}
		c.Next()
	}
}
