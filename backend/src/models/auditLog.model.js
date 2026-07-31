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
    enum: ["Payroll", "Employee", "User", "Report", "Attendance"],
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
