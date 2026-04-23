package main

import (
	"context"
	"strings"
	"testing"
)

func TestBuildPlanDryRunAllocatesDistinctPortsAndCommands(t *testing.T) {
	plan, err := buildPlan([]string{"--dry-run"})
	if err != nil {
		t.Fatalf("build plan: %v", err)
	}
	if plan.APIPort == 0 || plan.WebPort == 0 {
		t.Fatalf("ports were not allocated: %+v", plan)
	}
	if plan.APIPort == plan.WebPort {
		t.Fatalf("api and web ports must differ: %+v", plan)
	}
	if !strings.Contains(strings.Join(plan.ServerArgs, " "), "-port") {
		t.Fatalf("server args missing -port: %#v", plan.ServerArgs)
	}
	if plan.BunPath == "" {
		t.Fatal("bun path was not resolved")
	}
	if plan.WebEnv["VITE_API_TARGET"] != "http://localhost:"+plan.APIPortString() {
		t.Fatalf("VITE_API_TARGET = %q, want api port %d", plan.WebEnv["VITE_API_TARGET"], plan.APIPort)
	}
	if !strings.Contains(plan.WebURL, plan.WebPortString()) || !strings.Contains(plan.APIURL, plan.APIPortString()) {
		t.Fatalf("urls do not include allocated ports: %+v", plan)
	}
}

func TestManagedCommandRunsInOwnProcessGroup(t *testing.T) {
	cmd := managedCommand(context.Background(), "server", "go", []string{"version"})
	if !commandRunsInOwnProcessGroup(cmd) {
		t.Fatal("managed command must run in its own process group")
	}
}
