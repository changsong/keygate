package handler

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/service"
	"github.com/tabloy/keygate/internal/store"
)

const (
	// casdoorWebhookHeader is the shared secret Casdoor is configured to
	// send. Casdoor does not sign its deliveries, so this header is the
	// only proof that a request came from it.
	casdoorWebhookHeader = "X-Keygate-Webhook-Secret"
	// The user object (plus the extended copy) is a few kilobytes; 1 MiB
	// leaves room for either without letting an anonymous caller stream
	// an unbounded body into memory.
	casdoorWebhookMaxBody  = 1 << 20
	casdoorWebhookProvider = "casdoor_webhook"
)

// casdoorWebhookRecord is Casdoor's delivery envelope. Object is
// normally a JSON string (a second parse), extendedUser an object.
type casdoorWebhookRecord struct {
	Action       string          `json:"action"`
	Organization string          `json:"organization"`
	Object       json.RawMessage `json:"object"`
	ExtendedUser json.RawMessage `json:"extendedUser"`
}

// casdoorWebhookUser is the subset of a Casdoor user the webhook needs.
// The REST API and the extended record spell the verification flag
// differently, so both are accepted.
type casdoorWebhookUser struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	DisplayName       string `json:"displayName"`
	Email             string `json:"email"`
	EmailVerified     bool   `json:"emailVerified"`
	EmailVerifiedOIDC bool   `json:"email_verified"`
	Avatar            string `json:"avatar"`
}

func (u *casdoorWebhookUser) identity() service.ProviderIdentity {
	name := u.DisplayName
	if name == "" {
		name = u.Name
	}
	return service.ProviderIdentity{
		Provider:      casdoorProvider,
		Subject:       strings.TrimSpace(u.ID),
		Email:         strings.ToLower(strings.TrimSpace(u.Email)),
		Name:          name,
		AvatarURL:     u.Avatar,
		EmailVerified: u.EmailVerified || u.EmailVerifiedOIDC,
	}
}

// CasdoorWebhook handles POST /api/v1/webhook/casdoor. It links the
// subject a Casdoor event describes, but correctness never depends on
// this endpoint: interactive login, portal claim, admin binding and the
// daily reconciliation all establish the same links. The webhook makes
// them earlier.
func (h *AuthHandler) CasdoorWebhook(c *gin.Context) {
	// Both conditions make the endpoint invisible: a configured secret
	// without the provider, or a provider without a secret, is a setup
	// error, not something to accept unsigned deliveries for.
	if h.Config.CasdoorWebhookSecret == "" || h.Casdoor == nil || h.Identity == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	got := c.GetHeader(casdoorWebhookHeader)
	if subtle.ConstantTimeCompare([]byte(got), []byte(h.Config.CasdoorWebhookSecret)) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, casdoorWebhookMaxBody)
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "body too large"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}

	var rec casdoorWebhookRecord
	if err := json.Unmarshal(body, &rec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}
	action := strings.ToLower(strings.TrimSpace(rec.Action))
	if action == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing action"})
		return
	}

	// Casdoor sends no event id. A hash of the delivery identifies a
	// retry precisely (a transient failure is redelivered byte for byte)
	// and still lets a later, different event for the same account run.
	sum := sha256.Sum256(body)
	eventID := hex.EncodeToString(sum[:])
	claimed, err := h.Store.ClaimProcessedEvent(c, casdoorWebhookProvider, eventID)
	if err != nil {
		slog.Error("casdoor webhook: claiming event failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "temporary failure"})
		return
	}
	if !claimed {
		c.JSON(http.StatusOK, gin.H{"status": "already_processed"})
		return
	}
	// From here on a failure releases the claim so the same delivery can
	// be retried; a handled-but-skipped event keeps it.
	fail := func(err error) {
		if delErr := h.Store.DeleteProcessedEvent(context.Background(), casdoorWebhookProvider, eventID); delErr != nil {
			slog.Error("casdoor webhook: releasing claim failed", "error", delErr)
		}
		slog.Error("casdoor webhook: processing failed", "action", action, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "temporary failure"})
	}

	switch action {
	case "delete-user":
		// Keygate does not delete accounts or licences on a Casdoor
		// delete: a licence is an asset, and the subject keeps its links
		// until an operator decides otherwise. Record the event only.
		if u := webhookUser(rec.Object, rec.ExtendedUser); u != nil {
			h.Store.Audit(c, &model.AuditLog{
				Entity: "identity", EntityID: u.ID, Action: "casdoor_delete_user",
				ActorType: casdoorWebhookProvider, IPAddress: c.ClientIP(),
				Changes: map[string]any{"provider": casdoorProvider, "email": u.Email},
			})
		}
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return

	case "new-user", "add-user", "signup", "login", "update-user":
		// Only the first group may create an account. A login for an
		// address Keygate has never seen (the account was made in
		// Casdoor directly) links nothing unless an operator or the
		// person's own sign-in creates it.
		allowCreate := action == "new-user" || action == "add-user" || action == "signup"

		u := webhookUser(rec.Object, rec.ExtendedUser)
		if u == nil || u.ID == "" {
			// Some events carry only the object's name; ask Casdoor for
			// the full user, which also gives us the subject.
			var err error
			u, err = h.fetchWebhookUser(c, rec)
			if err != nil {
				fail(err)
				return
			}
		}
		if u == nil {
			c.JSON(http.StatusOK, gin.H{"status": "ignored"})
			return
		}
		identity := u.identity()
		if identity.Subject == "" {
			c.JSON(http.StatusOK, gin.H{"status": "ignored"})
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()
		_, _, err := h.Identity.Resolve(ctx, identity, service.ResolveOptions{
			AllowCreate: allowCreate,
			ActorType:   casdoorWebhookProvider,
			IP:          c.ClientIP(),
		})
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"status": "processed"})
		case errors.Is(err, store.ErrEmailNotVerified),
			errors.Is(err, store.ErrAccountNotAllowed),
			errors.Is(err, store.ErrIdentityConflict):
			// Deterministic: a retry changes nothing. Log it and accept
			// the delivery; a later update-user will run again.
			slog.Warn("casdoor webhook: identity not linked", "action", action, "error", err)
			c.JSON(http.StatusOK, gin.H{"status": "skipped"})
		default:
			fail(err)
		}
		return

	default:
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return
	}
}

// webhookUser decodes the user a delivery carries. `object` is usually a
// JSON *string* holding the user, while `extendedUser` is the object
// itself; either may be absent. A field that decodes to a user with no
// id is returned as-is so the caller can decide to fetch the rest.
func webhookUser(object, extended json.RawMessage) *casdoorWebhookUser {
	u := decodeWebhookUser(object)
	if u != nil && u.ID != "" {
		return u
	}
	// The object may be a fragment; the extended copy is the fuller one.
	if ext := decodeWebhookUser(extended); ext != nil {
		return ext
	}
	return u
}

func decodeWebhookUser(raw json.RawMessage) *casdoorWebhookUser {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var u casdoorWebhookUser
	// A stringified object, as Record.object is.
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if s == "" {
			return nil
		}
		if err := json.Unmarshal([]byte(s), &u); err != nil {
			return nil
		}
		return &u
	}
	if err := json.Unmarshal(raw, &u); err != nil {
		return nil
	}
	return &u
}

// fetchWebhookUser asks Casdoor for the full user when the delivery
// carries only a fragment. It needs a subject or a name to ask with.
func (h *AuthHandler) fetchWebhookUser(ctx context.Context, rec casdoorWebhookRecord) (*casdoorWebhookUser, error) {
	u := webhookUser(rec.Object, rec.ExtendedUser)
	if u == nil || u.ID == "" {
		return u, nil
	}
	full, err := h.Casdoor.GetUser(ctx, h.Config.CasdoorOrg, u.ID)
	if err != nil {
		return nil, err
	}
	return &casdoorWebhookUser{
		ID:            full.ID,
		Name:          full.Name,
		DisplayName:   full.DisplayName,
		Email:         full.Email,
		EmailVerified: full.EmailVerified,
		Avatar:        full.Avatar,
	}, nil
}
