/**
 * @fileoverview Loan & Amortization Schemas
 * @description Tracks company loans, salary advances, EMI schedules, and 
 * minimum wage guardrails for payroll integration.
 * Issue: #1290
 */
const mongoose = require('mongoose');

const loanPolicySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  maxAdvanceAmount: { type: Number, default: 50000, min: 0 },
  maxLoanAmount: { type: Number, default: 500000, min: 0 },
  maxTenureMonths: { type: Number, default: 24, min: 1 },
  interestRate: { type: Number, default: 0, min: 0, max: 100 }, // Annual %
  interestType: { type: String, enum: ['Flat', 'Reducing'], default: 'Flat' },
  minNetPayProtection: { type: Number, default: 15000, min: 0 }, // Statutory minimum wage guardrail
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const LoanPolicy = mongoose.model('LoanPolicy', loanPolicySchema);

const loanRequestSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  type: { type: String, enum: ['Salary Advance', 'Company Loan'], required: true },
  principalAmount: { type: Number, required: true, min: 0 },
  tenureMonths: { type: Number, required: true, min: 1 },
  interestRate: { type: Number, default: 0 },
  purpose: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Closed'], 
    default: 'Pending',
    index: true 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null }
}, { timestamps: true });

const LoanRequest = mongoose.model('LoanRequest', loanRequestSchema);

const amortizationScheduleSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanRequest', required: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  
  principalComponent: { type: Number, required: true },
  interestComponent: { type: Number, required: true },
  totalEmi: { type: Number, required: true },
  
  status: { 
    type: String, 
    enum: ['Pending', 'Deducted', 'Deferred', 'Prepaid'], 
    default: 'Pending',
    index: true 
  },
  deductionReason: { type: String, default: '' }, // e.g., 'Deferred due to Minimum Wage Guardrail'
  payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { timestamps: true });

amortizationScheduleSchema.index({ loanId: 1, year: 1, month: 1 }, { unique: true });
const AmortizationSchedule = mongoose.model('AmortizationSchedule', amortizationScheduleSchema);

module.exports = { LoanPolicy, LoanRequest, AmortizationSchedule };
