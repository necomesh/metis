//go:build darwin || linux || freebsd || netbsd || openbsd

package sidecar

import (
	"os/exec"
	"syscall"
)

func newManagedShellCommand(command string) *exec.Cmd {
	return exec.Command("sh", "-c", command)
}

func configureManagedCommand(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
}

func terminateManagedCommand(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
}