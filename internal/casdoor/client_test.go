package casdoor

import (
	"context"
	"testing"
)

func TestVerifyIDTokenForAudiencesRefusesWithoutAudiences(t *testing.T) {
	c := New(Config{IssuerURL: "http://127.0.0.1:9", ClientID: "web"})
	// The check is local: no discovery or network is attempted.
	if _, err := c.VerifyIDTokenForAudiences(context.Background(), "token", nil); err == nil {
		t.Fatal("expected an error when no audience is configured")
	}
}
