package model

import (
	"slices"
	"strings"
	"time"

	"github.com/uptrace/bun"
)

const (
	// DefaultTenantID is the tenant every pre-multi-tenant row belongs to.
	// It is seeded by the migration and cannot be removed.
	DefaultTenantID   = "t_default"
	DefaultTenantSlug = "default"

	TenantStatusActive    = "active"
	TenantStatusSuspended = "suspended"

	TenantRoleOwner  = "owner"
	TenantRoleAdmin  = "admin"
	TenantRoleMember = "member"
)

// Tenant is one customer workspace. Users are global; membership is what
// grants access to a tenant's data.
type Tenant struct {
	bun.BaseModel `bun:"table:tenants"`

	ID        string    `bun:",pk" json:"id"`
	Slug      string    `bun:",notnull" json:"slug"`
	Name      string    `bun:",notnull,default:''" json:"name"`
	Status    string    `bun:",notnull,default:'active'" json:"status"`
	CreatedAt time.Time `bun:",nullzero,default:now()" json:"created_at"`
	UpdatedAt time.Time `bun:",nullzero,default:now()" json:"updated_at"`
}

func (t *Tenant) IsActive() bool {
	return t != nil && t.Status == TenantStatusActive
}

// TenantMember ties a global account to a tenant and carries the role it
// holds there. users.role stays the platform role.
type TenantMember struct {
	bun.BaseModel `bun:"table:tenant_members"`

	TenantID  string    `bun:",pk,notnull" json:"tenant_id"`
	UserID    string    `bun:",pk,notnull" json:"user_id"`
	Role      string    `bun:",notnull,default:'member'" json:"role"`
	CreatedAt time.Time `bun:",nullzero,default:now()" json:"created_at"`

	Tenant *Tenant `bun:"rel:belongs-to,join:tenant_id=id" json:"tenant,omitempty"`
	User   *User   `bun:"rel:belongs-to,join:user_id=id" json:"user,omitempty"`
}

func (m *TenantMember) IsAdmin() bool {
	return m != nil && (m.Role == TenantRoleOwner || m.Role == TenantRoleAdmin)
}

// IsValidTenantRole reports whether role is one a tenant member may
// hold. Platform roles (users.role) are a separate scale.
func IsValidTenantRole(role string) bool {
	switch role {
	case TenantRoleOwner, TenantRoleAdmin, TenantRoleMember:
		return true
	}
	return false
}

// ReservedTenantSlugs are host labels with another meaning or a tempting
// target: the platform console, static assets, mail.
var ReservedTenantSlugs = []string{
	"app", "www", "api", "admin", "static", "assets", "cdn", "mail", "smtp",
}

// IsValidTenantSlug reports whether s can be the first host label of a
// tenant URL: 2-32 lower-case letters, digits or hyphens, starting and
// ending alphanumeric, and not reserved.
func IsValidTenantSlug(s string) bool {
	if len(s) < 2 || len(s) > 32 || slices.Contains(ReservedTenantSlugs, s) {
		return false
	}
	if s[0] == '-' || s[len(s)-1] == '-' {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-':
		default:
			return false
		}
	}
	return !strings.Contains(s, "..")
}
