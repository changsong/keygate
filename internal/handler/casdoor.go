package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"

	"github.com/tabloy/keygate/internal/middleware"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/service"
	"github.com/tabloy/keygate/internal/store"
	"github.com/tabloy/keygate/pkg/response"
)

const (
	casdoorStateCookie = "casdoor_oauth"
	casdoorStatePath   = "/api/v1/auth/casdoor"
	casdoorStateTTL    = 10 * time.Minute
	// casdoorProvider is the stable provider key in oauth_accounts and
	// the audit trail.
	casdoorProvider = "casdoor"
)

// casdoorState is the signed cookie that carries the login round-trip
// material. It is HttpOnly and single-use (cleared at the callback);
// the PKCE verifier never appears in a URL.
type casdoorState struct {
	State    string `json:"s"`
	Nonce    string `json:"n"`
	Verifier string `json:"v"`
	Next     string `json:"x"`
	Expires  int64  `json:"e"`
	// Tenant is the workspace slug the login started in. The callback
	// is answered on the platform host, so the state is what carries
	// the workspace across the round trip; empty is a platform login.
	Tenant string `json:"t,omitempty"`
}

func (h *AuthHandler) casdoorEnabled() bool {
	return h.Casdoor != nil && h.Identity != nil
}

// CasdoorLogin starts the authorization-code flow.
func (h *AuthHandler) CasdoorLogin(c *gin.Context) {
	if !h.casdoorEnabled() {
		response.NotFound(c, "not found")
		return
	}
	tenant, failCode := h.casdoorLoginTenant(c)
	if failCode != "" {
		h.casdoorFail(c, failCode)
		return
	}
	st := casdoorState{
		State:    randomHex(32),
		Nonce:    randomHex(32),
		Verifier: oauth2.GenerateVerifier(),
		Next:     safeNextPath(c.Query("next")),
		Expires:  time.Now().Add(casdoorStateTTL).Unix(),
	}
	if tenant != nil {
		st.Tenant = tenant.Slug
	}
	encoded, err := h.signCasdoorState(st)
	if err != nil {
		h.casdoorFail(c, "unavailable")
		return
	}
	// A tenant subdomain starts the flow too (the link may come from
	// the workspace's own login page); SESSION_COOKIE_DOMAIN carries the
	// state cookie to the platform callback. Without it the cookie stays
	// host-only, which still works when the flow starts on the platform
	// host — the URL Providers hands out.
	setSecureCookieDomain(c, casdoorStateCookie, encoded, int(casdoorStateTTL.Seconds()),
		casdoorStatePath, h.cookieDomain(), h.requestIsHTTPS(c), true)

	authURL, err := h.Casdoor.AuthCodeURL(st.State, st.Nonce, st.Verifier)
	if err != nil {
		slog.Error("casdoor: building authorization URL failed", "error", err)
		h.casdoorFail(c, "unavailable")
		return
	}
	c.Redirect(http.StatusFound, authURL)
}

// CasdoorCallback finishes the flow: state/nonce/PKCE checks, token
// verification, identity resolution, session issuance.
func (h *AuthHandler) CasdoorCallback(c *gin.Context) {
	if !h.casdoorEnabled() {
		response.NotFound(c, "not found")
		return
	}
	// Single-use: read the state, then clear it before anything can
	// fail, so a replay has nothing to present. Reading first also lets
	// a failure land on the login page of the workspace the flow
	// started in.
	rawState, _ := c.Cookie(casdoorStateCookie)
	setSecureCookieDomain(c, casdoorStateCookie, "", -1, casdoorStatePath,
		h.cookieDomain(), h.requestIsHTTPS(c), true)

	if c.Query("error") != "" {
		h.casdoorFail(c, "unavailable")
		return
	}
	code := c.Query("code")
	if code == "" {
		h.casdoorFail(c, "unavailable")
		return
	}
	st, err := h.parseCasdoorState(rawState)
	if err != nil {
		h.casdoorFail(c, "unavailable")
		return
	}
	if subtle.ConstantTimeCompare([]byte(st.State), []byte(c.Query("state"))) != 1 {
		h.casdoorFailAt(c, st.Tenant, "unavailable")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	// The callback is answered on the platform host, so the workspace
	// comes from the signed state, not from the host. A workspace that
	// was removed or suspended since the flow began stops here.
	var tenant *model.Tenant
	if st.Tenant != "" {
		t, terr := h.Store.FindTenantBySlug(ctx, st.Tenant)
		switch {
		case errors.Is(terr, sql.ErrNoRows):
			h.casdoorFailAt(c, "", "tenant_unavailable")
			return
		case terr != nil:
			slog.Error("casdoor: tenant lookup failed", "slug", st.Tenant, "error", terr)
			h.casdoorFailAt(c, "", "unavailable")
			return
		case !t.IsActive():
			h.casdoorFailAt(c, "", "tenant_suspended")
			return
		}
		tenant = t
	}
	tenantID := ""
	if tenant != nil && h.Config.TenantEnabled {
		tenantID = tenant.ID
	}

	tok, err := h.Casdoor.Exchange(ctx, code, st.Verifier)
	if err != nil {
		slog.Error("casdoor: token exchange failed", "error", err)
		h.casdoorFail(c, "unavailable")
		return
	}
	rawIDToken, _ := tok.Extra("id_token").(string)
	if rawIDToken == "" {
		h.casdoorFail(c, "unavailable")
		return
	}
	idToken, err := h.Casdoor.VerifyIDToken(ctx, rawIDToken, st.Nonce)
	if err != nil {
		slog.Warn("casdoor: id token rejected", "error", err)
		h.casdoorFail(c, "unavailable")
		return
	}
	ui, err := h.Casdoor.UserInfo(ctx, tok.AccessToken)
	if err != nil {
		slog.Error("casdoor: userinfo failed", "error", err)
		h.casdoorFail(c, "unavailable")
		return
	}
	// The two documents must describe one person: a mismatched subject
	// means the token and userinfo came from different accounts.
	if ui.Subject == "" || ui.Subject != idToken.Subject {
		h.casdoorFail(c, "unavailable")
		return
	}
	var idClaims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
	}
	_ = idToken.Claims(&idClaims)
	email := ui.Email
	if email == "" {
		email = strings.ToLower(strings.TrimSpace(idClaims.Email))
	}
	if email == "" {
		h.casdoorFail(c, "email_unverified")
		return
	}
	verified := ui.EmailVerified || idClaims.EmailVerified

	allowCreate := h.Identity.SignupAllowed(ctx, tenantID, email)
	user, outcome, err := h.Identity.Resolve(ctx, service.ProviderIdentity{
		Provider:      casdoorProvider,
		Subject:       ui.Subject,
		Email:         email,
		Name:          ui.Name,
		AvatarURL:     ui.Picture,
		EmailVerified: verified,
	}, service.ResolveOptions{
		AllowCreate: allowCreate,
		ActorType:   "casdoor",
		IP:          c.ClientIP(),
		TenantID:    tenantID,
	})
	if err != nil {
		switch {
		case errors.Is(err, store.ErrEmailNotVerified):
			h.casdoorFailAt(c, st.Tenant, "email_unverified")
		case errors.Is(err, store.ErrAccountNotAllowed):
			h.casdoorFailAt(c, st.Tenant, "not_allowed")
		case errors.Is(err, store.ErrIdentityConflict):
			h.casdoorFailAt(c, st.Tenant, "identity_conflict")
		default:
			slog.Error("casdoor: identity resolution failed", "error", err)
			h.casdoorFailAt(c, st.Tenant, "unavailable")
		}
		return
	}

	// A sign-in through a workspace's host signs the person into that
	// workspace only when they hold something in it: the binding above
	// just claimed their licence or seat, or they already did. Nobody is
	// pulled into a workspace merely for having an account.
	if tenant != nil && tenantID != "" {
		h.joinTenantAsAssetHolder(c, tenantID, user)
	}

	if h.Config.IsAdminEmail(user.Email) && user.Role == model.RoleUser {
		if role, err := h.Store.PromoteAdminEmail(c, user.ID); err == nil {
			user.Role = role
		}
	}
	if h.Email != nil && outcome == store.LinkIdentityCreated {
		h.Email.SendWelcome(user.Email, user.Name)
	}

	h.issueSession(c, user)
	c.Redirect(http.StatusFound, h.casdoorReturn(c, st.Tenant, st.Next))
}

// joinTenantAsAssetHolder gives the sign-in the lowest membership when
// it holds a licence or accepted seat in the workspace, including one
// the login just bound. An existing membership is left alone, and an
// account with nothing there stays out: the portal says so instead.
func (h *AuthHandler) joinTenantAsAssetHolder(c *gin.Context, tenantID string, user *model.User) {
	ctx := c.Request.Context()
	if _, err := h.Store.FindTenantMembership(ctx, tenantID, user.ID); err == nil {
		return
	} else if !errors.Is(err, sql.ErrNoRows) {
		slog.Warn("casdoor: membership lookup failed", "tenant_id", tenantID, "user_id", user.ID, "error", err)
		return
	}
	holds, err := h.Store.UserHoldsTenantAssets(ctx, tenantID, user.ID, user.Email)
	if err != nil {
		slog.Warn("casdoor: asset lookup failed", "tenant_id", tenantID, "user_id", user.ID, "error", err)
		return
	}
	if !holds {
		return
	}
	if err := h.Store.EnsureTenantMember(ctx, tenantID, user.ID); err != nil {
		slog.Warn("casdoor: could not add the asset holder to the workspace",
			"tenant_id", tenantID, "user_id", user.ID, "error", err)
		return
	}
	h.Store.Audit(ctx, &model.AuditLog{
		Entity: "tenant_member", EntityID: user.ID, Action: "tenant_member_added",
		ActorType: "casdoor", ActorID: user.ID, IPAddress: c.ClientIP(), TenantID: tenantID,
		Changes: map[string]any{"tenant_id": tenantID, "role": model.TenantRoleMember},
	})
}

// casdoorLoginTenant picks the workspace a login belongs to: the host
// the request came in on, or the ?tenant= slug the platform login page
// names. A slug the flow cannot resolve fails before the provider is
// contacted. nil with no code is a platform login.
func (h *AuthHandler) casdoorLoginTenant(c *gin.Context) (*model.Tenant, string) {
	if !h.Config.TenantEnabled {
		return nil, ""
	}
	slug := middleware.TenantSlugFrom(c)
	if middleware.IsPlatformContext(c) {
		slug = strings.ToLower(strings.TrimSpace(c.Query("tenant")))
		if slug == "" {
			return nil, ""
		}
		if !model.IsValidTenantSlug(slug) {
			return nil, "tenant_unavailable"
		}
	}
	if slug == "" {
		return nil, ""
	}
	t, err := h.Store.FindTenantBySlug(c, slug)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "tenant_unavailable"
	}
	if err != nil {
		slog.Error("casdoor: tenant lookup failed", "slug", slug, "error", err)
		return nil, "unavailable"
	}
	if !t.IsActive() {
		return nil, "tenant_suspended"
	}
	return t, ""
}

// casdoorReturn turns a path on the finished flow's site into a
// redirect the browser can follow. The provider callback is answered on
// the platform host, so a login that started for a tenant goes back to
// that tenant's origin; a same-host flow stays relative.
func (h *AuthHandler) casdoorReturn(c *gin.Context, tenantSlug, path string) string {
	if tenantSlug == "" || !h.Config.TenantEnabled {
		return path
	}
	if middleware.IsPlatformContext(c) || middleware.TenantSlugFrom(c) != tenantSlug {
		if base := strings.TrimRight(h.Config.TenantBaseURL(tenantSlug), "/"); base != "" {
			return base + path
		}
	}
	return path
}

func (h *AuthHandler) signCasdoorState(st casdoorState) (string, error) {
	payload, err := json.Marshal(st)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(payload)
	return body + "." + h.stateMAC(body), nil
}

func (h *AuthHandler) parseCasdoorState(raw string) (casdoorState, error) {
	var st casdoorState
	if raw == "" {
		return st, errors.New("missing state cookie")
	}
	body, sig, ok := strings.Cut(raw, ".")
	if !ok {
		return st, errors.New("malformed state cookie")
	}
	if subtle.ConstantTimeCompare([]byte(sig), []byte(h.stateMAC(body))) != 1 {
		return st, errors.New("state cookie signature mismatch")
	}
	payload, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return st, err
	}
	if err := json.Unmarshal(payload, &st); err != nil {
		return st, err
	}
	if time.Now().Unix() > st.Expires {
		return st, errors.New("state cookie expired")
	}
	if st.State == "" || st.Nonce == "" || st.Verifier == "" {
		return st, errors.New("state cookie incomplete")
	}
	return st, nil
}

func (h *AuthHandler) stateMAC(body string) string {
	mac := hmac.New(sha256.New, []byte(h.Config.JWTSecret))
	mac.Write([]byte(body))
	return hex.EncodeToString(mac.Sum(nil))
}

// casdoorFail sends the browser back to the current host's login page
// with a fixed code. The reason stays in the log; the query string
// never carries provider text.
func (h *AuthHandler) casdoorFail(c *gin.Context, code string) {
	h.casdoorFailAt(c, middleware.TenantSlugFrom(c), code)
}

// casdoorFailAt is casdoorFail for a flow whose workspace is known —
// from the state, on the platform callback — so the browser lands on
// that workspace's login page rather than the platform's.
func (h *AuthHandler) casdoorFailAt(c *gin.Context, tenantSlug, code string) {
	c.Redirect(http.StatusFound, h.casdoorReturn(c, tenantSlug, "/login?casdoor_error="+code))
}

// safeNextPath keeps the post-login redirect on this site. Only a
// site-relative path is accepted: no absolute URL, scheme-relative
// "//host", backslash (browsers treat it as "/"), or control characters.
func safeNextPath(raw string) string {
	const fallback = "/portal"
	if raw == "" || len(raw) > 512 {
		return fallback
	}
	if !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") {
		return fallback
	}
	if strings.Contains(raw, "\\") {
		return fallback
	}
	for _, r := range raw {
		if r < 0x20 || r == 0x7f {
			return fallback
		}
	}
	// Never bounce back into the login flow itself.
	if raw == "/login" || strings.HasPrefix(raw, "/login?") {
		return fallback
	}
	return raw
}
