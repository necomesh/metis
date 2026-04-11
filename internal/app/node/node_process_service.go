package node

import (
	"encoding/json"
	"errors"

	"github.com/samber/do/v2"
	"gorm.io/gorm"
)

var (
	ErrNodeProcessNotFound = errors.New("node process binding not found")
	ErrNodeProcessExists   = errors.New("process already bound to this node")
)

type NodeProcessService struct {
	nodeRepo        *NodeRepo
	processDefRepo  *ProcessDefRepo
	nodeProcessRepo *NodeProcessRepo
	commandRepo     *NodeCommandRepo
}

func NewNodeProcessService(i do.Injector) (*NodeProcessService, error) {
	return &NodeProcessService{
		nodeRepo:        do.MustInvoke[*NodeRepo](i),
		processDefRepo:  do.MustInvoke[*ProcessDefRepo](i),
		nodeProcessRepo: do.MustInvoke[*NodeProcessRepo](i),
		commandRepo:     do.MustInvoke[*NodeCommandRepo](i),
	}, nil
}

func (s *NodeProcessService) Bind(nodeID, processDefID uint, overrideVars JSONMap) (*NodeProcess, error) {
	if _, err := s.nodeRepo.FindByID(nodeID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNodeNotFound
		}
		return nil, err
	}
	pd, err := s.processDefRepo.FindByID(processDefID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProcessDefNotFound
		}
		return nil, err
	}

	// Check if already bound
	if _, err := s.nodeProcessRepo.FindByNodeAndProcessDef(nodeID, processDefID); err == nil {
		return nil, ErrNodeProcessExists
	}

	np := &NodeProcess{
		NodeID:       nodeID,
		ProcessDefID: processDefID,
		Status:       ProcessStatusPendingConfig,
		OverrideVars: overrideVars,
	}
	if err := s.nodeProcessRepo.Create(np); err != nil {
		return nil, err
	}

	// Enqueue start command with full process definition
	payload, _ := json.Marshal(map[string]any{
		"process_def_id":  processDefID,
		"node_process_id": np.ID,
		"process_def": map[string]any{
			"id":            pd.ID,
			"name":          pd.Name,
			"startCommand":  pd.StartCommand,
			"stopCommand":   pd.StopCommand,
			"reloadCommand": pd.ReloadCommand,
			"env":           json.RawMessage(pd.Env),
			"restartPolicy": pd.RestartPolicy,
			"maxRestarts":   pd.MaxRestarts,
		},
	})
	cmd := &NodeCommand{
		NodeID:  nodeID,
		Type:    CommandTypeProcessStart,
		Payload: JSONMap(payload),
		Status:  CommandStatusPending,
	}
	_ = s.commandRepo.Create(cmd)

	return np, nil
}

func (s *NodeProcessService) ListByNodeID(nodeID uint) ([]NodeProcessDetail, error) {
	return s.nodeProcessRepo.ListByNodeID(nodeID)
}

func (s *NodeProcessService) Unbind(nodeID, processDefID uint) error {
	np, err := s.nodeProcessRepo.FindByNodeAndProcessDef(nodeID, processDefID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNodeProcessNotFound
		}
		return err
	}

	// Lookup process name for the payload
	var processName string
	if pd, err := s.processDefRepo.FindByID(processDefID); err == nil {
		processName = pd.Name
	}

	// Enqueue stop command
	payload, _ := json.Marshal(map[string]any{
		"process_def_id":  processDefID,
		"node_process_id": np.ID,
		"process_name":    processName,
	})
	cmd := &NodeCommand{
		NodeID:  nodeID,
		Type:    CommandTypeProcessStop,
		Payload: JSONMap(payload),
		Status:  CommandStatusPending,
	}
	_ = s.commandRepo.Create(cmd)

	return s.nodeProcessRepo.Delete(np.ID)
}

func (s *NodeProcessService) Restart(nodeID, processDefID uint) error {
	np, err := s.nodeProcessRepo.FindByNodeAndProcessDef(nodeID, processDefID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNodeProcessNotFound
		}
		return err
	}

	// Lookup process name for the payload
	var processName string
	if pd, err := s.processDefRepo.FindByID(processDefID); err == nil {
		processName = pd.Name
	}

	payload, _ := json.Marshal(map[string]any{
		"process_def_id":  processDefID,
		"node_process_id": np.ID,
		"process_name":    processName,
	})
	cmd := &NodeCommand{
		NodeID:  nodeID,
		Type:    CommandTypeProcessRestart,
		Payload: JSONMap(payload),
		Status:  CommandStatusPending,
	}
	return s.commandRepo.Create(cmd)
}
