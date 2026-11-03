package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/casdoor"
	"github.com/tabloy/keygate/internal/config"
	"github.com/tabloy/keygate/internal/service"
)

func casdoorTestHandler(secret string) *AuthHandler {
	return &AuthHandler{
		Config:   &config.Config{CasdoorWebhookSecret: secret},
		Casdoor:  &casdoor.Client{},
		Identity: &service.IdentityService{},
	}
}

func runWebhook(h *AuthHandler, secret string, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/webhook/casdoor", strings.NewReader(body))
	c.Request.Header.Set(casdoorWebhookHeader, secret)
	h.CasdoorWebhook(c)
	return w
}

func TestCasdoorWebhookIsHiddenWithoutSecret(t *testing.T) {
	if got := runWebhook(casdoorTestHandler(""), "", `{}`).Code; got != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", got)
	}
	// A secret with no provider is equally invisible: it is a setup
	// error, not an invitation to accept deliveries.
	h := casdoorTestHandler("s3cret")
	h.Casdoor = nil
	if got := runWebhook(h, "s3cret", `{}`).Code; got != http.StatusNotFound {
		t.Fatalf("unconfigured provider: status = %d, want 404", got)
	}
}

func TestCasdoorWebhookRejectsWrongSecret(t *testing.T) {
	if got := runWebhook(casdoorTestHandler("s3cret"), "wrong", `{}`).Code; got != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", got)
	}
}

// Casdoor sends the user as a JSON string in `object`; the extended
// copy is an object. Both spellings of the verification flag must be
// honoured, and the subject must survive the double decode.
func TestWebhookUserDecodesObjectStringAndExtended(t *testing.T) {
	var rec casdoorWebhookRecord
	raw := `{
		"action": "new-user",
		"object": "{\"id\":\"sub-1\",\"name\":\"alice\",\"email\":\"Alice@Example.com\",\"emailVerified\":true}"
	}`
	if err := json.Unmarshal([]byte(raw), &rec); err != nil {
		t.Fatal(err)
	}
	u := webhookUser(rec.Object, rec.ExtendedUser)
	if u == nil {
		t.Fatal("object string did not decode")
	}
	id := u.identity()
	if id.Subject != "sub-1" || id.Email != "alice@example.com" || !id.EmailVerified {
		t.Fatalf("identity = %+v", id)
	}
	if id.Name != "alice" {
		t.Fatalf("name = %q", id.Name)
	}

	var ext casdoorWebhookRecord
	raw = `{"action":"update-user","extendedUser":{"id":"sub-2","displayName":"Bob","email_verified":true}}`
	if err := json.Unmarshal([]byte(raw), &ext); err != nil {
		t.Fatal(err)
	}
	if u := webhookUser(ext.Object, ext.ExtendedUser); u == nil || u.ID != "sub-2" || u.DisplayName != "Bob" || !u.EmailVerifiedOIDC {
		t.Fatalf("extended user = %+v", u)
	}
}

func TestCasdoorExchangeNeedsAToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := casdoorTestHandler("")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/casdoor/exchange", strings.NewReader(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")
	h.CasdoorExchange(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

// An ID token is only accepted for a configured desktop client; the
// check runs before any network call.
func TestCasdoorExchangeIDTokenWithoutDesktopClients(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := casdoorTestHandler("")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/auth/casdoor/exchange",
		strings.NewReader(`{"id_token":"x"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	h.CasdoorExchange(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}
