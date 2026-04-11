package node

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"metis/internal/handler"
)

const contextKeyNodeID = "nodeID"

// NodeTokenMiddleware creates a Gin middleware that authenticates Sidecar requests using Node Token.
func NodeTokenMiddleware(nodeRepo *NodeRepo) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			handler.Fail(c, http.StatusUnauthorized, "missing or invalid authorization header")
			c.Abort()
			return
		}

		raw := strings.TrimPrefix(auth, "Bearer ")
		prefix := ExtractTokenPrefix(raw)
		if prefix == "" {
			handler.Fail(c, http.StatusUnauthorized, "invalid token format")
			c.Abort()
			return
		}

		// Find nodes matching the prefix
		nodes, err := nodeRepo.FindByTokenPrefix(prefix)
		if err != nil || len(nodes) == 0 {
			handler.Fail(c, http.StatusUnauthorized, "invalid token")
			c.Abort()
			return
		}

		// Verify against bcrypt hash
		for _, n := range nodes {
			if ValidateNodeToken(raw, n.TokenHash) {
				if n.Status == NodeStatusPending || n.Status == NodeStatusOnline || n.Status == NodeStatusOffline {
					c.Set(contextKeyNodeID, n.ID)
					c.Next()
					return
				}
			}
		}

		handler.Fail(c, http.StatusUnauthorized, "invalid token")
		c.Abort()
	}
}

// GetNodeID extracts the node ID from the Gin context (set by NodeTokenMiddleware).
func GetNodeID(c *gin.Context) uint {
	id, _ := c.Get(contextKeyNodeID)
	if v, ok := id.(uint); ok {
		return v
	}
	return 0
}
