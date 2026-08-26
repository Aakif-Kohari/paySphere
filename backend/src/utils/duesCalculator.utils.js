/**
 * @fileoverview Union Dues Calculator & SLA Guardrail
 * @description Calculates monthly union dues based on CBA tiers and tracks arbitration SLAs.
 * Issue: #1475
 */

/**
 * Calculates the exact monthly union deduction for an employee based on the active CBA.
 * 
 * @param {Object} cba - CollectiveBargainingAgreement document
 * @param {Array} tiers - Array of UnionDuesTier documents
 * @param {number} employeeBasePay - Employee's monthly base pay
 * @returns {{ deductionAmount: number, tierName: string, capped: boolean }}
 */
function calculateUnionDues(cba, tiers, employeeBasePay) {
    let deductionAmount = 0;
    let tierName = 'Standard';
    let capped = false;

    if (cba.duesCalculationType === 'FlatFee') {
        deductionAmount = cba.flatFeeAmount;
        tierName = 'Flat Fee';
    }
    else if (cba.duesCalculationType === 'Percentage') {
        deductionAmount = Math.round(employeeBasePay * cba.percentageRate * 100) / 100;
        tierName = 'Percentage';
    }
    else if (cba.duesCalculationType === 'Tiered') {
        // Find the applicable tier based on base pay
        const applicableTier = tiers.find(t =>
            employeeBasePay >= t.minBasePay && employeeBasePay <= t.maxBasePay
        );

        if (applicableTier) {
            deductionAmount = applicableTier.duesAmount;
            tierName = applicableTier.tierName;
        } else {
            // Fallback to lowest tier if no match
            const lowestTier = tiers.sort((a, b) => a.duesAmount - b.duesAmount)[0];
            deductionAmount = lowestTier ? lowestTier.duesAmount : 0;
            tierName = lowestTier ? lowestTier.tierName : 'Fallback';
        }
    }

    // Enforce statutory maximum deduction limit
    if (cba.maxMonthlyDeduction && deductionAmount > cba.maxMonthlyDeduction) {
        deductionAmount = cba.maxMonthlyDeduction;
        capped = true;
    }

    return { deductionAmount, tierName, capped };
}

/**
 * Evaluates all open grievances to check if any arbitration SLA deadlines have been breached.
 * 
 * @param {Array} grievances - Array of open GrievanceArbitration documents
 * @param {Date} currentDate 
 * @returns {Array} List of grievances that have breached their SLA
 */
function evaluateArbitrationSLAs(grievances, currentDate) {
    const breached = [];
    const now = new Date(currentDate);

    for (const g of grievances) {
        if (g.status === 'Open' || g.status === 'Escalated') {
            if (now > new Date(g.stepDeadline) && !g.isSLABreached) {
                breached.push({
                    grievanceId: g._id,
                    employeeId: g.employeeId,
                    title: g.title,
                    currentStep: g.currentStep,
                    daysOverdue: Math.floor((now - new Date(g.stepDeadline)) / (1000 * 60 * 60 * 24))
                });
            }
        }
    }

    return breached;
}

module.exports = { calculateUnionDues, evaluateArbitrationSLAs };
