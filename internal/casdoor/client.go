// Package casdoor is a small OIDC client for Casdoor. It discovers the
// provider once, verifies ID tokens and userinfo, and exposes just the
// Casdoor admin API calls Keygate needs (list/get users for the daily
// reconciliation).
package casdoor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
)

// ErrProviderUnavailable means discovery, token exchange or userinfo
// could not be reached. Callers answer 503 rather than treating it as a
// bad credential.
var ErrProviderUnavailable = errors.New("casdoor provider unavailable")

type Config struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	RedirectURL  string
	Scopes       []string
}

type Client struct {
	cfg        Config
	httpClient *http.Client

	mu       sync.Mutex
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
}

func New(cfg Config) *Client {
	if len(cfg.Scopes) == 0 {
		cfg.Scopes = []string{oidc.ScopeOpenID, "profile", "email"}
	}
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) Config() Config { return c.cfg }

// ensureProvider discovers endpoints and JWKS once. A failed discovery
// is not cached, so the next request retries.
func (c *Client) ensureProvider(ctx context.Context) (*oidc.Provider, *oidc.IDTokenVerifier, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.provider != nil && c.verifier != nil {
		return c.provider, c.verifier, nil
	}
	ctx = oidc.ClientContext(ctx, c.httpClient)
	p, err := oidc.NewProvider(ctx, c.cfg.IssuerURL)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: discovery: %v", ErrProviderUnavailable, err)
	}
	c.provider = p
	c.verifier = p.Verifier(&oidc.Config{ClientID: c.cfg.ClientID})
	return c.provider, c.verifier, nil
}

func (c *Client) oauthConfig(endpoint oauth2.Endpoint) oauth2.Config {
	return oauth2.Config{
		ClientID:     c.cfg.ClientID,
		ClientSecret: c.cfg.ClientSecret,
		Endpoint:     endpoint,
		RedirectURL:  c.cfg.RedirectURL,
		Scopes:       c.cfg.Scopes,
	}
}

// AuthCodeURL builds the authorization redirect with PKCE S256 and a
// nonce bound into the ID token.
func (c *Client) AuthCodeURL(state, nonce, verifier string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	p, _, err := c.ensureProvider(ctx)
	if err != nil {
		return "", err
	}
	oc := c.oauthConfig(p.Endpoint())
	return oc.AuthCodeURL(state,
		oidc.Nonce(nonce),
		oauth2.S256ChallengeOption(verifier),
	), nil
}

func (c *Client) Exchange(ctx context.Context, code, verifier string) (*oauth2.Token, error) {
	p, _, err := c.ensureProvider(ctx)
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, c.httpClient)
	oc := c.oauthConfig(p.Endpoint())
	tok, err := oc.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, fmt.Errorf("%w: token exchange: %v", ErrProviderUnavailable, err)
	}
	return tok, nil
}

// VerifyIDToken checks signature, issuer, audience and expiry (the
// verifier does all of it), then the nonce and a non-empty subject.
func (c *Client) VerifyIDToken(ctx context.Context, rawIDToken, nonce string) (*oidc.IDToken, error) {
	_, v, err := c.ensureProvider(ctx)
	if err != nil {
		return nil, err
	}
	tok, err := v.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("invalid id token: %w", err)
	}
	if nonce != "" && tok.Nonce != nonce {
		return nil, errors.New("id token nonce mismatch")
	}
	if tok.Subject == "" {
		return nil, errors.New("id token has no subject")
	}
	return tok, nil
}

// VerifyIDTokenForAudiences verifies signature, issuer and expiry
// against the provider's JWKS and requires the token's audience to be
// one of the given client ids. It is the desktop path: a native client
// gets its token from Casdoor directly, so its audience is the desktop
// client id rather than this server's.
func (c *Client) VerifyIDTokenForAudiences(ctx context.Context, rawIDToken string, audiences []string) (*oidc.IDToken, error) {
	if len(audiences) == 0 {
		return nil, errors.New("no accepted audiences configured")
	}
	p, _, err := c.ensureProvider(ctx)
	if err != nil {
		return nil, err
	}
	// The provider's verifier pins this server's client id; a desktop
	// token names a different one, so the audience is checked below.
	tok, err := p.Verifier(&oidc.Config{SkipClientIDCheck: true}).Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("invalid id token: %w", err)
	}
	for _, aud := range tok.Audience {
		for _, allowed := range audiences {
			if aud == allowed {
				return tok, nil
			}
		}
	}
	return nil, errors.New("id token audience not accepted")
}

// UserInfo is the subset of claims Keygate consumes.
type UserInfo struct {
	Subject           string
	Email             string
	EmailVerified     bool
	Name              string
	PreferredUsername string
	Picture           string
}

// UserInfo reads the provider's userinfo endpoint. Casdoor answers in
// OIDC casing (`email_verified`); its REST API uses camelCase. The
// library maps the standard claims, and the extra claims cover the
// names Casdoor may emit instead.
func (c *Client) UserInfo(ctx context.Context, accessToken string) (*UserInfo, error) {
	p, _, err := c.ensureProvider(ctx)
	if err != nil {
		return nil, err
	}
	ctx = oidc.ClientContext(ctx, c.httpClient)
	ui, err := p.UserInfo(ctx, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: accessToken}))
	if err != nil {
		return nil, fmt.Errorf("%w: userinfo: %v", ErrProviderUnavailable, err)
	}
	out := &UserInfo{
		Subject:       ui.Subject,
		Email:         strings.ToLower(strings.TrimSpace(ui.Email)),
		EmailVerified: ui.EmailVerified,
	}
	var extra struct {
		Name              string `json:"name"`
		PreferredUsername string `json:"preferred_username"`
		DisplayName       string `json:"displayName"`
		Picture           string `json:"picture"`
		Avatar            string `json:"avatar"`
	}
	if err := ui.Claims(&extra); err == nil {
		out.Name = extra.Name
		if out.Name == "" {
			out.Name = extra.DisplayName
		}
		out.PreferredUsername = extra.PreferredUsername
		if out.Name == "" {
			out.Name = extra.PreferredUsername
		}
		out.Picture = extra.Picture
		if out.Picture == "" {
			out.Picture = extra.Avatar
		}
	}
	return out, nil
}

// CasdoorUser is the admin API's user shape.
type CasdoorUser struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Owner         string `json:"owner"`
	DisplayName   string `json:"displayName"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"emailVerified"`
	Avatar        string `json:"avatar"`
}

func (u CasdoorUser) ProviderIdentity() (subject, email, name, avatar string, verified bool) {
	name = u.DisplayName
	if name == "" {
		name = u.Name
	}
	return u.ID, strings.ToLower(strings.TrimSpace(u.Email)), name, u.Avatar, u.EmailVerified
}

// ListUsers pages through an organization's users with a client
// credentials token. The caller stops when a short page comes back.
func (c *Client) ListUsers(ctx context.Context, org string, page, pageSize int) ([]CasdoorUser, error) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 100
	}
	token, err := c.clientCredentialsToken(ctx)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("owner", org)
	q.Set("p", strconv.Itoa(page))
	q.Set("pageSize", strconv.Itoa(pageSize))
	endpoint := strings.TrimRight(c.cfg.IssuerURL, "/") + "/api/get-users?" + q.Encode()

	var resp struct {
		Status string        `json:"status"`
		Msg    string        `json:"msg"`
		Data   []CasdoorUser `json:"data"`
	}
	if err := c.getJSON(ctx, token, endpoint, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "" && resp.Status != "ok" {
		return nil, fmt.Errorf("%w: get-users: %s", ErrProviderUnavailable, resp.Msg)
	}
	return resp.Data, nil
}

// GetUser reads one user by its subject (user.id).
func (c *Client) GetUser(ctx context.Context, org, userID string) (*CasdoorUser, error) {
	token, err := c.clientCredentialsToken(ctx)
	if err != nil {
		return nil, err
	}
	q := url.Values{}
	q.Set("owner", org)
	q.Set("userId", userID)
	endpoint := strings.TrimRight(c.cfg.IssuerURL, "/") + "/api/get-user?" + q.Encode()

	var resp struct {
		Status string       `json:"status"`
		Msg    string       `json:"msg"`
		Data   *CasdoorUser `json:"data"`
	}
	if err := c.getJSON(ctx, token, endpoint, &resp); err != nil {
		return nil, err
	}
	if resp.Status != "" && resp.Status != "ok" {
		return nil, fmt.Errorf("%w: get-user: %s", ErrProviderUnavailable, resp.Msg)
	}
	if resp.Data == nil {
		return nil, errors.New("casdoor user not found")
	}
	return resp.Data, nil
}

func (c *Client) clientCredentialsToken(ctx context.Context) (string, error) {
	p, _, err := c.ensureProvider(ctx)
	if err != nil {
		return "", err
	}
	ctx = context.WithValue(ctx, oauth2.HTTPClient, c.httpClient)
	cfg := clientcredentials.Config{
		ClientID:     c.cfg.ClientID,
		ClientSecret: c.cfg.ClientSecret,
		TokenURL:     p.Endpoint().TokenURL,
	}
	tok, err := cfg.Token(ctx)
	if err != nil {
		return "", fmt.Errorf("%w: client credentials: %v", ErrProviderUnavailable, err)
	}
	return tok.AccessToken, nil
}

func (c *Client) getJSON(ctx context.Context, token, endpoint string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrProviderUnavailable, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrProviderUnavailable, err)
	}
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("%w: %s answered %d", ErrProviderUnavailable, endpoint, resp.StatusCode)
	}
	if err := json.Unmarshal(body, dst); err != nil {
		return fmt.Errorf("%w: decode: %v", ErrProviderUnavailable, err)
	}
	return nil
}
