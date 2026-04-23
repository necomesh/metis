//go:build !dev

package main

import (
	"fmt"
	"os"

	"gorm.io/gorm"

	"metis/internal/config"
)

const devAIConfigPath = ".env.dev"

func runDevBootstrap(_ *gorm.DB, _ *config.MetisConfig, _ string) error {
	return nil
}

func runSeedDevCommand(_ []string) {
	fmt.Fprintln(os.Stderr, "seed-dev is only available in dev builds; run with -tags dev")
	os.Exit(1)
}

func maybeRunSeedDev(_ string, _ string, _ *config.MetisConfig) (bool, error) {
	return false, nil
}
