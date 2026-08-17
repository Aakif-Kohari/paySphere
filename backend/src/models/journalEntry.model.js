/**
 * @fileoverview GL Mapping & Journal Voucher Schemas
 * @description Maps PaySphere payroll components to external ERP General Ledger (GL) codes
 * and stores generated double-entry journal vouchers.
 * Issue: #986
 */
const mongoose = require('mongoose');

/**
 * Maps internal payroll components to external GL Account codes (e.g., Tally Ledger names)
 */
const glAccountMappingSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  componentKey: {
    type: String,
    required: true,
    enum: [
      'basicSalary', 'hra', 'allowances', 'bonus', 'overtimePay', // Earnings (Debits)
      'employerPF', 'employerESI', // Employer Statutory (Debits)
      'employeePF', 'employeeESI', 'tds', 'professionalTax', 'loanRecovery', 'leaveDeduction' // Deductions (Credits)
    ]
  },
  glAccountName: { type: String, required: true }, // e.g., "Salary - Basic", "PF Payable"
  glAccountCode: { type: String, default: '' }, // Optional numeric code for ERPs
  nature: { type: String, enum: ['Debit', 'Credit'], required: true }
}, { timestamps: true });

glAccountMappingSchema.index({ tenantId: 1, componentKey: 1 }, { unique: true });
const GLAccountMapping = mongoose.model('GLAccountMapping', glAccountMappingSchema);

/**
 * Stores the generated double-entry journal legs for a specific payroll month.
 */
const journalLegSchema = new mongoose.Schema({
  glAccountName: { type: String, required: true },
  glAccountCode: { type: String, default: '' },
  nature: { type: String, enum: ['Debit', 'Credit'], required: true },
  amount: { type: Number, required: true, min: 0 },
  narration: { type: String, default: '' }
}, { _id: false });

const journalVoucherSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  voucherNumber: { type: String, required: true, unique: true }, // e.g., "JV/PAY/2026/08"
  voucherDate: { type: Date, required: true, default: Date.now },
  legs: [journalLegSchema],
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  isBalanced: { type: Boolean, required: true },
  exportedToERP: { type: Boolean, default: false },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

journalVoucherSchema.index({ tenantId: 1, month: 1, year: 1 }, { unique: true });
const JournalVoucher = mongoose.model('JournalVoucher', journalVoucherSchema);

module.exports = { GLAccountMapping, JournalVoucher };
