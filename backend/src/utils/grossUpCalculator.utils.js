/**
 * @fileoverview Tax Gross-Up Calculator
 * @description Calculates the additional gross amount needed to cover the tax 
 * burden on taxable relocation benefits.
 * Issue: #1368
 */

/**
 * Calculates the gross-up amount required so the employee's net take-home 
 * covers the exact cost of the taxable relocation expense.
 * Formula: Gross = Net / (1 - TaxRate)
 * Gross-Up Amount = Gross - Net
 * 
 * @param {number} netExpenseAmount - The actual taxable expense amount
 * @param {number} marginalTaxRate - The employee's marginal tax bracket (e.g., 0.30 for 30%)
 * @returns {{ grossAmount: number, grossUpAmount: number, taxLiability: number }}
 */
function calculateGrossUp(netExpenseAmount, marginalTaxRate) {
    if (netExpenseAmount <= 0 || marginalTaxRate >= 1) {
        return { grossAmount: 0, grossUpAmount: 0, taxLiability: 0 };
    }

    // Total gross required to net the expense amount
    const grossAmount = netExpenseAmount / (1 - marginalTaxRate);

    // The additional "bonus" needed to cover the tax on the reimbursement
    const grossUpAmount = grossAmount - netExpenseAmount;

    // The actual tax liability generated
    const taxLiability = grossAmount * marginalTaxRate;

    return {
        grossAmount: Math.round(grossAmount * 100) / 100,
        grossUpAmount: Math.round(grossUpAmount * 100) / 100,
        taxLiability: Math.round(taxLiability * 100) / 100
    };
}

/**
 * Determines if a specific relocation expense category is typically tax-exempt.
 * (Simplified logic for demonstration; real-world rules vary heavily by jurisdiction).
 * 
 * @param {string} category 
 * @param {boolean} isCrossBorder - True if moving to a different country
 * @returns {boolean} True if taxable, False if exempt
 */
function isExpenseTaxable(category, isCrossBorder) {
    // Generally, moving services and travel are tax-exempt if moving > 50km for work
    // Temporary housing and brokerage are usually taxable.
    const exemptCategories = ['Moving Services', 'Travel'];

    if (exemptCategories.includes(category)) {
        return false; // Exempt
    }

    return true; // Taxable (e.g., Temporary Housing, Brokerage)
}

module.exports = { calculateGrossUp, isExpenseTaxable };
