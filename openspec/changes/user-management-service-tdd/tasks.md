## 1. Test Infrastructure

- [ ] 1.1 Create `internal/service/user_test.go` with `newTestDB`, `newUserServiceForTest`, and `seedRole` helpers
- [ ] 1.2 Ensure `AutoMigrate` covers `User`, `Role`, `SystemConfig`, and `RefreshToken`

## 2. Create & Retrieve Tests

- [ ] 2.1 `TestUserServiceCreate_Success`
- [ ] 2.2 `TestUserServiceCreate_RejectsDuplicateUsername`
- [ ] 2.3 `TestUserServiceCreate_EnforcesPasswordPolicy`
- [ ] 2.4 `TestUserServiceGetByID_Success`
- [ ] 2.5 `TestUserServiceGetByID_ReturnsNotFoundForMissing`
- [ ] 2.6 `TestUserServiceGetByIDWithManager_Success`

## 3. Update Tests

- [ ] 3.1 `TestUserServiceUpdate_Success`
- [ ] 3.2 `TestUserServiceUpdate_PreventsSelfRoleChange`
- [ ] 3.3 `TestUserServiceUpdate_ReturnsNotFoundForMissing`
- [ ] 3.4 `TestUserServiceUpdate_DetectsDirectCircularManager`
- [ ] 3.5 `TestUserServiceUpdate_DetectsIndirectCircularManager`

## 4. Delete, Reset Password & Unlock Tests

- [ ] 4.1 `TestUserServiceDelete_Success` (verify user deleted and tokens revoked)
- [ ] 4.2 `TestUserServiceDelete_PreventsSelfDeletion`
- [ ] 4.3 `TestUserServiceDelete_ReturnsNotFoundForMissing`
- [ ] 4.4 `TestUserServiceResetPassword_Success` (verify password hashed, tokens revoked)
- [ ] 4.5 `TestUserServiceResetPassword_EnforcesPasswordPolicy`
- [ ] 4.6 `TestUserServiceResetPassword_ReturnsNotFoundForMissing`
- [ ] 4.7 `TestUserServiceUnlockUser_Success`
- [ ] 4.8 `TestUserServiceUnlockUser_ReturnsNotFoundForMissing`

## 5. Activation, Deactivation & Manager Chain Tests

- [ ] 5.1 `TestUserServiceActivate_Success`
- [ ] 5.2 `TestUserServiceActivate_ReturnsNotFoundForMissing`
- [ ] 5.3 `TestUserServiceDeactivate_Success` (verify tokens revoked)
- [ ] 5.4 `TestUserServiceDeactivate_PreventsSelfDeactivation`
- [ ] 5.5 `TestUserServiceGetManagerChain_Success`
- [ ] 5.6 `TestUserServiceGetManagerChain_ReturnsNotFoundForMissing`
- [ ] 5.7 `TestUserServiceGetManagerChain_BreaksOnCycle`
- [ ] 5.8 `TestUserServiceGetManagerChain_RespectsMaxDepth`
- [ ] 5.9 `TestUserServiceClearManager_Success`
- [ ] 5.10 `TestUserServiceClearManager_ReturnsNotFoundForMissing`

## 6. Verification

- [ ] 6.1 Run `go test ./internal/service/...` and ensure all tests pass
- [ ] 6.2 Fix any compilation issues in service layer caused by test helpers
