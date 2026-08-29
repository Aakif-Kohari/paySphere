## Summary

PaySphere has a multi-stage payroll approval chain (HR -> Manager -> Finance) but the entire workflow is fire-and-forget. If two approvers act simultaneously on the same payroll batch, the second write silently overwrites the first. There is no real-time visibility into who is reviewing what, no stage-locking, no comment trail on rejection, and no escalation timer when an approver is inactive.

## Problem Statement

The current payroll approval flow has four critical gaps:

1. **Race condition on concurrent approval**: payroll.status is updated with a raw indByIdAndUpdate with no optimistic-locking version check. Two approvers can act simultaneously and the last write wins silently.
2. **No stage locking**: Any approver at any stage can call the approval endpoint regardless of whose turn it is in the chain. An employee could theoretically approve their own payroll if they guess the endpoint.
3. **Dead comment trail**: The rejection reason field exists on the model but nothing enforces it. A rejection with eason: undefined goes through, leaving finance with no audit context.
4. **No escalation**: If the stage-2 approver has been on leave for 10 days and hasn't touched 30 pending payrolls, nothing escalates them. Salary disbursement blocks silently.

## Proposed Implementation

### Backend

- **workflowInstance.model.js extension**: Add ersion (Mongoose ersionKey or explicit counter), stageLog[] (timestamps + actor + comment per stage), escalationDeadlineAt, lockedBy / lockedAt fields.
- **payrollApproval.service.js** (new): Encapsulates the full approval state machine:
  - dvanceStage(workflowInstanceId, actorId, action, comment) — uses MongoDB indOneAndUpdate with version assertion ({ __v: expectedVersion }) to provide optimistic concurrency control; throws 409 Conflict on stale update.
  - lockStage(workflowInstanceId, actorId) — sets lockedBy/lockedAt with a 10-minute TTL; returns 423 if already locked by a different actor.
  - eleaselock(workflowInstanceId, actorId) — clears the lock if actor matches.
  - escalateStaleApprovals(maxAgeMs) — BullMQ scheduled job that finds instances past escalationDeadlineAt, advances them to the escalation state, and dispatches APPROVAL_ESCALATED via NotificationDispatcher.
- **payrollApproval.controller.js** (new): POST /api/payroll/:payrollId/approve, POST /api/payroll/:payrollId/reject, POST /api/payroll/:payrollId/lock, DELETE /api/payroll/:payrollId/lock.
- **pprovalEscalation.job.js** (new): BullMQ repeatable job registered in jobs/cron.jobs.js, runs every 15 minutes, calls escalateStaleApprovals.

### Frontend

- **PayrollApprovalPanel.jsx** (new): Shows the stage chain, current lock holder, per-stage actor + timestamp, and comment. Polls via GET /api/payroll/:id/approval-status every 15 seconds.
- **Socket.IO event payroll:stage_changed**: Pushed on every dvanceStage call; the panel subscribes and re-renders without polling.

## Files Affected

- ackend/src/models/workflowInstance.model.js — extend schema
- ackend/src/services/payrollApproval.service.js — new
- ackend/src/controllers/payrollApproval.controller.js — new
- ackend/src/routes/payrollApproval.routes.js — new
- ackend/src/jobs/approvalEscalation.job.js — new
- ackend/src/app.js — mount new routes
- rontend/src/pages/Payroll.jsx — integrate panel
- rontend/src/components/PayrollApprovalPanel.jsx — new

## Acceptance Criteria

- [ ] Two concurrent approvals to the same payroll instance return 409 to the second caller, not a silent overwrite.
- [ ] A stage-2 approver cannot act before stage 1 is complete.
- [ ] Rejection without a comment returns 422 with eason is required.
- [ ] Escalation job fires within 15 minutes of escalationDeadlineAt and delivers an in-app notification to the tenant admin.
- [ ] GET /api/payroll/:id/approval-status returns the full stage log with actor IDs and timestamps.
- [ ] Socket.IO event updates the frontend panel without a page reload.
