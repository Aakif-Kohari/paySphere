/**
 * Mongoose domain model for Enterprise Payroll Garnishment & Statutory Tax Liens.
 * Tracks court-ordered wage garnishments (Child Support, Student Loans, Tax Liens, Creditor Liens),
 * statutory disposable earnings caps (CCPA 50-65% limits), priority deduction rules, and remitted payments.
 */

const mongoose = require('mongoose');

const GarnishmentRemittanceSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  remittanceId: { type: String, required: true },
  amountRemittedUsd: { type: Number, required: true },
  agencyReferenceNumber: { type: String, required: true },
  remittanceStatus: {
    type: String,
    enum: ['REMITTED', 'PENDING_PAYROLL_RUN', 'HELD_COURT_STAY'],
    default: 'REMITTED',
  },
});

const EnterpriseGarnishmentSchema = new mongoose.Schema(
  {
    garnishmentId: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeFullName: { type: String, required: true },
    garnishmentType: {
      type: String,
      enum: ['CHILD_SUPPORT', 'FEDERAL_TAX_LIEN', 'STUDENT_LOAN', 'CREDITOR_GARNISHMENT', 'STATE_TAX_LIEN'],
      required: true,
    },
    courtOrderCaseNumber: { type: String, required: true },
    issuingAgencyName: { type: String, required: true },
    totalOrderedAmountUsd: { type: Number, required: true },
    remainingBalanceUsd: { type: Number, required: true },
    deductionPerPayPeriodUsd: { type: Number, required: true },
    disposableEarningsCapPercentage: { type: Number, default: 50.0 }, // CCPA limit (50%-65%)
    priorityRank: { type: Number, default: 1 }, // 1 = Highest Priority (Child Support)
    remittances: [GarnishmentRemittanceSchema],
    garnishmentStatus: {
      type: String,
      enum: ['ACTIVE_DEDUCTION', 'SATISFIED_PAID', 'COURT_ORDER_STAY', 'SUSPENDED'],
      default: 'ACTIVE_DEDUCTION',
    },
    payrollAdministratorId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnterpriseGarnishment', EnterpriseGarnishmentSchema);
