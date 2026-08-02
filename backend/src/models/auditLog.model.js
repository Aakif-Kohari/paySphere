const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
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
      "PAYSLIP_EMAIL",
      "PAYSLIP_BULK_EMAIL",
      "REPORT_DOWNLOAD",
      "ACCOUNT_DELETE",
      "SETTINGS_UPDATE",
      "PASSWORD_UPDATE",
    ],
  },
  resourceType: {
    type: String,
    enum: ["Payroll", "Employee", "User", "Report", "Attendance", "Settlement", "Loan"],
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

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
