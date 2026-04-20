package engine

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// --- Multi-person Approval ---

// progressApproval handles multi-person approval modes (parallel/sequential).
// Returns (shouldContinue=true) when the activity is fully completed and workflow should advance,
// or (shouldContinue=false) when the activity is still waiting for more approvals.
func (e *ClassicEngine) progressApproval(tx *gorm.DB, activity *activityModel, params ProgressParams) (bool, error) {
	now := time.Now()

	// Complete the caller's assignment
	result := tx.Model(&assignmentModel{}).
		Where("activity_id = ? AND assignee_id = ? AND status = ?", activity.ID, params.OperatorID, "pending").
		Updates(map[string]any{
			"status":      "completed",
			"finished_at": now,
		})
	if result.RowsAffected == 0 {
		return false, fmt.Errorf("no pending assignment found for user %d on activity %d", params.OperatorID, activity.ID)
	}

	// Delegation auto-return: if the completed assignment was delegated,
	// restore the original assignment back to pending
	var completedAssignment assignmentModel
	if err := tx.Where("activity_id = ? AND assignee_id = ? AND status = ?",
		activity.ID, params.OperatorID, "completed").
		Order("id DESC").First(&completedAssignment).Error; err == nil {
		if completedAssignment.DelegatedFrom != nil {
			tx.Model(&assignmentModel{}).
				Where("id = ? AND status = ?", *completedAssignment.DelegatedFrom, "delegated").
				Updates(map[string]any{"status": "pending", "is_current": true})
			e.recordTimeline(tx, params.TicketID, &params.ActivityID, 0, "delegate_return",
				"委派任务已完成，工单已回归原处理人")
			return false, nil // don't advance workflow — original assignee still needs to act
		}
	}

	switch activity.ExecutionMode {
	case "parallel":
		return e.progressParallelApproval(tx, activity, params, now)
	case "sequential":
		return e.progressSequentialApproval(tx, activity, params, now)
	default:
		// Should not reach here (caller checks mode), but handle gracefully
		return e.completeActivity(tx, activity, params, now)
	}
}

// progressParallelApproval implements 会签 (countersign) mode:
// - Any reject → immediately complete activity with "reject" outcome
// - All approve → complete activity with "approve" outcome
// - Otherwise → wait for remaining participants
func (e *ClassicEngine) progressParallelApproval(tx *gorm.DB, activity *activityModel, params ProgressParams, now time.Time) (bool, error) {
	// If this person rejected, short-circuit: complete activity immediately with "reject"
	if params.Outcome == "reject" {
		// Cancel all remaining pending assignments
		tx.Model(&assignmentModel{}).
			Where("activity_id = ? AND status = ?", activity.ID, "pending").
			Updates(map[string]any{"status": "cancelled", "finished_at": now})

		return e.completeActivity(tx, activity, ProgressParams{
			TicketID:   params.TicketID,
			ActivityID: params.ActivityID,
			Outcome:    "reject",
			Result:     params.Result,
			OperatorID: params.OperatorID,
		}, now)
	}

	// Count remaining pending assignments
	var remaining int64
	tx.Model(&assignmentModel{}).
		Where("activity_id = ? AND status = ?", activity.ID, "pending").
		Count(&remaining)

	if remaining > 0 {
		// Still waiting for other participants
		e.recordTimeline(tx, params.TicketID, &params.ActivityID, params.OperatorID,
			"approval_partial", fmt.Sprintf("会签：用户 %d 已通过，还有 %d 人待审批", params.OperatorID, remaining))
		return false, nil
	}

	// All assignments completed — complete the activity with "approve"
	return e.completeActivity(tx, activity, ProgressParams{
		TicketID:   params.TicketID,
		ActivityID: params.ActivityID,
		Outcome:    "approve",
		Result:     params.Result,
		OperatorID: params.OperatorID,
	}, now)
}

// progressSequentialApproval implements 依次审批 mode:
// - Complete current assignment, advance is_current to next
// - If no more assignments, complete activity
func (e *ClassicEngine) progressSequentialApproval(tx *gorm.DB, activity *activityModel, params ProgressParams, now time.Time) (bool, error) {
	// If rejected at any point, complete activity with "reject"
	if params.Outcome == "reject" {
		// Cancel all remaining pending assignments
		tx.Model(&assignmentModel{}).
			Where("activity_id = ? AND status = ?", activity.ID, "pending").
			Updates(map[string]any{"status": "cancelled", "finished_at": now})

		return e.completeActivity(tx, activity, ProgressParams{
			TicketID:   params.TicketID,
			ActivityID: params.ActivityID,
			Outcome:    "reject",
			Result:     params.Result,
			OperatorID: params.OperatorID,
		}, now)
	}

	// Find next pending assignment by sequence order
	var nextAssignment assignmentModel
	err := tx.Where("activity_id = ? AND status = ?", activity.ID, "pending").
		Order("sequence ASC").First(&nextAssignment).Error

	if err != nil {
		// No more pending assignments — all done, complete activity
		return e.completeActivity(tx, activity, ProgressParams{
			TicketID:   params.TicketID,
			ActivityID: params.ActivityID,
			Outcome:    "approve",
			Result:     params.Result,
			OperatorID: params.OperatorID,
		}, now)
	}

	// Advance is_current to the next assignment
	tx.Model(&assignmentModel{}).Where("activity_id = ?", activity.ID).Update("is_current", false)
	tx.Model(&assignmentModel{}).Where("id = ?", nextAssignment.ID).Update("is_current", true)

	// Update ticket assignee to the next person
	if nextAssignment.AssigneeID != nil {
		tx.Model(&ticketModel{}).Where("id = ?", params.TicketID).Update("assignee_id", *nextAssignment.AssigneeID)
	}

	e.recordTimeline(tx, params.TicketID, &params.ActivityID, params.OperatorID,
		"approval_sequential", fmt.Sprintf("依次审批：用户 %d 已通过，流转至下一审批人", params.OperatorID))

	return false, nil
}

// completeActivity marks an activity as completed with the given outcome.
func (e *ClassicEngine) completeActivity(tx *gorm.DB, activity *activityModel, params ProgressParams, now time.Time) (bool, error) {
	updates := map[string]any{
		"status":             ActivityCompleted,
		"transition_outcome": params.Outcome,
		"finished_at":        now,
	}
	if len(params.Result) > 0 {
		updates["form_data"] = string(params.Result)
	}
	if err := tx.Model(&activityModel{}).Where("id = ?", params.ActivityID).Updates(updates).Error; err != nil {
		return false, err
	}
	return true, nil
}

// assignParticipants resolves participant definitions and creates assignment records.
func (e *ClassicEngine) assignParticipants(tx *gorm.DB, ticketID, activityID, operatorID uint, participants []Participant) error {
	if len(participants) == 0 {
		// No participants configured — record warning
		e.recordTimeline(tx, ticketID, &activityID, 0, "warning", "节点未配置参与人，等待管理员手动指派")
		return nil
	}

	for i, p := range participants {
		userIDs, err := e.resolver.Resolve(tx, ticketID, p)
		if err != nil {
			e.recordTimeline(tx, ticketID, &activityID, 0, "warning", fmt.Sprintf("参与人解析失败: %v", err))
			continue
		}

		if len(userIDs) == 0 {
			e.recordTimeline(tx, ticketID, &activityID, 0, "warning", fmt.Sprintf("参与人解析结果为空: type=%s value=%s", p.Type, p.Value))
			continue
		}

		for _, uid := range userIDs {
			assignment := &assignmentModel{
				TicketID:        ticketID,
				ActivityID:      activityID,
				ParticipantType: p.Type,
				AssigneeID:      &uid,
				Status:          "pending",
				Sequence:        i,
				IsCurrent:       i == 0,
			}
			if p.Type == "user" {
				assignment.UserID = &uid
			}
			if err := tx.Create(assignment).Error; err != nil {
				return err
			}
		}

		// Update ticket assignee to the first resolved user
		if i == 0 && len(userIDs) > 0 {
			tx.Model(&ticketModel{}).Where("id = ?", ticketID).Update("assignee_id", userIDs[0])
		}
	}

	return nil
}

// recordTimeline creates a timeline entry for a ticket event.
func (e *ClassicEngine) recordTimeline(tx *gorm.DB, ticketID uint, activityID *uint, operatorID uint, eventType, message string) error {
	tl := &timelineModel{
		TicketID:   ticketID,
		ActivityID: activityID,
		OperatorID: operatorID,
		EventType:  eventType,
		Message:    message,
	}
	return tx.Create(tl).Error
}
