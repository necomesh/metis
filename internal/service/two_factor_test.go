package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/pquerna/otp/totp"
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
	"metis/internal/model"
	"metis/internal/repository"
)

func newTestDBForTwoFactor(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	gdb, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := gdb.AutoMigrate(&model.User{}, &model.TwoFactorSecret{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	return gdb
}

func newTwoFactorServiceForTest(t *testing.T, db *gorm.DB) *TwoFactorService {
	t.Helper()
	injector := do.New()
	do.ProvideValue(injector, &database.DB{DB: db})
	do.Provide(injector, repository.NewUser)
	do.Provide(injector, repository.NewTwoFactorSecret)
	do.Provide(injector, NewTwoFactor)
	return do.MustInvoke[*TwoFactorService](injector)
}

func seedUserForTwoFactorTest(t *testing.T, db *gorm.DB, username string, enabled bool) *model.User {
	t.Helper()
	user := &model.User{Username: username, TwoFactorEnabled: enabled, IsActive: true}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func TestTwoFactorServiceSetupAndConfirm_EnableWithBackupCodes(t *testing.T) {
	db := newTestDBForTwoFactor(t)
	svc := newTwoFactorServiceForTest(t, db)
	user := seedUserForTwoFactorTest(t, db, "alice", false)

	setup, err := svc.Setup(user.ID)
	if err != nil {
		t.Fatalf("setup 2FA: %v", err)
	}
	if setup.Secret == "" {
		t.Fatal("expected secret to be generated")
	}
	if setup.QRUri == "" {
		t.Fatal("expected QRUri to be generated")
	}

	code, err := totp.GenerateCode(setup.Secret, time.Now())
	if err != nil {
		t.Fatalf("generate TOTP code: %v", err)
	}

	confirm, err := svc.Confirm(user.ID, code)
	if err != nil {
		t.Fatalf("confirm 2FA: %v", err)
	}
	if len(confirm.BackupCodes) != 8 {
		t.Fatalf("expected 8 backup codes, got %d", len(confirm.BackupCodes))
	}

	updatedUser, err := svc.userRepo.FindByID(user.ID)
	if err != nil {
		t.Fatalf("find user: %v", err)
	}
	if !updatedUser.TwoFactorEnabled {
		t.Fatal("expected user.TwoFactorEnabled=true after confirm")
	}
}

func TestTwoFactorServiceVerify_BackupCodeIsSingleUse(t *testing.T) {
	db := newTestDBForTwoFactor(t)
	svc := newTwoFactorServiceForTest(t, db)
	user := seedUserForTwoFactorTest(t, db, "bob", false)

	setup, err := svc.Setup(user.ID)
	if err != nil {
		t.Fatalf("setup 2FA: %v", err)
	}
	code, err := totp.GenerateCode(setup.Secret, time.Now())
	if err != nil {
		t.Fatalf("generate TOTP code: %v", err)
	}
	confirm, err := svc.Confirm(user.ID, code)
	if err != nil {
		t.Fatalf("confirm 2FA: %v", err)
	}

	valid, err := svc.Verify(user.ID, confirm.BackupCodes[0])
	if err != nil {
		t.Fatalf("verify backup code first use: %v", err)
	}
	if !valid {
		t.Fatal("expected first backup code use to succeed")
	}

	valid, err = svc.Verify(user.ID, confirm.BackupCodes[0])
	if err != nil {
		t.Fatalf("verify backup code second use: %v", err)
	}
	if valid {
		t.Fatal("expected second backup code use to fail")
	}
}