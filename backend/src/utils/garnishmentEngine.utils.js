/**
 * @fileoverview Garnishment Engine Utilities
 * @description Calculates disposable income, applies priority rules, and enforces 
 * statutory maximum deduction limits.
 * Issue: #1369
 */

/**
 * Calculates the employee's "Disposable Income" for garnishment purposes.
 * Disposable income = Gross Pay - Legally required deductions (Taxes, Social Security).
 * Note: Voluntary deductions (401k, health insurance) are NOT subtracted here.
 * 
 * @param {number} grossPay 
 * @param {number} statutoryTaxes - Sum of federal/state taxes and social security
 * @returns {number} Disposable Income
 */
function calculateDisposableIncome(grossPay, statutoryTaxes) {
    return Math.max(0, grossPay - statutoryTaxes);
}

/**
 * Determines the statutory maximum deduction percentage based on the garnishment type.
 * (Based on US CCPA guidelines for demonstration).
 * 
 * @param {string} type 
 * @param {boolean} supportsDependents - Does the employee support a second family?
 * @returns {number} Maximum percentage of disposable income that can be garnished
 */
function getStatutoryMaxPercentage(type, supportsDependents) {
    switch (type) {
        case 'Child Support':
            // 60% if not supporting another family, 50% if supporting another family
            return supportsDependents ? 0.50 : 0.60;
        case 'Tax Levy':
            // IRS uses a complex table based on exemptions, but generally capped around 25-50%
            return 0.25;
        case 'Student Loan':
            // Administrative wage garnishment for federal student loans capped at 15%
            return 0.15;
        case 'Creditor Debt':
            // Standard consumer debt capped at 25% of disposable earnings
            return 0.25;
        default:
            return 0.25;
    }
}

/**
 * Calculates the actual deduction amount for a specific garnishment order, 
 * respecting statutory caps and remaining balances.
 * 
 * @param {Object} order - The GarnishmentOrder document
 * @param {number} disposableIncome - The employee's calculated disposable income
 * @param {number} availableDisposable - Remaining disposable income after higher-priority garnishments
 * @returns {{ deductionAmount: number, remainingOwed: number }}
 */
function calculateDeduction(order, disposableIncome, availableDisposable) {
    const maxPercentage = getStatutoryMaxPercentage(order.type, false); // Defaulting to false for demo
    const statutoryMaxAmount = disposableIncome * maxPercentage;

    // The deduction cannot exceed the statutory max, the available disposable, or the remaining owed
    const proposedDeduction = Math.min(
        order.monthlyDeductionAmount || statutoryMaxAmount,
        statutoryMaxAmount,
        availableDisposable,
        order.totalAmountOwed - order.amountDeductedToDate
    );

    const finalDeduction = Math.max(0, Math.round(proposedDeduction * 100) / 100);
    const remainingOwed = (order.totalAmountOwed - order.amountDeductedToDate) - finalDeduction;

    return {
        deductionAmount: finalDeduction,
        remainingOwed: Math.max(0, Math.round(remainingOwed * 100) / 100)
    };
}

/**
 * Sorts active garnishment orders by priority.
 * Priority: Child Support (1) > Tax Levy (2) > Student Loan (3) > Creditor (4)
 * 
 * @param {Array} orders - Array of GarnishmentOrder documents
 * @returns {Array} Sorted orders
 */
function applyPriorityRules(orders) {
    return [...orders].sort((a, b) => {
        // Sort by explicit priority field first, then by type default
        const priorityMap = { 'Child Support': 1, 'Tax Levy': 2, 'Student Loan': 3, 'Creditor Debt': 4, 'Other': 5 };
        const pA = a.priority || priorityMap[a.type] || 5;
        const pB = b.priority || priorityMap[b.type] || 5;
        return pA - pB;
    });
}

module.exports = { calculateDisposableIncome, getStatutoryMaxPercentage, calculateDeduction, applyPriorityRules };
