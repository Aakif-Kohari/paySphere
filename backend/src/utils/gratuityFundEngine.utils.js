/**
 * @fileoverview Statutory Gratuity & Actuarial Valuation Engine
 * @description Computes statutory gratuity accruals, group gratuity trust (GGT)
 * provisions, 5-year vesting milestones, and double-entry liability journals.
 * Issue: #1572
 */

const STATUTORY_GRATUITY_CEILING = 2000000; // ₹20 Lakhs
const VESTING_YEARS_MANDATE = 5;

/**
 * Calculates statutory gratuity liability under Payment of Gratuity Act 1972.
 *
 * @param {number} basicPay - Monthly basic pay
 * @param {number} dearnessAllowance - Monthly dearness allowance
 * @param {number} totalServiceMonths - Total completed months of service
 * @param {boolean} isExceptionalVesting - True for death or permanent disability (bypasses 5-year rule)
 * @returns {{ wages: number, completedYears: number, isVested: boolean, accruedGratuity: number, statutoryCeiling: number, formulaDescription: string }}
 */
function computeGratuityAccrual(basicPay, dearnessAllowance = 0, totalServiceMonths = 0, isExceptionalVesting = false) {
  const safeBasic = Math.max(0, Number(basicPay) || 0);
  const safeDa = Math.max(0, Number(dearnessAllowance) || 0);
  const wages = safeBasic + safeDa;

  const rawYears = Math.floor(totalServiceMonths / 12);
  const remainingMonths = totalServiceMonths % 12;

  // Rounding rule: >= 6 months rounds up to a full year
  const completedYears = remainingMonths >= 6 ? rawYears + 1 : rawYears;
  const isVested = completedYears >= VESTING_YEARS_MANDATE || Boolean(isExceptionalVesting);

  let rawGratuity = 0;
  if (completedYears > 0) {
    rawGratuity = Math.round((15 * wages * completedYears) / 26);
  }

  const accruedGratuity = Math.min(rawGratuity, STATUTORY_GRATUITY_CEILING);

  return {
    wages,
    serviceMonths: totalServiceMonths,
    completedYears,
    isVested,
    rawGratuity,
    accruedGratuity: isVested ? accruedGratuity : 0,
    contingentLiability: isVested ? 0 : accruedGratuity, // Unvested accrued liability
    statutoryCeiling: STATUTORY_GRATUITY_CEILING,
    formulaDescription: '15 * (Basic + DA) * Completed Years / 26 (Capped at ₹20L)',
  };
}

/**
 * Computes actuarial valuation and required quarterly trust provisioning for an organization.
 *
 * @param {Array<object>} employees - List of employee objects with salary & service records
 * @param {number} discountRate - Actuarial annual discount rate (e.g. 0.0725 for 7.25%)
 * @returns {{ totalHeadcount: number, totalVestedLiability: number, totalContingentLiability: number, presentValuedLiability: number, quarterlyProvisionRequirement: number }}
 */
function generateActuarialValuationSummary(employees = [], discountRate = 0.0725) {
  let totalVestedLiability = 0;
  let totalContingentLiability = 0;
  const evaluatedStaff = [];

  for (const emp of employees) {
    const basic = emp.basic || emp.salaryDetails?.basic || emp.baseSalary || 50000;
    const da = emp.da || emp.salaryDetails?.da || 0;
    const months = emp.serviceMonths || (emp.tenureYears ? emp.tenureYears * 12 : 36);

    const accrual = computeGratuityAccrual(basic, da, months, emp.isExceptionalVesting);
    evaluatedStaff.push({
      employeeId: emp._id || emp.id || emp.employeeId,
      name: emp.name || emp.fullName || 'Employee',
      ...accrual,
    });

    totalVestedLiability += accrual.accruedGratuity;
    totalContingentLiability += accrual.contingentLiability;
  }

  // Actuarial present valuation factoring in discount rate
  const factor = 1 / (1 + Math.max(0.01, discountRate));
  const presentValuedLiability = Math.round(totalVestedLiability * factor);
  const quarterlyProvisionRequirement = Math.round(totalVestedLiability / 4);

  return {
    totalHeadcount: employees.length,
    discountRate,
    totalVestedLiability,
    totalContingentLiability,
    totalAccruedGrossLiability: totalVestedLiability + totalContingentLiability,
    presentValuedLiability,
    quarterlyProvisionRequirement,
    evaluatedStaff,
  };
}

/**
 * Generates double-entry accounting journal entries for Gratuity Provision.
 */
function generateGratuityJournalEntry(period, provisionAmount, companyName = 'PaySphere Enterprise') {
  const safeAmount = Math.max(0, Number(provisionAmount) || 0);

  return {
    journalId: `JV-GRATUITY-${period}-${Date.now().toString(36).toUpperCase()}`,
    period,
    companyName,
    createdAt: new Date().toISOString(),
    currency: 'INR',
    entries: [
      {
        accountCode: 'EXP-6040',
        accountName: 'Gratuity & Retiral Benefits Expense',
        debit: safeAmount,
        credit: 0,
      },
      {
        accountCode: 'LIAB-2040',
        accountName: 'Provision for Employee Gratuity Trust Reserve',
        debit: 0,
        credit: safeAmount,
      },
    ],
    isBalanced: true,
  };
}

module.exports = {
  STATUTORY_GRATUITY_CEILING,
  VESTING_YEARS_MANDATE,
  computeGratuityAccrual,
  generateActuarialValuationSummary,
  generateGratuityJournalEntry,
};
