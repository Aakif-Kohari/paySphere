const mongoose = require("mongoose");
const {
  ALL_STATUSES,
  PAYROLL_STATUS,
  normalizeStatus,
} = require("../config/payrollStatus");

const payrollUpdateSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },
  employeeName: {
    type: String,
    required: true,
  },
  month: {
    type: Number, // 1-12
    required: true,
  },
  currency: {
    type: String,
    default: "INR",
  },
  year: {
    type: Number,
    required: true,
  },
  baseSalary: {
    type: Number,
    required: true,
  },
  overtimeRate: {
    type: Number,
    default: 0,
  },
  leaveDays: {
    type: Number,
    default: 0,
  },
  overtimeHours: {
    type: Number,
    default: 0,
  },
  bonus: {
    type: Number,
    default: 0,
  },
  deductions: {
    type: Number,
    default: 0,
  },
  customDeductions: [{
    name: String,
    amount: Number
  }],
  leaveDeduction: {
    type: Number,
    default: 0,
  },
  overtimePay: {
    type: Number,
    default: 0,
  },
  netSalary: {
    type: Number,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
  // The approval workflow added in #438 writes "PENDING_APPROVAL"/"APPROVED"/
  // "REJECTED", none of which were in this enum — so every save() path threw a
  // ValidationError and the workflow only appeared to work because it went
  // through updateMany, which skips validators by default (#458).
  //
  // The vocabulary now comes from config/payrollStatus.js, shared with every
  // controller that compares against it. `set` folds the legacy "finalized" and
  // the screaming-snake spellings onto the canonical values so documents
  // written by either older revision keep validating.
  status: {
    type: String,
    enum: ALL_STATUSES,
    default: PAYROLL_STATUS.PENDING_APPROVAL,
    set: (value) => normalizeStatus(value) || value,
  },
  /**
   * The maker–checker trail (#559).
   *
   * #458 mounted the approval routes and wired the controller to write these
   * six fields, but none of them were ever declared here. Two consequences,
   * both silent:
   *
   *   - `getPendingApprovals` calls `.populate("submittedBy", …)`, and mongoose
   *     has had `strictPopulate` on by default since v6 — populating a path
   *     that is not in the schema throws, so the checker queue answered 500.
   *   - Strict mode drops `$set` keys that are not in the schema, so every
   *     approver, timestamp and rejection reason the controller wrote was
   *     discarded before the query left the process.
   *
   * Without `submittedBy` on disk there is also nothing to compare an approver
   * against, so the separation of WRITE_PAYROLL from APPROVE_PAYROLL that
   * config/permissions.js sets up cannot actually be enforced.
   */
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  submittedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: {
    type: Date,
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  rejectedAt: {
    type: Date,
  },
  // Capped here as well as in the controller: the controller's slice only
  // guards the HTTP path, and this field is also written by the migration and
  // by anything that talks to the model directly.
  rejectionReason: {
    type: String,
    maxlength: [500, "Rejection reason cannot exceed 500 characters"],
  },
  /**
   * Where leaveDays and overtimeHours came from.
   *
   * "ledger"  — derived from the validated Attendance document for the month
   * "manual"  — parsed out of the activity tag strings, the pre-#459 path
   *
   * Recorded so an audit of "why was this employee docked three days?" can tell
   * whether the answer is a day-by-day record or a regex over a display label.
   */
  attendanceSource: {
    type: String,
    enum: ["ledger", "manual"],
    default: "manual",
  },
  /**
   * Instalments collected against this payroll row (#460).
   *
   * Stored on the row rather than only on the loan so a payslip regenerated
   * later reproduces the recovery line exactly as it was paid, and so the
   * deduction can be traced back to the loan it serviced.
   */
  loanRecoveries: [{
    loanId: { type: mongoose.Schema.Types.ObjectId, ref: "Loan" },
    amount: { type: Number, default: 0 },
    principalComponent: { type: Number, default: 0 },
    interestComponent: { type: Number, default: 0 },
    scheduledAmount: { type: Number, default: 0 },
    shortfall: { type: Number, default: 0 },
  }],
  loanRecoveryTotal: {
    type: Number,
    default: 0,
  },
  /**
   * The salary component split in force when this row was calculated (#461).
   *
   * Snapshotted rather than looked up at render time, so a payslip regenerated
   * a year later still shows the breakdown that was actually paid instead of
   * the employee's current package.
   */
  salarySnapshot: {
    effectiveGross: { type: Number },
    isProrated: { type: Boolean, default: false },
    segmentCount: { type: Number, default: 1 },
    components: [{
      code: String,
      label: String,
      type: String,
      amount: Number,
    }],
  },
  payslipEmailed: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Ensure one payroll record per employee per month
payrollUpdateSchema.index({ employeeId: 1, month: 1, year: 1, createdBy: 1 }, { unique: true });

payrollUpdateSchema.index({ createdBy: 1, year: -1, month: -1 });

// The approvals queue reads "everything pending, newest first, for this
// account". Without a compound index on the two fields it filters by, that is a
// collection scan on the single largest collection in the product — the exact
// class of problem #241 fixed for the other hot paths.
payrollUpdateSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

// Summary, exports and analytics all filter { createdBy, month, year, status }.
payrollUpdateSchema.index({ createdBy: 1, year: -1, month: -1, status: 1 });

// "What did I submit, and where has it got to?" — the maker's own view of the
// queue, and the lookup an approver-is-not-the-submitter check needs (#559).
payrollUpdateSchema.index({ createdBy: 1, submittedBy: 1, status: 1 });

module.exports = mongoose.model("PayrollUpdate", payrollUpdateSchema);
