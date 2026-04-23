//go:build !(darwin || linux || freebsd || netbsd || openbsd)

package main

import (
	"context"
	"fmt"
	"os/exec"
)

func newSignalContext(parent context.Context) (context.Context, context.CancelFunc) {
	return signalNotifyContext(parent)
}

func managedCommand(ctx context.Context, _ string, name string, args []string) *exec.Cmd {
	return exec.CommandContext(ctx, name, args...)
}

func commandRunsInOwnProcessGroup(_ *exec.Cmd) bool {
	return true
}

func stopCommandGroup(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = cmd.Process.Kill()
}

func waitCommand(name string, cmd *exec.Cmd) error {
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("%s exited: %w", name, err)
	}
	return fmt.Errorf("%s exited", name)
}
