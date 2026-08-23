/**
 * @fileoverview Voluntary Provident Fund (VPF) Calculation & Tax Optimization Utility
 * @description Computes statutory VPF payroll deductions, Section 80C exemptions,
 * and Section 10(11D) ₹2.5L interest taxability thresholds.
 * Issue: #1571
 */

const SECTION_80C_CEILING = 150000;
const TAX_FREE_PF_CONTRIBUTION_THRESHOLD = 250000; // Annual threshold for non-government employees
const STATUTORY_EPF_RATE = 0.12;

/**
 * Calculates monthly VPF deduction based on employee election.
 * Capped at 100% of (Basic + DA) minus statutory 12% EPF (i.e. max 88% of wages).
 *
 * @param {number} basicPay - Monthly basic pay
 * @param {number} dearnessAllowance - Monthly dearness allowance
 * @param {'PERCENTAGE'|'FIXED_AMOUNT'} electionType - Type of election
 * @param {number} electionValue - Percentage (e.g. 10 for 10%) or fixed monthly amount in currency
 * @returns {{ monthlyVpf: number, statutoryEpf: number, totalPfDeduction: number, maxVpfPermissible: number, wages: number }}
 */
function calculateVpfDeduction(basicPay, dearnessAllowance = 0, electionType = 'PERCENTAGE', electionValue = 0) {
  const safeBasic = Math.max(0, Number(basicPay) || 0);
  const safeDa = Math.max(0, Number(dearnessAllowance) || 0);
  const wages = safeBasic + safeDa;

  const statutoryEpf = Math.round(wages * STATUTORY_EPF_RATE);
  const maxVpfPermissible = Math.max(0, wages - statutoryEpf);

  let computedVpf = 0;
  if (electionType === 'PERCENTAGE') {
    const safePercent = Math.max(0, Math.min(100, Number(electionValue) || 0));
    // Percentage is interpreted as additional VPF percentage of wages
    computedVpf = Math.round((wages * safePercent) / 100);
  } else {
    computedVpf = Math.max(0, Number(electionValue) || 0);
  }

  // Cap at permissible limit
  const monthlyVpf = Math.min(computedVpf, maxVpfPermissible);
  const totalPfDeduction = statutoryEpf + monthlyVpf;

  return {
    wages,
    statutoryEpf,
    monthlyVpf,
    totalPfDeduction,
    maxVpfPermissible,
  };
}

/**
 * Evaluates annual PF tax exemption under Section 80C and interest taxability under Section 10(11D).
 *
 * @param {number} ytdEpf - Year-to-date statutory EPF contributed
 * @param {number} ytdVpf - Year-to-date VPF contributed
 * @param {number} projectedAnnualVpf - Projected remaining VPF contributions for current FY
 * @param {number} other80CInvestments - Other 80C investments (e.g. PPF, ELSS, Life Insurance)
 * @returns {{ totalAnnualPf: number, section80CClaimable: number, taxableExcessContribution: number, isExceedingInterestThreshold: boolean }}
 */
function evaluateVpfTaxExemption(ytdEpf = 0, ytdVpf = 0, projectedAnnualVpf = 0, other80CInvestments = 0) {
  const safeEpf = Math.max(0, Number(ytdEpf) || 0);
  const safeVpf = Math.max(0, Number(ytdVpf) || 0);
  const safeProj = Math.max(0, Number(projectedAnnualVpf) || 0);
  const safeOther = Math.max(0, Number(other80CInvestments) || 0);

  const totalAnnualPf = safeEpf + safeVpf + safeProj;
  const total80CQualifying = totalAnnualPf + safeOther;

  const section80CClaimable = Math.min(SECTION_80C_CEILING, total80CQualifying);
  const taxableExcessContribution = Math.max(0, totalAnnualPf - TAX_FREE_PF_CONTRIBUTION_THRESHOLD);
  const isExceedingInterestThreshold = taxableExcessContribution > 0;

  return {
    totalAnnualPf,
    section80CClaimable,
    taxableExcessContribution,
    isExceedingInterestThreshold,
    thresholdLimit: TAX_FREE_PF_CONTRIBUTION_THRESHOLD,
    section80CCeiling: SECTION_80C_CEILING,
  };
}

/**
 * Generates VPF monthly electronic challan rollup item for EPFO reporting.
 */
function generateVpfEcrLineItem(employeeId, uan, memberName, wages, statutoryEpf, monthlyVpf, month, year) {
  return {
    employeeId,
    uan: uan || 'N/A',
    memberName: memberName || 'Employee',
    month,
    year,
    epfWages: wages,
    statutoryEpfEmployeeShare: statutoryEpf,
    vpfEmployeeContribution: monthlyVpf,
    totalEmployeePfRemitted: statutoryEpf + monthlyVpf,
  };
}

module.exports = {
  SECTION_80C_CEILING,
  TAX_FREE_PF_CONTRIBUTION_THRESHOLD,
  STATUTORY_EPF_RATE,
  calculateVpfDeduction,
  evaluateVpfTaxExemption,
  generateVpfEcrLineItem,
};
