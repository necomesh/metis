package ai

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"

	"metis/internal/handler"
)

// KnowledgeQueryHandler serves the Agent-facing knowledge API.
// Routes are authenticated via NodeTokenMiddleware (Sidecar token).
type KnowledgeQueryHandler struct {
	nodeRepo *KnowledgeNodeRepo
	edgeRepo *KnowledgeEdgeRepo
}

func NewKnowledgeQueryHandler(i do.Injector) (*KnowledgeQueryHandler, error) {
	return &KnowledgeQueryHandler{
		nodeRepo: do.MustInvoke[*KnowledgeNodeRepo](i),
		edgeRepo: do.MustInvoke[*KnowledgeEdgeRepo](i),
	}, nil
}

// Search searches knowledge nodes by title/summary.
// GET /api/v1/ai/knowledge/search?q=&kb_id=&limit=
func (h *KnowledgeQueryHandler) Search(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		handler.Fail(c, http.StatusBadRequest, "query parameter 'q' is required")
		return
	}

	kbID, _ := strconv.Atoi(c.Query("kb_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	nodes, err := h.nodeRepo.SearchNodes(uint(kbID), q, limit)
	if err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	resp := make([]KnowledgeNodeResponse, len(nodes))
	for i, n := range nodes {
		r := n.ToResponse()
		edgeCount, _ := h.edgeRepo.CountByNodeID(n.ID)
		r.EdgeCount = int(edgeCount)
		// Omit full content in search results
		r.Content = nil
		resp[i] = r
	}
	handler.OK(c, resp)
}

// GetNode returns full node details including content.
// GET /api/v1/ai/knowledge/nodes/:id
func (h *KnowledgeQueryHandler) GetNode(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	node, err := h.nodeRepo.FindByID(uint(id))
	if err != nil {
		handler.Fail(c, http.StatusNotFound, "node not found")
		return
	}

	resp := node.ToResponse()
	edgeCount, _ := h.edgeRepo.CountByNodeID(node.ID)
	resp.EdgeCount = int(edgeCount)

	handler.OK(c, resp)
}

// GetNodeGraph returns N-hop subgraph around a node.
// GET /api/v1/ai/knowledge/nodes/:id/graph?depth=
func (h *KnowledgeQueryHandler) GetNodeGraph(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	depth, _ := strconv.Atoi(c.DefaultQuery("depth", "1"))

	nodes, edges, err := h.nodeRepo.GetGraphNodes(uint(id), depth)
	if err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	nodeResps := make([]KnowledgeNodeResponse, len(nodes))
	for i, n := range nodes {
		nodeResps[i] = n.ToResponse()
	}

	edgeResps := make([]KnowledgeEdgeResponse, len(edges))
	for i, e := range edges {
		edgeResps[i] = e.ToResponse()
	}

	handler.OK(c, gin.H{"nodes": nodeResps, "edges": edgeResps})
}
