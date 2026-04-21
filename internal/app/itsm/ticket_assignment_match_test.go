package itsm

import (
	"errors"
	"testing"

	"metis/internal/database"
	"metis/internal/model"
)

type assignmentMatchFixture struct {
	db        *database.DB
	repo      *TicketRepo
	service   *TicketService
	resolver  *smartTestOrgResolver
	requester model.User
	admin     model.User
	staff     model.User
	crossDept model.User
	ticket    Ticket
	activity  TicketActivity
}

func newAssignmentMatchFixture(t *testing.T) *assignmentMatchFixture {
	t.Helper()

	gdb := newTestDB(t)
	if err := gdb.AutoMigrate(&Priority{}, &Ticket{}, &TicketActivity{}, &TicketAssignment{}, &TicketTimeline{}); err != nil {
		t.Fatalf("migrate assignment models: %v", err)
	}

	requester := model.User{Username: "requester", IsActive: true}
	admin := model.User{Username: "admin", IsActive: true}
	staff := model.User{Username: "it_staff", IsActive: true}
	crossDept := model.User{Username: "security_network_admin", IsActive: true}
	for _, user := range []*model.User{&requester, &admin, &staff, &crossDept} {
		if err := gdb.Create(user).Error; err != nil {
			t.Fatalf("create user %s: %v", user.Username, err)
		}
	}

	catalog := ServiceCatalog{Name: "IT 服务", Code: "it", IsActive: true}
	if err := gdb.Create(&catalog).Error; err != nil {
		t.Fatalf("create catalog: %v", err)
	}
	priority := Priority{Name: "P2", Code: "P2", Value: 2, Color: "#f59e0b", IsActive: true}
	if err := gdb.Create(&priority).Error; err != nil {
		t.Fatalf("create priority: %v", err)
	}
	service := ServiceDefinition{Name: "VPN 开通", Code: "vpn_access", CatalogID: catalog.ID, EngineType: "smart", IsActive: true}
	if err := gdb.Create(&service).Error; err != nil {
		t.Fatalf("create service: %v", err)
	}

	ticket := Ticket{
		Code:        "TICK-POS-DEPT",
		Title:       "VPN 开通申请",
		ServiceID:   service.ID,
		EngineType:  "smart",
		Status:      TicketStatusWaitingApproval,
		PriorityID:  priority.ID,
		RequesterID: requester.ID,
	}
	if err := gdb.Create(&ticket).Error; err != nil {
		t.Fatalf("create ticket: %v", err)
	}

	activity := TicketActivity{
		TicketID:     ticket.ID,
		Name:         "网络管理员审批",
		ActivityType: "approve",
		Status:       "pending",
	}
	if err := gdb.Create(&activity).Error; err != nil {
		t.Fatalf("create activity: %v", err)
	}
	if err := gdb.Model(&ticket).Updates(map[string]any{"current_activity_id": activity.ID}).Error; err != nil {
		t.Fatalf("set current activity: %v", err)
	}

	const (
		itDeptID          uint = 10
		securityDeptID    uint = 20
		networkPositionID uint = 100
		staffPositionID   uint = 200
	)
	assignment := TicketAssignment{
		TicketID:        ticket.ID,
		ActivityID:      activity.ID,
		ParticipantType: "position_department",
		PositionID:      uintPtr(networkPositionID),
		DepartmentID:    uintPtr(itDeptID),
		Status:          AssignmentPending,
		IsCurrent:       true,
	}
	if err := gdb.Create(&assignment).Error; err != nil {
		t.Fatalf("create assignment: %v", err)
	}

	wrapped := &database.DB{DB: gdb}
	repo := &TicketRepo{db: wrapped}
	resolver := &smartTestOrgResolver{
		positionIDsByUser: map[uint][]uint{
			admin.ID:     {networkPositionID},
			staff.ID:     {staffPositionID},
			crossDept.ID: {networkPositionID},
		},
		deptIDsByUser: map[uint][]uint{
			admin.ID:     {itDeptID},
			staff.ID:     {itDeptID},
			crossDept.ID: {securityDeptID},
		},
	}

	return &assignmentMatchFixture{
		db:        wrapped,
		repo:      repo,
		service:   &TicketService{ticketRepo: repo, timelineRepo: &TimelineRepo{db: wrapped}, orgResolver: resolver},
		resolver:  resolver,
		requester: requester,
		admin:     admin,
		staff:     staff,
		crossDept: crossDept,
		ticket:    ticket,
		activity:  activity,
	}
}

func TestPositionDepartmentAssignmentVisibilityRequiresPositionAndDepartment(t *testing.T) {
	f := newAssignmentMatchFixture(t)

	items, total, err := f.repo.ListApprovals(f.admin.ID, f.resolver.positionIDsByUser[f.admin.ID], f.resolver.deptIDsByUser[f.admin.ID], 1, 20)
	if err != nil {
		t.Fatalf("list admin approvals: %v", err)
	}
	if total != 1 || len(items) != 1 || !items[0].CanAct {
		t.Fatalf("expected admin to see one actionable approval, total=%d len=%d item=%+v", total, len(items), items)
	}
	count, err := f.repo.CountApprovals(f.admin.ID, f.resolver.positionIDsByUser[f.admin.ID], f.resolver.deptIDsByUser[f.admin.ID])
	if err != nil {
		t.Fatalf("count admin approvals: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected admin approval count to be 1, got %d", count)
	}

	todos, total, err := f.repo.ListTodo(TodoListParams{
		UserID:      f.admin.ID,
		PositionIDs: f.resolver.positionIDsByUser[f.admin.ID],
		DeptIDs:     f.resolver.deptIDsByUser[f.admin.ID],
		Page:        1,
		PageSize:    20,
	})
	if err != nil {
		t.Fatalf("list admin todos: %v", err)
	}
	if total != 1 || len(todos) != 1 {
		t.Fatalf("expected admin to see one todo, total=%d len=%d", total, len(todos))
	}

	for _, user := range []model.User{f.staff, f.crossDept} {
		items, total, err := f.repo.ListApprovals(user.ID, f.resolver.positionIDsByUser[user.ID], f.resolver.deptIDsByUser[user.ID], 1, 20)
		if err != nil {
			t.Fatalf("list approvals for %s: %v", user.Username, err)
		}
		if total != 0 || len(items) != 0 {
			t.Fatalf("expected %s to see no approvals, total=%d len=%d", user.Username, total, len(items))
		}
		count, err := f.repo.CountApprovals(user.ID, f.resolver.positionIDsByUser[user.ID], f.resolver.deptIDsByUser[user.ID])
		if err != nil {
			t.Fatalf("count approvals for %s: %v", user.Username, err)
		}
		if count != 0 {
			t.Fatalf("expected %s approval count to be 0, got %d", user.Username, count)
		}

		todos, total, err := f.repo.ListTodo(TodoListParams{
			UserID:      user.ID,
			PositionIDs: f.resolver.positionIDsByUser[user.ID],
			DeptIDs:     f.resolver.deptIDsByUser[user.ID],
			Page:        1,
			PageSize:    20,
		})
		if err != nil {
			t.Fatalf("list todos for %s: %v", user.Username, err)
		}
		if total != 0 || len(todos) != 0 {
			t.Fatalf("expected %s to see no todos, total=%d len=%d", user.Username, total, len(todos))
		}
	}
}

func TestPositionDepartmentAssignmentActionsRequirePositionAndDepartment(t *testing.T) {
	f := newAssignmentMatchFixture(t)

	if err := f.service.verifyApprover(f.activity.ID, f.admin.ID); err != nil {
		t.Fatalf("expected admin to verify approver: %v", err)
	}
	if err := f.service.verifyApprover(f.activity.ID, f.staff.ID); !errors.Is(err, ErrNotApprover) {
		t.Fatalf("expected IT staff to be rejected, got %v", err)
	}
	if err := f.service.verifyApprover(f.activity.ID, f.crossDept.ID); !errors.Is(err, ErrNotApprover) {
		t.Fatalf("expected cross-dept network admin to be rejected, got %v", err)
	}
	if !f.service.assignmentCanAct(f.activity.ID, f.admin.ID, f.resolver.positionIDsByUser[f.admin.ID], f.resolver.deptIDsByUser[f.admin.ID]) {
		t.Fatal("expected admin detail canAct to be true")
	}
	if f.service.assignmentCanAct(f.activity.ID, f.staff.ID, f.resolver.positionIDsByUser[f.staff.ID], f.resolver.deptIDsByUser[f.staff.ID]) {
		t.Fatal("expected IT staff detail canAct to be false")
	}
	if f.service.assignmentCanAct(f.activity.ID, f.crossDept.ID, f.resolver.positionIDsByUser[f.crossDept.ID], f.resolver.deptIDsByUser[f.crossDept.ID]) {
		t.Fatal("expected cross-dept network admin detail canAct to be false")
	}

	canAct, err := f.service.canActOnPendingApprovalTx(f.db.DB, TicketActivity{BaseModel: f.activity.BaseModel, Status: "pending_approval"}, f.admin.ID)
	if err != nil {
		t.Fatalf("check admin pending approval action: %v", err)
	}
	if !canAct {
		t.Fatal("expected admin to act on position_department pending approval")
	}
	canAct, err = f.service.canActOnPendingApprovalTx(f.db.DB, TicketActivity{BaseModel: f.activity.BaseModel, Status: "pending_approval"}, f.staff.ID)
	if err != nil {
		t.Fatalf("check staff pending approval action: %v", err)
	}
	if canAct {
		t.Fatal("expected IT staff to be unable to act on network admin pending approval")
	}

	if _, err := f.service.Claim(f.ticket.ID, f.activity.ID, f.admin.ID); err != nil {
		t.Fatalf("expected admin to claim assignment: %v", err)
	}

	ineligibleActivity := TicketActivity{
		TicketID:     f.ticket.ID,
		Name:         "网络管理员审批 2",
		ActivityType: "approve",
		Status:       "pending",
	}
	if err := f.db.Create(&ineligibleActivity).Error; err != nil {
		t.Fatalf("create ineligible activity: %v", err)
	}
	ineligibleAssignment := TicketAssignment{
		TicketID:        f.ticket.ID,
		ActivityID:      ineligibleActivity.ID,
		ParticipantType: "position_department",
		PositionID:      uintPtr(100),
		DepartmentID:    uintPtr(10),
		Status:          AssignmentPending,
		IsCurrent:       true,
	}
	if err := f.db.Create(&ineligibleAssignment).Error; err != nil {
		t.Fatalf("create ineligible assignment: %v", err)
	}
	if _, err := f.service.Claim(f.ticket.ID, ineligibleActivity.ID, f.staff.ID); !errors.Is(err, ErrNoActiveAssignment) {
		t.Fatalf("expected IT staff claim to be rejected, got %v", err)
	}
}

func uintPtr(v uint) *uint {
	return &v
}
