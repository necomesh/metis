package itsm

import (
	"fmt"
	"sync"
	"time"

	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"metis/internal/database"
)

type TicketRepo struct {
	db    *database.DB
	seqMu sync.Mutex
}

func NewTicketRepo(i do.Injector) (*TicketRepo, error) {
	db := do.MustInvoke[*database.DB](i)
	return &TicketRepo{db: db}, nil
}

// NextCode generates the next ticket code (TICK-XXXXXX) in a concurrency-safe manner.
func (r *TicketRepo) NextCode() (string, error) {
	r.seqMu.Lock()
	defer r.seqMu.Unlock()

	var maxID uint
	if err := r.db.Model(&Ticket{}).Select("COALESCE(MAX(id), 0)").Scan(&maxID).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("TICK-%06d", maxID+1), nil
}

func (r *TicketRepo) Create(t *Ticket) error {
	return r.db.Create(t).Error
}

func (r *TicketRepo) FindByID(id uint) (*Ticket, error) {
	var t Ticket
	if err := r.db.First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TicketRepo) FindByCode(code string) (*Ticket, error) {
	var t Ticket
	if err := r.db.Where("code = ?", code).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TicketRepo) assignmentOperatorCondition(alias string, userID uint, positionIDs []uint, deptIDs []uint) *gorm.DB {
	col := func(name string) string {
		return fmt.Sprintf("%s.%s", alias, name)
	}

	cond := r.db.Where(fmt.Sprintf("%s = ? OR %s = ?", col("user_id"), col("assignee_id")), userID, userID)
	if len(positionIDs) > 0 && len(deptIDs) > 0 {
		cond = cond.Or(
			r.db.Where(
				fmt.Sprintf("%s = ? AND %s IN ? AND %s IN ?", col("participant_type"), col("position_id"), col("department_id")),
				"position_department", positionIDs, deptIDs,
			),
		)
		cond = cond.Or(
			r.db.Where(
				fmt.Sprintf("COALESCE(%s, '') = '' AND %s IN ? AND %s IN ?", col("participant_type"), col("position_id"), col("department_id")),
				positionIDs, deptIDs,
			),
		)
	}
	if len(positionIDs) > 0 {
		cond = cond.Or(
			r.db.Where(
				fmt.Sprintf("%s = ? AND %s IN ?", col("participant_type"), col("position_id")),
				"position", positionIDs,
			),
		)
		cond = cond.Or(
			r.db.Where(
				fmt.Sprintf("COALESCE(%s, '') = '' AND %s IN ? AND %s IS NULL", col("participant_type"), col("position_id"), col("department_id")),
				positionIDs,
			),
		)
	}
	if len(deptIDs) > 0 {
		cond = cond.Or(
			r.db.Where(
				fmt.Sprintf("%s = ? AND %s IN ?", col("participant_type"), col("department_id")),
				"department", deptIDs,
			),
		)
		cond = cond.Or(
			r.db.Where(
				fmt.Sprintf("COALESCE(%s, '') = '' AND %s IN ? AND %s IS NULL", col("participant_type"), col("department_id"), col("position_id")),
				deptIDs,
			),
		)
	}
	return cond
}

func (r *TicketRepo) Update(id uint, updates map[string]any) error {
	return r.db.Model(&Ticket{}).Where("id = ?", id).Updates(updates).Error
}

type TicketListParams struct {
	Keyword     string
	Status      string
	PriorityID  *uint
	ServiceID   *uint
	AssigneeID  *uint
	RequesterID *uint
	StartDate   *time.Time
	EndDate     *time.Time
	Page        int
	PageSize    int
	DeptScope   *[]uint
}

func (r *TicketRepo) List(params TicketListParams) ([]Ticket, int64, error) {
	query := r.db.Model(&Ticket{})

	if params.Keyword != "" {
		like := "%" + params.Keyword + "%"
		query = query.Where("code LIKE ? OR title LIKE ? OR description LIKE ?", like, like, like)
	}
	if params.Status != "" {
		query = query.Where("status = ?", params.Status)
	}
	if params.PriorityID != nil {
		query = query.Where("priority_id = ?", *params.PriorityID)
	}
	if params.ServiceID != nil {
		query = query.Where("service_id = ?", *params.ServiceID)
	}
	if params.AssigneeID != nil {
		query = query.Where("assignee_id = ?", *params.AssigneeID)
	}
	if params.RequesterID != nil {
		query = query.Where("requester_id = ?", *params.RequesterID)
	}
	if params.StartDate != nil {
		query = query.Where("finished_at >= ?", *params.StartDate)
	}
	if params.EndDate != nil {
		query = query.Where("finished_at <= ?", *params.EndDate)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}

	var items []Ticket
	offset := (params.Page - 1) * params.PageSize
	if err := query.Offset(offset).Limit(params.PageSize).Order("id DESC").Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// UpdateInTx performs an update within a provided transaction.
func (r *TicketRepo) UpdateInTx(tx *gorm.DB, id uint, updates map[string]any) error {
	return tx.Model(&Ticket{}).Where("id = ?", id).Updates(updates).Error
}

func (r *TicketRepo) DB() *gorm.DB {
	return r.db.DB
}
