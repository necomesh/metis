package ai

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/samber/do/v2"

	"metis/internal/handler"
)

type KnowledgeNodeHandler struct {
	graphRepo *KnowledgeGraphRepo
	logRepo   *KnowledgeLogRepo
}

func NewKnowledgeNodeHandler(i do.Injector) (*KnowledgeNodeHandler, error) {
	return &KnowledgeNodeHandler{
		graphRepo: do.MustInvoke[*KnowledgeGraphRepo](i),
		logRepo:   do.MustInvoke[*KnowledgeLogRepo](i),
	}, nil
}

func (h *KnowledgeNodeHandler) List(c *gin.Context) {
	kbID, _ := strconv.Atoi(c.Param("id"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	items, total, err := h.graphRepo.ListNodes(
		uint(kbID),
		c.Query("keyword"),
		c.Query("nodeType"),
		page, pageSize,
	)
	if err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	resp := make([]KnowledgeNodeResponse, len(items))
	for i, n := range items {
		resp[i] = n.ToResponse()
		edgeCount, _ := h.graphRepo.CountEdgesForNode(uint(kbID), n.ID)
		resp[i].EdgeCount = edgeCount
	}
	handler.OK(c, gin.H{"items": resp, "total": total})
}

func (h *KnowledgeNodeHandler) Get(c *gin.Context) {
	kbID, _ := strconv.Atoi(c.Param("id"))
	nid := c.Param("nid")

	node, err := h.graphRepo.FindNodeByID(uint(kbID), nid)
	if err != nil {
		handler.Fail(c, http.StatusNotFound, "node not found")
		return
	}

	resp := node.ToResponse()
	edgeCount, _ := h.graphRepo.CountEdgesForNode(uint(kbID), node.ID)
	resp.EdgeCount = edgeCount

	handler.OK(c, resp)
}

func (h *KnowledgeNodeHandler) GetGraph(c *gin.Context) {
	kbID, _ := strconv.Atoi(c.Param("id"))
	nid := c.Param("nid")
	depth, _ := strconv.Atoi(c.DefaultQuery("depth", "1"))

	nodes, edges, err := h.graphRepo.GetSubgraph(uint(kbID), nid, depth)
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

func (h *KnowledgeNodeHandler) GetFullGraph(c *gin.Context) {
	kbID, _ := strconv.Atoi(c.Param("id"))

	nodes, edges, err := h.graphRepo.GetFullGraph(uint(kbID))
	if err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Compute edge counts from loaded edges
	edgeCounts := make(map[string]int)
	for _, e := range edges {
		edgeCounts[e.FromNodeID]++
		edgeCounts[e.ToNodeID]++
	}

	nodeResps := make([]KnowledgeNodeResponse, len(nodes))
	for i, n := range nodes {
		nodeResps[i] = n.ToResponse()
		nodeResps[i].EdgeCount = edgeCounts[n.ID]
	}

	edgeResps := make([]KnowledgeEdgeResponse, len(edges))
	for i, e := range edges {
		edgeResps[i] = e.ToResponse()
	}

	handler.OK(c, gin.H{"nodes": nodeResps, "edges": edgeResps})
}

func (h *KnowledgeNodeHandler) ListLogs(c *gin.Context) {
	kbID, _ := strconv.Atoi(c.Param("id"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	items, total, err := h.logRepo.List(uint(kbID), page, pageSize)
	if err != nil {
		handler.Fail(c, http.StatusInternalServerError, err.Error())
		return
	}

	handler.OK(c, gin.H{"items": items, "total": total})
}
