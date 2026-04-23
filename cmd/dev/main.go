package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
)

type devPlan struct {
	DryRun     bool
	APIPort    int
	WebPort    int
	ServerArgs []string
	BunPath    string
	WebArgs    []string
	WebEnv     map[string]string
	WebURL     string
	APIURL     string
}

func (p devPlan) APIPortString() string {
	return strconv.Itoa(p.APIPort)
}

func (p devPlan) WebPortString() string {
	return strconv.Itoa(p.WebPort)
}

func main() {
	plan, err := buildPlan(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	fmt.Printf("API: %s\n", plan.APIURL)
	fmt.Printf("Web: %s\n", plan.WebURL)
	if plan.DryRun {
		fmt.Printf("Server: go %s\n", joinArgs(plan.ServerArgs))
		fmt.Printf("Web: %s %s\n", strconv.Quote(plan.BunPath), joinArgs(plan.WebArgs))
		return
	}

	if err := run(plan); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func buildPlan(args []string) (devPlan, error) {
	fs := flag.NewFlagSet("dev", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	dryRun := fs.Bool("dry-run", false, "print commands without starting processes")
	if err := fs.Parse(args); err != nil {
		return devPlan{}, err
	}

	webPort, apiPort, err := freeDevPortPair()
	if err != nil {
		return devPlan{}, fmt.Errorf("find dev ports: %w", err)
	}
	bunPath, err := findBun()
	if err != nil {
		return devPlan{}, err
	}

	apiURL := "http://localhost:" + strconv.Itoa(apiPort)
	webURL := "http://localhost:" + strconv.Itoa(webPort)
	serverArgs := []string{"run", "-tags", "dev"}
	if ldflags := os.Getenv("METIS_DEV_SERVER_LDFLAGS"); ldflags != "" {
		serverArgs = append(serverArgs, "-ldflags", ldflags)
	}
	serverArgs = append(serverArgs, "./cmd/server", "-port", strconv.Itoa(apiPort))
	return devPlan{
		DryRun:     *dryRun,
		APIPort:    apiPort,
		WebPort:    webPort,
		ServerArgs: serverArgs,
		BunPath:    bunPath,
		WebArgs:    []string{"run", "dev", "--", "--host", "0.0.0.0", "--port", strconv.Itoa(webPort), "--strictPort"},
		WebEnv:     map[string]string{"VITE_API_TARGET": apiURL},
		WebURL:     webURL,
		APIURL:     apiURL,
	}, nil
}

func findBun() (string, error) {
	if path := os.Getenv("BUN_BIN"); path != "" {
		return path, nil
	}
	if path, err := exec.LookPath("bun"); err == nil {
		return path, nil
	}
	if home, err := os.UserHomeDir(); err == nil {
		path := filepath.Join(home, ".bun", "bin", "bun")
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("bun not found; install Bun or set BUN_BIN")
}

func freeDevPortPair() (int, int, error) {
	return freePortPair(3000, 8000, 1000)
}

func freePortPair(webStart, apiStart, attempts int) (int, int, error) {
	for offset := 0; offset < attempts; offset++ {
		webPort := webStart + offset
		apiPort := apiStart + offset
		if portAvailable(webPort) && portAvailable(apiPort) {
			return webPort, apiPort, nil
		}
	}
	return 0, 0, fmt.Errorf("no available web/API port pair from %d/%d after %d attempts", webStart, apiStart, attempts)
}

func portAvailable(port int) bool {
	ln, err := net.Listen("tcp", ":"+strconv.Itoa(port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}

func freePort() (int, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer ln.Close()
	addr, ok := ln.Addr().(*net.TCPAddr)
	if !ok {
		return 0, fmt.Errorf("unexpected listener address %T", ln.Addr())
	}
	return addr.Port, nil
}

func run(plan devPlan) error {
	ctx, stop := newSignalContext(context.Background())
	defer stop()

	server := managedCommand(ctx, "server", "go", plan.ServerArgs)
	server.Stdout = os.Stdout
	server.Stderr = os.Stderr
	server.Stdin = os.Stdin

	web := managedCommand(ctx, "web", plan.BunPath, plan.WebArgs)
	web.Dir = "web"
	web.Stdout = os.Stdout
	web.Stderr = os.Stderr
	web.Stdin = os.Stdin
	web.Env = append(os.Environ(), "VITE_API_TARGET="+plan.WebEnv["VITE_API_TARGET"])

	if err := server.Start(); err != nil {
		return fmt.Errorf("start server: %w", err)
	}
	if err := web.Start(); err != nil {
		stop()
		stopCommandGroup(server)
		_ = waitCommand("server", server)
		return fmt.Errorf("start web: %w", err)
	}

	errCh := make(chan error, 2)
	go func() { errCh <- waitCommand("server", server) }()
	go func() { errCh <- waitCommand("web", web) }()

	err := <-errCh
	stop()
	stopCommandGroup(server)
	stopCommandGroup(web)
	<-errCh
	if errors.Is(err, context.Canceled) || ctx.Err() != nil {
		return nil
	}
	return err
}

func joinArgs(args []string) string {
	out := ""
	for i, arg := range args {
		if i > 0 {
			out += " "
		}
		out += strconv.Quote(arg)
	}
	return out
}
