package main

import (
	"github.com/samber/do/v2"

	casbinpkg "metis/internal/casbin"
	"metis/internal/handler"
	"metis/internal/pkg/oauth"
	"metis/internal/repository"
	"metis/internal/scheduler"
	"metis/internal/service"
)

// registerKernelProviders registers all kernel-layer IOC providers.
// Keep in sync with overrideKernelProviders.
func registerKernelProviders(i do.Injector) {
	do.Provide(i, casbinpkg.NewEnforcer)
	do.Provide(i, repository.NewUser)
	do.Provide(i, repository.NewRefreshToken)
	do.Provide(i, repository.NewRole)
	do.Provide(i, repository.NewMenu)
	do.Provide(i, repository.NewNotification)
	do.Provide(i, repository.NewMessageChannel)
	do.Provide(i, repository.NewAuthProvider)
	do.Provide(i, repository.NewUserConnection)
	do.Provide(i, repository.NewAuditLog)
	do.Provide(i, repository.NewTwoFactorSecret)
	do.Provide(i, service.NewCasbin)
	do.Provide(i, service.NewRole)
	do.Provide(i, service.NewMenu)
	do.Provide(i, service.NewAuth)
	do.Provide(i, service.NewUser)
	do.Provide(i, service.NewNotification)
	do.Provide(i, service.NewMessageChannel)
	do.Provide(i, service.NewSession)
	do.Provide(i, service.NewSettings)
	do.Provide(i, service.NewAuthProvider)
	do.Provide(i, service.NewUserConnection)
	do.Provide(i, service.NewAuditLog)
	do.Provide(i, service.NewCaptcha)
	do.Provide(i, service.NewTwoFactor)
	do.Provide(i, repository.NewIdentitySource)
	do.Provide(i, service.NewIdentitySource)
	do.ProvideValue(i, oauth.NewStateManager())
	do.Provide(i, handler.New)
	do.Provide(i, scheduler.New)
}

// overrideKernelProviders re-registers all kernel-layer IOC providers using Override.
// Used during install hot-switch when the container already has stale providers.
// Keep in sync with registerKernelProviders.
func overrideKernelProviders(i do.Injector) {
	do.Override(i, casbinpkg.NewEnforcer)
	do.Override(i, repository.NewUser)
	do.Override(i, repository.NewRefreshToken)
	do.Override(i, repository.NewRole)
	do.Override(i, repository.NewMenu)
	do.Override(i, repository.NewNotification)
	do.Override(i, repository.NewMessageChannel)
	do.Override(i, repository.NewAuthProvider)
	do.Override(i, repository.NewUserConnection)
	do.Override(i, repository.NewAuditLog)
	do.Override(i, repository.NewTwoFactorSecret)
	do.Override(i, service.NewCasbin)
	do.Override(i, service.NewRole)
	do.Override(i, service.NewMenu)
	do.Override(i, service.NewAuth)
	do.Override(i, service.NewUser)
	do.Override(i, service.NewNotification)
	do.Override(i, service.NewMessageChannel)
	do.Override(i, service.NewSession)
	do.Override(i, service.NewSettings)
	do.Override(i, service.NewAuthProvider)
	do.Override(i, service.NewUserConnection)
	do.Override(i, service.NewAuditLog)
	do.Override(i, service.NewCaptcha)
	do.Override(i, service.NewTwoFactor)
	do.Override(i, repository.NewIdentitySource)
	do.Override(i, service.NewIdentitySource)
	do.OverrideValue(i, oauth.NewStateManager())
	do.Override(i, handler.New)
	do.Override(i, scheduler.New)
}
