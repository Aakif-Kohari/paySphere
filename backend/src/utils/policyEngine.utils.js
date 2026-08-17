/**
 * @fileoverview Expense Policy Evaluation Engine
 * @description Evaluates an expense claim against the active company policy.
 * Checks for category limits, weekend restrictions, missing receipts, and duplicates.
 * Issue: #1082
 */
const { ExpenseClaim } = require('../models/expensePolicy.model');

/**
 * Evaluates a claim against the policy rules.
 * 
 * @param {Object} claim - The expense claim data
 * @param {Object} policy - The active ExpensePolicy document
 * @returns {Promise<{isCompliant: boolean, violations: string[]}>}
 */
async function evaluateClaim(claim, policy) {
    const violations = [];

    // Find the specific category rules
    const categoryRule = policy.categories.find(c => c.category === claim.category);

    if (!categoryRule) {
        violations.push(`Category '${claim.category}' is not defined in the company policy.`);
        return { isCompliant: false, violations };
    }

    // 1. Check Per-Claim Limit
    if (claim.amount > categoryRule.maxLimitPerClaim) {
        violations.push(`Amount (${claim.amount}) exceeds maximum per-claim limit (${categoryRule.maxLimitPerClaim}) for ${claim.category}.`);
    }

    // 2. Check Receipt Requirement
    if (categoryRule.requiresReceipt && claim.amount > categoryRule.receiptThreshold && !claim.receiptUrl) {
        violations.push(`Receipt is required for ${claim.category} expenses over ${categoryRule.receiptThreshold}.`);
    }

    // 3. Check Weekend Restrictions
    if (!categoryRule.weekendAllowed) {
        const dayOfWeek = new Date(claim.expenseDate).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            violations.push(`${claim.category} expenses are not allowed on weekends.`);
        }
    }

    // 4. Check Monthly Aggregate Limit
    if (categoryRule.maxLimitPerMonth > 0) {
        const startOfMonth = new Date(claim.expenseDate.getFullYear(), claim.expenseDate.getMonth(), 1);
        const endOfMonth = new Date(claim.expenseDate.getFullYear(), claim.expenseDate.getMonth() + 1, 0, 23, 59, 59);

        const monthlyTotal = await ExpenseClaim.aggregate([
            {
                $match: {
                    tenantId: claim.tenantId,
                    employeeId: claim.employeeId,
                    category: claim.category,
                    expenseDate: { $gte: startOfMonth, $lte: endOfMonth },
                    status: { $nin: ['Rejected', 'Draft'] }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const currentSpend = monthlyTotal.length > 0 ? monthlyTotal[0].total : 0;
        if ((currentSpend + claim.amount) > categoryRule.maxLimitPerMonth) {
            violations.push(`Monthly limit for ${claim.category} exceeded. Current spend: ${currentSpend}, Limit: ${categoryRule.maxLimitPerMonth}.`);
        }
    }

    // 5. Duplicate Detection (Same merchant, date, and amount within 24 hours)
    const duplicate = await ExpenseClaim.findOne({
        tenantId: claim.tenantId,
        employeeId: claim.employeeId,
        merchant: claim.merchant,
        amount: claim.amount,
        expenseDate: {
            $gte: new Date(new Date(claim.expenseDate).getTime() - 24 * 60 * 60 * 1000),
            $lte: new Date(new Date(claim.expenseDate).getTime() + 24 * 60 * 60 * 1000)
        },
        _id: { $ne: claim._id } // Exclude current draft if updating
    });

    if (duplicate) {
        violations.push(`Potential duplicate: A similar claim for ${claim.merchant} on ${claim.expenseDate.toDateString()} already exists.`);
    }

    return {
        isCompliant: violations.length === 0,
        violations
    };
}

module.exports = { evaluateClaim };
