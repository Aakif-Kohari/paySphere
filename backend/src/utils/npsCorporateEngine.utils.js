/**
 * @fileoverview Corporate NPS Contribution & Section 80CCD(2) Tax Optimization Engine
 * @description Computes statutory corporate NPS Tier-1 deductions, salary restructuring tax savings,
 * and CRA PRAN batch remittance records.
 * Issue: #1574
 */

const MAX_CORPORATE_NPS_PERCENT_PRIVATE = 10; // 10% of Basic + DA for Private Sector
const MAX_CORPORATE_NPS_PERCENT_GOV = 14;     // 14% of Basic + DA for Government Sector
const SECTION_17_2_VII_ANNUAL_CAP = 750000;   // ₹7.5L combined employer retiral cap

/**
 * Calculates monthly corporate NPS contribution under Section 80CCD(2).
 *
 * @param {number} basicPay - Monthly basic pay
 * @param {number} dearnessAllowance - Monthly dearness allowance
 * @param {number} contributionPercent - Chosen contribution percentage (1% to 10%)
 * @param {boolean} isGovSector - Government sector flag
 * @returns {{ monthlyContribution: number, annualContribution: number, maxPermissiblePercent: number, eligibleWages: number, effectivePercent: number }}
 */
function computeCorporateNpsContribution(basicPay, dearnessAllowance = 0, contributionPercent = 10, isGovSector = false) {
  const safeBasic = Math.max(0, Number(basicPay) || 0);
  const safeDa = Math.max(0, Number(dearnessAllowance) || 0);
  const eligibleWages = safeBasic + safeDa;

  const maxPermissiblePercent = isGovSector ? MAX_CORPORATE_NPS_PERCENT_GOV : MAX_CORPORATE_NPS_PERCENT_PRIVATE;
  const effectivePercent = Math.max(0, Math.min(maxPermissiblePercent, Number(contributionPercent) || 0));

  const monthlyContribution = Math.round((eligibleWages * effectivePercent) / 100);
  const annualContribution = monthlyContribution * 12;

  return {
    eligibleWages,
    effectivePercent,
    maxPermissiblePercent,
    monthlyContribution,
    annualContribution,
  };
}

/**
 * Simulates tax savings and take-home salary impact of Corporate NPS restructuring.
 *
 * @param {number} annualBasic - Annual basic wages (Basic + DA)
 * @param {number} contributionPercent - Selected corporate NPS percentage
 * @param {number} marginalTaxRate - Marginal tax slab rate (e.g. 0.30 for 30% + 4% cess = 0.312)
 * @returns {{ annualNpsContribution: number, annualTaxSaved: number, monthlyNetTakeHomeImpact: number, effectiveTaxReliefPercent: number }}
 */
function simulateNpsTaxSavings(annualBasic, contributionPercent = 10, marginalTaxRate = 0.312) {
  const safeAnnualBasic = Math.max(0, Number(annualBasic) || 0);
  const rate = Math.max(0, Math.min(MAX_CORPORATE_NPS_PERCENT_PRIVATE, Number(contributionPercent) || 0));

  const annualNpsContribution = Math.round((safeAnnualBasic * rate) / 100);
  const annualTaxSaved = Math.round(annualNpsContribution * marginalTaxRate);
  const netTakeHomeReduction = annualNpsContribution - annualTaxSaved;
  const monthlyNetTakeHomeImpact = Math.round(netTakeHomeReduction / 12);

  return {
    annualBasic: safeAnnualBasic,
    contributionPercent: rate,
    annualNpsContribution,
    annualTaxSaved,
    monthlyTaxSaved: Math.round(annualTaxSaved / 12),
    annualTakeHomeReduction: netTakeHomeReduction,
    monthlyNetTakeHomeImpact,
    effectiveTaxReliefPercent: Math.round(marginalTaxRate * 1000) / 10,
  };
}

/**
 * Formats a standardized monthly PRAN batch contribution record for CRA upload.
 */
function generatePranBatchRemittanceItem(employeeId, pranNumber, employeeName, employerNpsAmount, employeeNpsAmount = 0, month, year) {
  const safePran = String(pranNumber || '').trim();
  const isValidPran = /^\d{12}$/.test(safePran);

  return {
    employeeId,
    pranNumber: safePran,
    isValidPran,
    employeeName: employeeName || 'Employee',
    month,
    year,
    employerTier1Contribution: employerNpsAmount,
    employeeTier1Contribution: employeeNpsAmount,
    totalNpsRemitted: employerNpsAmount + employeeNpsAmount,
  };
}

module.exports = {
  MAX_CORPORATE_NPS_PERCENT_PRIVATE,
  MAX_CORPORATE_NPS_PERCENT_GOV,
  SECTION_17_2_VII_ANNUAL_CAP,
  computeCorporateNpsContribution,
  simulateNpsTaxSavings,
  generatePranBatchRemittanceItem,
};
