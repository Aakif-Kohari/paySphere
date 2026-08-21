/**
 * @fileoverview Escrow Engine Utilities
 * @description Manages fund lifecycles, calculates platform fees/withholding taxes,
 * and enforces departmental budget guardrails.
 * Issue: #1367
 */

/**
 * Checks if creating a new contract exceeds the departmental budget guardrail.
 * @param {number} proposedBudget - The budget of the new contract
 * @param {number} currentDepartmentSpend - Total active contract budgets in this department
 * @param {number} departmentLimit - The maximum allowed budget for the department
 * @returns {{ isAllowed: boolean, message: string }}
 */
function checkBudgetGuardrail(proposedBudget, currentDepartmentSpend, departmentLimit) {
    const projectedSpend = currentDepartmentSpend + proposedBudget;

    if (projectedSpend > departmentLimit) {
        return {
            isAllowed: false,
            message: `Budget Guardrail Triggered: Adding this contract exceeds the departmental limit. Current: ${currentDepartmentSpend}, Proposed: ${proposedBudget}, Limit: ${departmentLimit}.`
        };
    }

    return { isAllowed: true, message: 'Within budget limits.' };
}

/**
 * Calculates platform fees and withholding taxes for a milestone release.
 * @param {number} grossMilestoneAmount - The approved milestone amount
 * @param {number} platformFeeRate - e.g., 0.025 (2.5%)
 * @param {number} withholdingTaxRate - e.g., 0.10 (10%)
 * @returns {{ platformFee: number, withholdingTax: number, netPayout: number }}
 */
function calculateReleaseDeductions(grossMilestoneAmount, platformFeeRate, withholdingTaxRate) {
    const platformFee = Math.round(grossMilestoneAmount * platformFeeRate * 100) / 100;
    const withholdingTax = Math.round(grossMilestoneAmount * withholdingTaxRate * 100) / 100;
    const netPayout = Math.round((grossMilestoneAmount - platformFee - withholdingTax) * 100) / 100;

    return { platformFee, withholdingTax, netPayout };
}

/**
 * Validates if the escrow account has sufficient locked funds to release a milestone.
 * @param {Object} contract - The FreelanceContract document
 * @param {number} milestoneAmount - The amount to release
 * @returns {{ isSufficient: boolean, message: string }}
 */
function validateEscrowSufficiency(contract, milestoneAmount) {
    if (contract.lockedAmount < milestoneAmount) {
        return {
            isSufficient: false,
            message: `Insufficient locked funds. Locked: ${contract.lockedAmount}, Required: ${milestoneAmount}.`
        };
    }
    return { isSufficient: true, message: 'Sufficient funds available.' };
}

module.exports = { checkBudgetGuardrail, calculateReleaseDeductions, validateEscrowSufficiency };
