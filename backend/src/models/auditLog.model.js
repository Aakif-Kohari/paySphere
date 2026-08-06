const mongoose = require("mongoose");

/**
 * Every action a controller emits an `AUDIT_LOG` event for.
 *
 * Exported, and asserted against the emit sites by
 * `listeners/__tests__/auditActions.coverage.test.js`. Eight of these were
 * missing when #664 was filed — `EMPLOYEE_STATUS_TOGGLE`, `EMPLOYEE_RESTORE`,
 * the three `SALARY_HISTORY_*` and the three `WORKFLOW_*` — because the
 * features that emit them were added without touching this enum. Since
 * `createAuditLog` swallows its own errors, those writes would have failed
 * validation and been dropped with a log line nobody reads, which is a subtler
 * version of the same bug the listener had.
 */
const AUDIT_ACTIONS = [
  "PAYROLL_FINALIZE",
  // #438 shipped approve/reject handlers that emitted no audit event at
  // all, so the one action a maker–checker flow exists to record was the
  // one action left untracked (#458).
  "PAYROLL_APPROVE",
  "PAYROLL_REJECT",
  "EMPLOYEE_CREATE",
  "EMPLOYEE_UPDATE",
  "EMPLOYEE_DELETE",
  "EMPLOYEE_IMPORT",
  // Deactivating someone stops their payroll, and restoring a soft-deleted
  // record brings their history back. Both are emitted by
  // employee.controller.js and neither was accepted here (#664).
  "EMPLOYEE_STATUS_TOGGLE",
  "EMPLOYEE_RESTORE",
  // Attendance drives leaveDays and overtimeHours into the salary
  // calculation, so editing it is a financial mutation and is audited
  // like one (#459).
  "ATTENDANCE_UPDATE",
  "ATTENDANCE_BULK_UPDATE",
  // Offboarding is a financial event: it produces a final payout and
  // removes someone from the headcount (#462).
  "EMPLOYEE_EXIT_INITIATED",
  "SETTLEMENT_CREATE",
  "SETTLEMENT_STATUS_CHANGE",
  // A salary advance commits future deductions from someone's pay, so
  // issuing, pausing and collecting against one are all financial events
  // and are audited as such (#460).
  "LOAN_ISSUE",
  "LOAN_STATUS_CHANGE",
  "LOAN_REPAYMENT",
  // EMPLOYEE_UPDATE records only the *names* of the fields that changed,
  // so a salary change left no trace of what it changed from. This one
  // carries the before/after (#461).
  "SALARY_REVISION",
  // The salary history endpoints emit their own three (#664).
  "SALARY_HISTORY_CREATE",
  "SALARY_HISTORY_EXPORT",
  "SALARY_HISTORY_DELETE",
  // The approval workflow engine (#590, mounted in #614) emits three (#664).
  // A change to the graph that decides who may approve a payroll run is
  // exactly the kind of thing an auditor asks about.
  "WORKFLOW_CREATE",
  "WORKFLOW_INSTANCE_START",
  "WORKFLOW_TRANSITION",
  "PAYSLIP_EMAIL",
  "PAYSLIP_BULK_EMAIL",
  "REPORT_DOWNLOAD",
  "ACCOUNT_DELETE",
  "SETTINGS_UPDATE",
  "PASSWORD_UPDATE",
];

/** Every resource type a controller emits. Same story as the actions above. */
const AUDIT_RESOURCE_TYPES = [
  "Payroll",
  "Employee",
  "User",
  "Report",
  "Attendance",
  "Settlement",
  "Loan",
  "SalaryHistory",
  "Workflow",
  "WorkflowInstance",
];

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  /**
   * The company the action happened in — the field the read endpoints filter
   * on.
   *
   * Added in #664. Before it, `AuditLog` had no tenant at all and
   * `audit.controller.js` filtered on `userId: req.userId`, so the trail was a
   * personal diary: an owner reviewing who approved a payroll run saw only the
   * runs they approved themselves, and every action by the other admins and HR
   * managers in the same company was invisible to them. #458 deliberately split
   * approve from write so two different people are involved in a payroll run —
   * and then neither could see the other's half of it.
   *
   * Required. There is no such thing as an audit entry that belongs to no
   * company, and a nullable tenant on a scoped collection is how you end up
   * with `{ tenantId: undefined }` silently matching everything — see
   * utils/tenantScope.js.
   */
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },

  action: {
    type: String,
    required: true,
    enum: AUDIT_ACTIONS,
  },
  resourceType: {
    type: String,
    enum: AUDIT_RESOURCE_TYPES,
    required: true,
  },
  resourceIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
    },
  ],
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  result: {
    type: String,
    enum: ["success", "failure", "partial"],
    default: "success",
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, { timestamps: true });

// The read path is "this company's trail, newest first", optionally narrowed to
// one actor or one action — so the tenant leads every index.
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports.AUDIT_RESOURCE_TYPES = AUDIT_RESOURCE_TYPES;
