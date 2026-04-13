package observe

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"metis/internal/handler"
)

// IntegrationTokenMiddleware authenticates requests using an Integration Token.
// Sets "observeUserID" and "observeTokenID" in the Gin context on success.
func IntegrationTokenMiddleware(svc *IntegrationTokenService) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			handler.Fail(c, http.StatusUnauthorized, "missing or invalid authorization header")
			c.Abort()
			return
		}

		raw := strings.TrimPrefix(auth, "Bearer ")
		result, err := svc.Verify(raw)
		if err != nil {
			handler.Fail(c, http.StatusUnauthorized, "invalid token")
			c.Abort()
			return
		}

		c.Set("observeUserID", result.UserID)
		c.Set("observeTokenID", result.TokenID)
		c.Next()
	}
}
