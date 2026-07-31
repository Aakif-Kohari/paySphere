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

module.exports = mongoose.model("PayrollUpdate", payrollUpdateSchema);
