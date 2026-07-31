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
      "EMPLOYEE_CREATE",
      "EMPLOYEE_UPDATE",
      "EMPLOYEE_DELETE",
      "EMPLOYEE_IMPORT",
      // A salary advance commits future deductions from someone's pay, so
      // issuing, pausing and collecting against one are all financial events
      // and are audited as such (#460).
      "LOAN_ISSUE",
      "LOAN_STATUS_CHANGE",
      "LOAN_REPAYMENT",
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
    enum: ["Payroll", "Employee", "User", "Report", "Loan"],
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
