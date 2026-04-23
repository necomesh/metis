//go:build darwin || linux || freebsd || netbsd || openbsd

package main

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"syscall"
)

func newSignalContext(parent context.Context) (context.Context, context.CancelFunc) {
	return signalNotifyContext(parent, syscall.SIGTERM)
}

func managedCommand(ctx context.Context, _ string, name string, args []string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return cmd
}

func commandRunsInOwnProcessGroup(cmd *exec.Cmd) bool {
	return cmd.SysProcAttr != nil && cmd.SysProcAttr.Setpgid
}

func stopCommandGroup(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
}

func waitCommand(name string, cmd *exec.Cmd) error {
	err := cmd.Wait()
	if err == nil {
		return fmt.Errorf("%s exited", name)
	}
	if errors.Is(err, context.Canceled) {
		return context.Canceled
	}
	return fmt.Errorf("%s exited: %w", name, err)
}
