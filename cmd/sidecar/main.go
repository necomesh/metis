package main

import (
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"metis/internal/sidecar"
)

func main() {
	configPath := flag.String("config", "sidecar.yaml", "path to sidecar config file")
	flag.Parse()

	// Setup structured logging
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := sidecar.LoadConfig(*configPath)
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	agent := sidecar.NewAgent(cfg)

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		slog.Info("received shutdown signal")
		agent.Stop()
	}()

	if err := agent.Run(); err != nil {
		slog.Error("agent failed", "error", err)
		os.Exit(1)
	}
}
