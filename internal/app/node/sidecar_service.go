package node

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"text/template"
	"time"

	"github.com/samber/do/v2"
)

const (
	heartbeatTimeout = 30 * time.Second
	commandTimeout   = 5 * time.Minute
)

type SidecarService struct {
	nodeRepo        *NodeRepo
	processDefRepo  *ProcessDefRepo
	nodeProcessRepo *NodeProcessRepo
	commandRepo     *NodeCommandRepo
}

func NewSidecarService(i do.Injector) (*SidecarService, error) {
	return &SidecarService{
		nodeRepo:        do.MustInvoke[*NodeRepo](i),
		processDefRepo:  do.MustInvoke[*ProcessDefRepo](i),
		nodeProcessRepo: do.MustInvoke[*NodeProcessRepo](i),
		commandRepo:     do.MustInvoke[*NodeCommandRepo](i),
	}, nil
}

type RegisterRequest struct {
	SystemInfo   json.RawMessage `json:"systemInfo"`
	Capabilities json.RawMessage `json:"capabilities"`
	Version      string          `json:"version"`
}

func (s *SidecarService) Register(nodeID uint, req RegisterRequest) error {
	now := time.Now()
	return s.nodeRepo.Update(nodeID, map[string]any{
		"status":         NodeStatusOnline,
		"system_info":    JSONMap(req.SystemInfo),
		"capabilities":   JSONMap(req.Capabilities),
		"version":        req.Version,
		"last_heartbeat": &now,
	})
}

type HeartbeatRequest struct {
	Processes []ProcessStatus `json:"processes"`
	Version   string          `json:"version"`
}

type ProcessStatus struct {
	ProcessDefID  uint            `json:"processDefId"`
	Status        string          `json:"status"`
	PID           int             `json:"pid"`
	ConfigVersion string          `json:"configVersion"`
	ProbeResult   json.RawMessage `json:"probeResult,omitempty"`
}

func (s *SidecarService) Heartbeat(nodeID uint, req HeartbeatRequest) error {
	now := time.Now()
	if err := s.nodeRepo.Update(nodeID, map[string]any{
		"status":         NodeStatusOnline,
		"last_heartbeat": &now,
		"version":        req.Version,
	}); err != nil {
		return err
	}

	// Sync process statuses
	for _, ps := range req.Processes {
		np, err := s.nodeProcessRepo.FindByNodeAndProcessDef(nodeID, ps.ProcessDefID)
		if err != nil {
			continue
		}
		_ = s.nodeProcessRepo.UpdateStatus(np.ID, ps.Status, ps.PID)
		if ps.ConfigVersion != "" {
			_ = s.nodeProcessRepo.UpdateConfigVersion(np.ID, ps.ConfigVersion)
		}
		if len(ps.ProbeResult) > 0 {
			_ = s.nodeProcessRepo.UpdateProbe(np.ID, JSONMap(ps.ProbeResult))
		}
	}
	return nil
}

func (s *SidecarService) PollCommands(nodeID uint) ([]NodeCommand, error) {
	return s.commandRepo.FindPendingByNodeID(nodeID)
}

func (s *SidecarService) AckCommand(commandID uint, nodeID uint, success bool, result string) error {
	cmd, err := s.commandRepo.FindByID(commandID)
	if err != nil {
		return err
	}
	if cmd.NodeID != nodeID {
		return fmt.Errorf("command does not belong to this node")
	}

	if success {
		return s.commandRepo.Ack(commandID, result)
	}
	return s.commandRepo.Fail(commandID, result)
}

type ConfigFile struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
}

func (s *SidecarService) RenderConfig(nodeID uint, processName string) (string, string, error) {
	node, err := s.nodeRepo.FindByID(nodeID)
	if err != nil {
		return "", "", err
	}

	pd, err := s.processDefRepo.FindByName(processName)
	if err != nil {
		return "", "", fmt.Errorf("process definition %q not found", processName)
	}

	// Parse config files from ProcessDef
	var configFiles []ConfigFile
	if err := json.Unmarshal([]byte(pd.ConfigFiles), &configFiles); err != nil || len(configFiles) == 0 {
		return "", "", fmt.Errorf("no config files defined for process %q", processName)
	}

	// Find the node process for override vars
	var overrideVars map[string]any
	if np, err := s.nodeProcessRepo.FindByNodeAndProcessDef(nodeID, pd.ID); err == nil {
		_ = json.Unmarshal([]byte(np.OverrideVars), &overrideVars)
	}

	// Build template context
	var labels map[string]any
	_ = json.Unmarshal([]byte(node.Labels), &labels)

	templateCtx := map[string]any{
		"Node":     labels,
		"Override": overrideVars,
	}

	// Render the first config file
	tmpl, err := template.New("config").Parse(configFiles[0].Content)
	if err != nil {
		return "", "", fmt.Errorf("template parse error: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, templateCtx); err != nil {
		return "", "", fmt.Errorf("template render error: %w", err)
	}

	rendered := buf.String()
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(rendered)))

	return rendered, hash, nil
}

func (s *SidecarService) DetectOfflineNodes(_ context.Context, _ json.RawMessage) error {
	affected, err := s.nodeRepo.MarkOffline(heartbeatTimeout)
	if err != nil {
		return err
	}
	if affected > 0 {
		slog.Info("node offline detection", "marked_offline", affected)
	}
	return nil
}

func (s *SidecarService) CleanupExpiredCommands(_ context.Context, _ json.RawMessage) error {
	affected, err := s.commandRepo.CleanupExpired(commandTimeout)
	if err != nil {
		return err
	}
	if affected > 0 {
		slog.Info("node command cleanup", "expired_commands", affected)
	}
	return nil
}
