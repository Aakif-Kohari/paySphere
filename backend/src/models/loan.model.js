const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const {
  INTEREST_METHOD,
  LOAN_TYPE,
  LOAN_STATUS,
  MAX_TENURE_MONTHS,
  MAX_PRINCIPAL,
  MAX_INTEREST_RATE_PERCENT,
} = require('../utils/loanSchedule');

/**
 * A salary advance or loan, and its repayment ledger (#460).
 *
 * Before this, an advance could only be modelled by the admin remembering to
 * add a manual `deductions` figure every month — a per-month scalar with no
 * link to a principal, no balance, and nothing that stopped the recovery from
 * over-collecting once they forgot which month they were on.
 */

/**
 * One collected instalment.
 *
 * Keyed by { month, year } rather than appended blindly: the approval workflow
 * explicitly allows a rejected run to be re-submitted, so the same month can be
 * finalised more than once. Replacing the entry for a period instead of adding
 * a second one is what makes recovery idempotent.
 */
const repaymentSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    amount: { type: Number, required: true, min: 0 },
    principalComponent: { type: Number, default: 0, min: 0 },
    interestComponent: { type: Number, default: 0, min: 0 },
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollUpdate',
    },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/** A projected instalment. Frozen at issue time so the terms cannot drift. */
const scheduleRowSchema = new mongoose.Schema(
  {
    installmentNumber: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    amount: { type: Number, required: true, min: 0 },
    principalComponent: { type: Number, default: 0 },
    interestComponent: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
  },
  { _id: false },
);

const loanSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeName: { type: String, required: true },
    /**
     * Who created this row. An audit fact, not a scoping key.
     *
     * #585's codemod rewrote every `createdBy: req.userId` in the controllers
     * to `tenantId: req.tenantId` while leaving this field `required: true`, so
     * every insert omitted a field the schema demanded and `create()` threw
     * before reaching Mongo (#613). Both fields are written now: this one
     * records the actor, `tenantId` below decides who can see the row.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /**
     * Which company this row belongs to — the field every read filters on.
     *
     * Separate from `createdBy` because a company can have more than one admin,
     * and a row created by one of them has to stay visible to the others.
     */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(LOAN_TYPE),
      default: LOAN_TYPE.ADVANCE,
    },

    // --- Terms, frozen at issue -------------------------------------------
    principal: {
      type: Number,
      required: true,
      min: [1, 'Principal must be positive'],
      max: [MAX_PRINCIPAL, `Principal cannot exceed ${MAX_PRINCIPAL}`],
    },
    interestMethod: {
      type: String,
      enum: Object.values(INTEREST_METHOD),
      default: INTEREST_METHOD.NONE,
    },
    interestRatePercent: {
      type: Number,
      default: 0,
      min: [0, 'Interest rate cannot be negative'],
      max: [
        MAX_INTEREST_RATE_PERCENT,
        `Interest rate cannot exceed ${MAX_INTEREST_RATE_PERCENT}%`,
      ],
    },
    tenureMonths: {
      type: Number,
      required: true,
      min: [1, 'Tenure must be at least one month'],
      max: [
        MAX_TENURE_MONTHS,
        `Tenure cannot exceed ${MAX_TENURE_MONTHS} months`,
      ],
    },
    installmentAmount: { type: Number, required: true, min: 0 },
    totalPayable: { type: Number, required: true, min: 0 },
    totalInterest: { type: Number, default: 0, min: 0 },

    startMonth: { type: Number, required: true, min: 1, max: 12 },
    startYear: { type: Number, required: true, min: 2000, max: 2100 },

    schedule: [scheduleRowSchema],

    // --- Live state --------------------------------------------------------
    status: {
      type: String,
      enum: Object.values(LOAN_STATUS),
      default: LOAN_STATUS.ACTIVE,
    },
    repayments: [repaymentSchema],
    totalRepaid: { type: Number, default: 0, min: 0 },
    outstanding: { type: Number, default: 0, min: 0 },

    reason: {
      type: String,
      default: '',
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    statusNote: {
      type: String,
      default: '',
      maxlength: [500, 'Status note cannot exceed 500 characters'],
    },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

// The recovery step asks "which loans are active for this employee?" on every
// payroll run, and the dashboard asks "what is outstanding across the company?".
//
// Both lead with `tenantId` because that is what the queries filter on since
// #585. They led with `createdBy` until #613, so the rewritten queries had no
// index behind them (#613).
loanSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
loanSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

/**
 * @returns {boolean} whether the loan can still be collected against
 */
loanSchema.methods.isCollectible = function isCollectible() {
  return this.status === LOAN_STATUS.ACTIVE && this.outstanding > 0;
};

loanSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Loan', loanSchema);
