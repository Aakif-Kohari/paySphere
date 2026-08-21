/**
 * Mongoose domain model for Enterprise Payroll Pension & Annuity Fund Engine.
 * Tracks retiree annuity accounts, pension contribution formulas, defined benefit vs defined contribution plans,
 * monthly annuity payouts, tax withholdings, and statutory pension compliance telemetry.
 */

const mongoose = require('mongoose');

const PensionDisbursementSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  disbursementId: { type: String, required: true },
  grossAnnuityAmount: { type: Number, required: true },
  taxWithheldAmount: { type: Number, required: true },
  netDisbursedAmount: { type: Number, required: true },
  disbursementStatus: {
    type: String,
    enum: ['SUCCESSFUL', 'PENDING_BANK_CLEARANCE', 'TAX_HOLD', 'FAILED'],
    default: 'SUCCESSFUL',
  },
  bankReferenceNumber: { type: String, required: true },
});

const EnterprisePensionSchema = new mongoose.Schema(
  {
    pensionAccountId: { type: String, required: true, unique: true },
    retireeEmployeeId: { type: String, required: true },
    retireeFullName: { type: String, required: true },
    pensionPlanType: {
      type: String,
      enum: ['DEFINED_BENEFIT', 'DEFINED_CONTRIBUTION', 'HYBRID_CASH_BALANCE', 'ANNUITY_GUARANTEED'],
      required: true,
    },
    accumulatedCorpusAmount: { type: Number, required: true },
    monthlyAnnuityPayout: { type: Number, required: true },
    vestingStatus: {
      type: String,
      enum: ['FULLY_VESTED', 'PARTIALLY_VESTED', 'UNVESTED'],
      default: 'FULLY_VESTED',
    },
    taxWithholdingRatePercentage: { type: Number, default: 10.0 },
    disbursements: [PensionDisbursementSchema],
    accountStatus: {
      type: String,
      enum: ['ACTIVE_DISBURSEMENT', 'SUSPENDED_AUDIT', 'TERMINATED', 'SURVIVOR_BENEFIT_ACTIVE'],
      default: 'ACTIVE_DISBURSEMENT',
    },
    fundManagerId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnterprisePension', EnterprisePensionSchema);
