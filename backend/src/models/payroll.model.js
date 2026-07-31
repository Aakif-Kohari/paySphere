const mongoose = require("mongoose");

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
  status: {
    type: String,
    enum: ["finalized", "paid"],
    default: "finalized",
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
  payslipEmailed: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Ensure one payroll record per employee per month
payrollUpdateSchema.index({ employeeId: 1, month: 1, year: 1, createdBy: 1 }, { unique: true });

payrollUpdateSchema.index({ createdBy: 1, year: -1, month: -1 });

module.exports = mongoose.model("PayrollUpdate", payrollUpdateSchema);
