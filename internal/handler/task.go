package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"metis/internal/service"
)

type TaskHandler struct {
	svc *service.TaskService
}

func (h *TaskHandler) ListTasks(c *gin.Context) {
	taskType := c.Query("type")
	ctx := c.Request.Context()

	infos, err := h.svc.ListTasks(ctx, taskType)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "failed to list tasks")
		return
	}

	OK(c, infos)
}

func (h *TaskHandler) GetTask(c *gin.Context) {
	name := c.Param("name")
	ctx := c.Request.Context()

	info, execs, err := h.svc.GetTask(ctx, name)
	if err != nil {
		Fail(c, http.StatusNotFound, "task not found")
		return
	}

	OK(c, gin.H{
		"task":             info,
		"recentExecutions": execs,
	})
}

func (h *TaskHandler) ListExecutions(c *gin.Context) {
	name := c.Param("name")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	execs, total, err := h.svc.ListExecutions(c.Request.Context(), name, page, pageSize)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "failed to list executions")
		return
	}

	OK(c, gin.H{
		"list":     execs,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *TaskHandler) GetStats(c *gin.Context) {
	stats, err := h.svc.GetStats(c.Request.Context())
	if err != nil {
		Fail(c, http.StatusInternalServerError, "failed to get stats")
		return
	}
	OK(c, stats)
}

func (h *TaskHandler) PauseTask(c *gin.Context) {
	name := c.Param("name")
	if err := h.svc.PauseTask(name); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OK(c, nil)
}

func (h *TaskHandler) ResumeTask(c *gin.Context) {
	name := c.Param("name")
	if err := h.svc.ResumeTask(name); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OK(c, nil)
}

func (h *TaskHandler) TriggerTask(c *gin.Context) {
	name := c.Param("name")
	exec, err := h.svc.TriggerTask(name)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OK(c, gin.H{"executionId": exec.ID})
}
