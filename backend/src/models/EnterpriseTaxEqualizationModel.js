/**
 * Mongoose domain model for Enterprise Global Mobility & Tax Equalization Engine.
 * Tracks expatriate tax profiles, hypo-tax deductions, host vs home tax differential balances,
 * tax treaty exemptions (OECD Article 15 / US Section 911 FEIE), and year-end reconciliation audit trails.
 */

const mongoose = require('mongoose');

const TaxSettlementSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  settlementId: { type: String, required: true },
  settlementType: {
    type: String,
    enum: ['EMPLOYEE_OWES_COMPANY', 'COMPANY_OWES_EMPLOYEE', 'NEUTRAL_BALANCED'],
    required: true,
  },
  amountUsd: { type: Number, required: true },
  settlementStatus: {
    type: String,
    enum: ['SETTLED', 'PENDING_RECONCILIATION', 'DISPUTED_AUDIT'],
    default: 'SETTLED',
  },
  referenceTransactionId: { type: String, required: true },
});

const EnterpriseTaxEqualizationSchema = new mongoose.Schema(
  {
    profileId: { type: String, required: true, unique: true },
    expatriateEmployeeId: { type: String, required: true },
    expatriateFullName: { type: String, required: true },
    homeCountryCode: { type: String, required: true }, // e.g. USA, GBR, DEU
    hostCountryCode: { type: String, required: true }, // e.g. SGP, JPN, CHE
    hypotheticalTaxPercentage: { type: Number, required: true }, // Tax rate employee would pay in home country
    actualHostTaxRatePercentage: { type: Number, required: true }, // Tax rate in host assignment country
    annualBaseSalaryUsd: { type: Number, required: true },
    annualExpatAllowancesUsd: { type: Number, default: 0 }, // COLA, housing, education stipends
    equalizationDifferentialBalanceUsd: { type: Number, default: 0 },
    taxTreatyExemptionStatus: {
      type: String,
      enum: ['FEIE_SECTION_911_ACTIVE', 'OECD_183_DAY_RULE_EXEMPT', 'DOUBLE_TAXATION_CREDIT_APPLIED', 'FULL_TAXABLE'],
      default: 'FEIE_SECTION_911_ACTIVE',
    },
    settlements: [TaxSettlementSchema],
    profileStatus: {
      type: String,
      enum: ['ACTIVE_ASSIGNMENT', 'RECONCILIATION_PENDING', 'ASSIGNMENT_COMPLETED'],
      default: 'ACTIVE_ASSIGNMENT',
    },
    taxAdvisoryPartnerId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnterpriseTaxEqualization', EnterpriseTaxEqualizationSchema);
