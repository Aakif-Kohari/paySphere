/**
 * @fileoverview Tax Equalization & COLA Engine
 * @description Calculates hypothetical home taxes, host shadow taxes, 
 * and Cost of Living Adjustments (COLA) for global mobility.
 * Issue: #1471
 */

/**
 * Calculates the Cost of Living Adjustment (COLA) allowance.
 * @param {number} baseSalaryHome - Base salary in home currency
 * @param {number} colaIndex - COLA multiplier (e.g., 1.25)
 * @returns {number} The additional COLA allowance amount
 */
function calculateCOLA(baseSalaryHome, colaIndex) {
    if (colaIndex <= 1.0) return 0;
    // COLA is typically applied to a portion of the base salary (e.g., 60% for spendable income)
    const spendableIncomeRatio = 0.60;
    const spendableIncome = baseSalaryHome * spendableIncomeRatio;
    const colaAmount = spendableIncome * (colaIndex - 1.0);

    return Math.round(colaAmount * 100) / 100;
}

/**
 * Calculates the "Hypothetical Tax" - the tax the employee would have paid 
 * if they had remained in their home country.
 * 
 * @param {number} homeGrossPay - Total gross pay in home currency (Base + COLA + Bonuses)
 * @param {number} hypotheticalTaxRate - The effective home country tax rate
 * @returns {number} Hypothetical tax amount to be deducted from home payroll
 */
function calculateHypotheticalTax(homeGrossPay, hypotheticalTaxRate) {
    return Math.round(homeGrossPay * hypotheticalTaxRate * 100) / 100;
}

/**
 * Calculates the shadow payroll tax liability in the host country.
 * 
 * @param {number} hostGrossPay - Gross pay in host currency
 * @param {number} hostTaxRate - Effective host country tax rate
 * @param {number} hostSocialSecurityRate - Host country social security rate
 * @returns {{ hostTax: number, hostSocialSecurity: number, hostNet: number }}
 */
function calculateShadowTax(hostGrossPay, hostTaxRate, hostSocialSecurityRate) {
    const hostTax = Math.round(hostGrossPay * hostTaxRate * 100) / 100;
    const hostSocialSecurity = Math.round(hostGrossPay * hostSocialSecurityRate * 100) / 100;
    const hostNet = Math.round((hostGrossPay - hostTax - hostSocialSecurity) * 100) / 100;

    return { hostTax, hostSocialSecurity, hostNet };
}

/**
 * Reconciles the tax equalization cost borne by the company.
 * The company pays the actual host tax, but deducts the hypothetical tax from the employee.
 * 
 * @param {number} hypotheticalTax - Tax deducted from employee's home payroll
 * @param {number} actualHostTaxInHomeCurrency - Actual host tax converted to home currency
 * @returns {{ companyTaxCost: number, employeeNetImpact: number }}
 */
function reconcileTaxEqualization(hypotheticalTax, actualHostTaxInHomeCurrency) {
    // If host tax > hypothetical tax, company pays the difference (Positive cost to company)
    // If host tax < hypothetical tax, company keeps the difference (Negative cost / savings)
    const companyTaxCost = Math.round((actualHostTaxInHomeCurrency - hypotheticalTax) * 100) / 100;

    return {
        companyTaxCost,
        employeeNetImpact: -hypotheticalTax // Employee always pays their hypothetical tax
    };
}

module.exports = {
    calculateCOLA,
    calculateHypotheticalTax,
    calculateShadowTax,
    reconcileTaxEqualization
};
