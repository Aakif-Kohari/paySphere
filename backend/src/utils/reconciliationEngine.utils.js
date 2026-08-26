/**
 * @fileoverview Reconciliation Engine Utilities
 * @description Evaluates card transactions against policies, flags missing receipts 
 * past the grace period, and calculates payroll clawback amounts.
 * Issue: #1566
 */

/**
 * Checks if a transaction has exceeded the receipt upload grace period.
 * @param {Date} transactionDate 
 * @param {number} gracePeriodDays 
 * @param {Date} currentDate 
 * @returns {boolean}
 */
function isReceiptOverdue(transactionDate, gracePeriodDays, currentDate) {
    const dueDate = new Date(transactionDate);
    dueDate.setDate(dueDate.getDate() + gracePeriodDays);
    return currentDate > dueDate;
}

/**
 * Evaluates a transaction against company policy rules.
 * @param {Object} transaction 
 * @param {Array<string>} blockedMCCs - Blocked Merchant Category Codes (e.g., Casinos, Airlines)
 * @param {number} maxSingleTransactionLimit 
 * @returns {Array<string>} Policy flags
 */
function evaluatePolicyViolations(transaction, blockedMCCs, maxSingleTransactionLimit) {
    const flags = [];

    if (blockedMCCs.includes(transaction.merchantCategoryCode)) {
        flags.push('Out of Policy (Blocked MCC)');
    }

    if (transaction.amount > maxSingleTransactionLimit) {
        flags.push('Exceeds Single Transaction Limit');
    }

    // Additional heuristics could be added here (e.g., weekend spend, duplicate amounts)
    return flags;
}

/**
 * Processes a batch of transactions to identify those requiring payroll clawback.
 * A transaction requires clawback if it is marked personal, OR if the receipt is 
 * overdue and it hasn't been approved.
 * 
 * @param {Array} transactions - Array of CardTransaction documents
 * @param {number} gracePeriodDays 
 * @param {Date} currentDate 
 * @returns {{ clawbackItems: Array, totalClawback: number }}
 */
function calculateBatchClawbacks(transactions, gracePeriodDays, currentDate) {
    const clawbackItems = [];
    let totalClawback = 0;

    for (const tx of transactions) {
        let requiresClawback = false;
        let reason = '';

        if (tx.isPersonalSpend) {
            requiresClawback = true;
            reason = 'Marked as personal spend';
        } else if (tx.status === 'Pending Receipt' && isReceiptOverdue(tx.transactionDate, gracePeriodDays, currentDate)) {
            requiresClawback = true;
            reason = 'Receipt overdue past grace period';
            tx.policyFlags.push('Missing Receipt (Overdue)');
        }

        if (requiresClawback && tx.status !== 'Clawed Back' && tx.status !== 'Clawback Initiated') {
            clawbackItems.push({
                transactionId: tx._id,
                employeeId: tx.employeeId,
                amount: tx.amount,
                reason,
                merchant: tx.merchantName
            });
            totalClawback += tx.amount;
        }
    }

    return { clawbackItems, totalClawback: Math.round(totalClawback * 100) / 100 };
}

/**
 * Generates the payroll deduction line items for the clawback.
 * Note: In many jurisdictions, clawing back corporate card spend is a post-tax deduction.
 * 
 * @param {Array} clawbackItems 
 * @returns {Array} Payroll deduction payloads
 */
function generatePayrollDeductions(clawbackItems) {
    // Group by employee
    const employeeDeductions = {};

    for (const item of clawbackItems) {
        const empId = item.employeeId.toString();
        if (!employeeDeductions[empId]) {
            employeeDeductions[empId] = {
                employeeId: item.employeeId,
                totalDeduction: 0,
                lineItems: []
            };
        }

        employeeDeductions[empId].totalDeduction += item.amount;
        employeeDeductions[empId].lineItems.push({
            description: `Corp Card Clawback: ${item.merchant} (${item.reason})`,
            amount: item.amount,
            type: 'PostTaxDeduction'
        });
    }

    return Object.values(employeeDeductions).map(emp => ({
        employeeId: emp.employeeId,
        componentName: 'Corporate Card Clawback',
        amount: Math.round(emp.totalDeduction * 100) / 100,
        type: 'PostTaxDeduction',
        isTaxable: false,
        details: emp.lineItems
    }));
}

module.exports = {
    isReceiptOverdue,
    evaluatePolicyViolations,
    calculateBatchClawbacks,
    generatePayrollDeductions
};
