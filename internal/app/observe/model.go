package observe

import "time"

// IntegrationToken represents a user-owned token used to authenticate
// OTLP data ingestion via Traefik ForwardAuth.
type IntegrationToken struct {
	ID          uint       `json:"id"          gorm:"primaryKey"`
	UserID      uint       `json:"userId"      gorm:"not null;index"`
	OrgID       *uint      `json:"orgId"       gorm:"index"` // reserved for org-level tokens
	Scope       string     `json:"scope"       gorm:"not null;default:'personal';size:32"`
	Name        string     `json:"name"        gorm:"not null;size:100"`
	TokenHash   string     `json:"-"           gorm:"not null;size:255"`
	TokenPrefix string     `json:"prefix"      gorm:"not null;size:16;index"`
	LastUsedAt  *time.Time `json:"lastUsedAt"`
	RevokedAt   *time.Time `json:"revokedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// TokenResponse is returned to clients — never includes hash or full token.
type TokenResponse struct {
	ID         uint       `json:"id"`
	Name       string     `json:"name"`
	Prefix     string     `json:"prefix"`
	Scope      string     `json:"scope"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
	CreatedAt  time.Time  `json:"createdAt"`
}

func (t *IntegrationToken) ToResponse() TokenResponse {
	return TokenResponse{
		ID:         t.ID,
		Name:       t.Name,
		Prefix:     t.TokenPrefix,
		Scope:      t.Scope,
		LastUsedAt: t.LastUsedAt,
		CreatedAt:  t.CreatedAt,
	}
}

// CreateTokenResponse is returned only once at creation time.
type CreateTokenResponse struct {
	TokenResponse
	Token string `json:"token"` // plaintext, shown once
}
