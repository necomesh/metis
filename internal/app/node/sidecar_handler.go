package node

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"

	"metis/internal/handler"
)

type AckCommandRequest struct {
	Success bool   `json:"success"`
	Result  string `json:"result"`
}

type SidecarHandler struct {
	nodeRepo   *NodeRepo
	sidecarSvc *SidecarService
}

func NewSidecarHandler(i do.Injector) (*SidecarHandler, error) {
	return &SidecarHandler{
		nodeRepo:   do.MustInvoke[*NodeRepo](i),
		sidecarSvc: do.MustInvoke[*SidecarService](i),
	}, nil
}

// TokenAuth returns a middleware that authenticates via Node Token.
func (h *SidecarHandler) TokenAuth() gin.HandlerFunc {
	return NodeTokenMiddleware(h.nodeRepo)
}

func (h *SidecarHandler) Register(c *gin.Context) {
	nodeID := GetNodeID(c)

	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.sidecarSvc.Register(nodeID, req); err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	handler.OK(c, gin.H{"nodeId": nodeID})
}

func (h *SidecarHandler) Heartbeat(c *gin.Context) {
	nodeID := GetNodeID(c)

	var req HeartbeatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.sidecarSvc.Heartbeat(nodeID, req); err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	handler.OK(c, nil)
}

func (h *SidecarHandler) PollCommands(c *gin.Context) {
	nodeID := GetNodeID(c)

	// Long-polling: check for pending commands, wait up to 30s
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		cmds, err := h.sidecarSvc.PollCommands(nodeID)
		if err != nil {
			handler.Fail(c, http.StatusInternalServerError, err.Error())
			return
		}
		if len(cmds) > 0 {
			result := make([]NodeCommandResponse, len(cmds))
			for i, cmd := range cmds {
				result[i] = cmd.ToResponse()
			}
			handler.OK(c, result)
			return
		}

		select {
		case <-ctx.Done():
			handler.OK(c, []any{})
			return
		case <-ticker.C:
			continue
		}
	}
}

func (h *SidecarHandler) AckCommand(c *gin.Context) {
	nodeID := GetNodeID(c)

	cmdIDStr := c.Param("id")
	cmdID, err := strconv.ParseUint(cmdIDStr, 10, 64)
	if err != nil {
		handler.Fail(c, http.StatusBadRequest, "invalid command id")
		return
	}

	var req AckCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.sidecarSvc.AckCommand(uint(cmdID), nodeID, req.Success, req.Result); err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	handler.OK(c, nil)
}

func (h *SidecarHandler) DownloadConfig(c *gin.Context) {
	nodeID := GetNodeID(c)
	processName := c.Param("name")

	rendered, hash, err := h.sidecarSvc.RenderConfig(nodeID, processName)
	if err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Header("X-Config-Hash", hash)
	c.String(http.StatusOK, rendered)
}
