//go:build !(darwin || linux || freebsd || netbsd || openbsd)

package sidecar

import "os/exec"

func newManagedShellCommand(command string) *exec.Cmd {
	return exec.Command("cmd", "/C", command)
}

func configureManagedCommand(_ *exec.Cmd) {}

func terminateManagedCommand(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}