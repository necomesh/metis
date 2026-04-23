package main

import (
	"context"
	"net"
	"strconv"
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

func TestFreePortPairPrefersMatchingOffsets(t *testing.T) {
	webStart, err := freePort()
	if err != nil {
		t.Fatalf("find web start: %v", err)
	}
	apiStart, err := freePort()
	if err != nil {
		t.Fatalf("find api start: %v", err)
	}
	if webStart == apiStart {
		t.Fatal("expected distinct test ports")
	}

	webPort, apiPort, err := freePortPair(webStart, apiStart, 3)
	if err != nil {
		t.Fatalf("find first pair: %v", err)
	}
	if webPort != webStart || apiPort != apiStart {
		t.Fatalf("first pair = %d/%d, want %d/%d", webPort, apiPort, webStart, apiStart)
	}
}

func TestFreePortPairSkipsWholePairWhenEitherPortIsBusy(t *testing.T) {
	webStart, apiStart, cleanup := reserveSequentialPortWindow(t, 2)
	defer cleanup()

	webPort, apiPort, err := freePortPair(webStart, apiStart, 3)
	if err != nil {
		t.Fatalf("find second pair: %v", err)
	}
	if webPort != webStart+1 || apiPort != apiStart+1 {
		t.Fatalf("pair = %d/%d, want %d/%d", webPort, apiPort, webStart+1, apiStart+1)
	}
}

func TestManagedCommandRunsInOwnProcessGroup(t *testing.T) {
	cmd := managedCommand(context.Background(), "server", "go", []string{"version"})
	if !commandRunsInOwnProcessGroup(cmd) {
		t.Fatal("managed command must run in its own process group")
	}
}

func reserveSequentialPortWindow(t *testing.T, size int) (int, int, func()) {
	t.Helper()
	for webStart := 3000; webStart < 65000-size; webStart++ {
		apiStart := webStart + 1000
		if !portWindowAvailable(webStart, size) || !portWindowAvailable(apiStart, size) {
			continue
		}
		ln, err := net.Listen("tcp", ":"+strconv.Itoa(webStart))
		if err != nil {
			continue
		}
		return webStart, apiStart, func() { _ = ln.Close() }
	}
	t.Fatal("no sequential port window available")
	return 0, 0, func() {}
}

func portWindowAvailable(start, size int) bool {
	listeners := make([]net.Listener, 0, size)
	for port := start; port < start+size; port++ {
		ln, err := net.Listen("tcp", ":"+strconv.Itoa(port))
		if err != nil {
			for _, l := range listeners {
				_ = l.Close()
			}
			return false
		}
		listeners = append(listeners, ln)
	}
	for _, ln := range listeners {
		_ = ln.Close()
	}
	return true
}
