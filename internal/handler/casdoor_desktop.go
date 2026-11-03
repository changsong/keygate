package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tabloy/keygate/internal/casdoor"
	"github.com/tabloy/keygate/internal/model"
	"github.com/tabloy/keygate/internal/service"
	"github.com/tabloy/keygate/internal/store"
	"github.com/tabloy/keygate/pkg/response"
)

// casdoorExchangeMaxBody bounds the exchange body: one or two tokens,
// nothing else.
const casdoorExchangeMaxBody = 8 << 10

// CasdoorExchange trades a Casdoor token a desktop client obtained
// directly (device flow or loopback PKCE) for a Keygate session. The
// native client never sees the web client secret: it presents either
// the Casdoor access token or an ID token minted for one of
// CASDOOR_DESKTOP_CLIENT_IDS, and gets a Keygate JWT plus a refresh
// token back in JSON rather than cookies.
func (h *AuthHandler) CasdoorExchange(c *gin.Context) {
	if !h.casdoorEnabled() {
		response.NotFound(c, "not found")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, casdoorExchangeMaxBody)
	var req struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "access_token or id_token is required")
		return
	}
	access := strings.TrimSpace(req.AccessToken)
	rawIDToken := strings.TrimSpace(req.IDToken)
	if access == "" && rawIDToken == "" {
		response.BadRequest(c, "access_token or id_token is required")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	var identity service.ProviderIdentity
	if access != "" {
		ui, err := h.Casdoor.UserInfo(ctx, access)
		if err != nil {
			h.desktopTokenError(c, err)
			return
		}
		name := ui.Name
		if name == "" {
			name = ui.PreferredUsername
		}
		identity = service.ProviderIdentity{
			Provider: casdoorProvider, Subject: ui.Subject, Email: ui.Email,
			Name: name, AvatarURL: ui.Picture, EmailVerified: ui.EmailVerified,
		}
	} else {
		if len(h.Config.CasdoorDesktopClientIDs) == 0 {
			response.BadRequest(c, "id_token login is not configured")
			return
		}
		tok, err := h.Casdoor.VerifyIDTokenForAudiences(ctx, rawIDToken, h.Config.CasdoorDesktopClientIDs)
		if err != nil {
			h.desktopTokenError(c, err)
			return
		}
		var claims struct {
			Email             string `json:"email"`
			EmailVerified     bool   `json:"email_verified"`
			EmailVerifiedAlt  bool   `json:"emailVerified"`
			Name              string `json:"name"`
			PreferredUsername string `json:"preferred_username"`
			DisplayName       string `json:"displayName"`
			Picture           string `json:"picture"`
		}
		_ = tok.Claims(&claims)
		name := claims.Name
		if name == "" {
			name = claims.DisplayName
		}
		if name == "" {
			name = claims.PreferredUsername
		}
		identity = service.ProviderIdentity{
			Provider: casdoorProvider, Subject: tok.Subject,
			Email: strings.ToLower(strings.TrimSpace(claims.Email)),
			Name:  name, AvatarURL: claims.Picture,
			EmailVerified: claims.EmailVerified || claims.EmailVerifiedAlt,
		}
	}
	if identity.Subject == "" {
		response.Unauthorized(c, "invalid token")
		return
	}

	// AllowCreate matches an interactive sign-in: the person already
	// authenticated with Casdoor, so this is their first Keygate visit,
	// not an anonymous account creation. EmailVerified still gates the
	// email-matching step inside LinkIdentity; an already linked subject
	// signs in regardless.
	user, _, err := h.Identity.Resolve(ctx, identity, service.ResolveOptions{
		AllowCreate: true,
		ActorType:   "casdoor_desktop",
		IP:          c.ClientIP(),
	})
	if err != nil {
		switch {
		case errors.Is(err, store.ErrEmailNotVerified):
			response.Forbidden(c, "email not verified")
		case errors.Is(err, store.ErrAccountNotAllowed):
			response.Forbidden(c, "account not allowed")
		case errors.Is(err, store.ErrIdentityConflict):
			response.Conflict(c, "IDENTITY_CONFLICT",
				"this email is linked to a different Casdoor account", nil)
		default:
			response.Internal(c, err)
		}
		return
	}
	if h.Config.IsAdminEmail(user.Email) && user.Role == model.RoleUser {
		if role, err := h.Store.PromoteAdminEmail(c, user.ID); err == nil {
			user.Role = role
		}
	}

	rawRefresh := randomHex(32)
	if err := h.Store.CreateRefreshToken(ctx, user.ID, hashToken(rawRefresh), time.Now().Add(refreshTokenTTL)); err != nil {
		response.Internal(c, err)
		return
	}
	h.replySessionTokens(c, user, rawRefresh)
}

// desktopTokenError separates "Casdoor could not be reached" (503, the
// client may retry) from "the token is not good" (401).
func (h *AuthHandler) desktopTokenError(c *gin.Context, err error) {
	if errors.Is(err, casdoor.ErrProviderUnavailable) {
		response.Err(c, http.StatusServiceUnavailable, "PROVIDER_UNAVAILABLE", "casdoor is unavailable")
		return
	}
	response.Unauthorized(c, "invalid token")
}
