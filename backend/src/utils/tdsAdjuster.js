/**
 * @fileoverview TDS Adjustment & Shortfall Calculator
 * @description Calculates the tax impact of rejected or partially approved tax proofs
 * and distributes the shortfall across the remaining months of the financial year.
 * Issue: #982
 */

/**
 * Determines the number of remaining payroll months in the current Financial Year (April - March).
 * @param {Date} currentDate - The current date
 * @returns {number} Number of remaining months (including current month if payroll isn't run)
 */
function getRemainingMonthsInFY(currentDate = new Date()) {
    const currentMonth = currentDate.getMonth(); // 0 (Jan) to 11 (Dec)

    // FY starts in April (month index 3) and ends in March (month index 2 of next year)
    // If current month is Jan (0), Feb (1), or Mar (2), remaining months are 1, 2, or 3.
    // If current month is Apr (3) to Dec (11), remaining months are 12 down to 4.

    if (currentMonth >= 3) {
        // April to December: 12 - (currentMonth - 3)
        return 12 - (currentMonth - 3);
    } else {
        // January to March: 3 - currentMonth
        return 3 - currentMonth;
    }
}

/**
 * Calculates the monthly TDS deduction adjustment based on approved vs claimed amounts.
 * 
 * Logic:
 * 1. Shortfall = Claimed Amount - Approved Amount
 * 2. Assuming a flat 30% tax bracket for the shortfall (simplified for this engine; 
 *    a full engine would use the employee's specific tax slab and regime).
 * 3. Tax Impact = Shortfall * 0.30
 * 4. Monthly Additional TDS = Tax Impact / Remaining Months
 * 
 * @param {number} claimedAmount - The amount the employee claimed
 * @param {number} approvedAmount - The amount HR approved
 * @param {number} taxSlabRate - The employee's applicable tax slab rate (e.g., 0.30 for 30%)
 * @param {Date} calculationDate - The date of calculation
 * @returns {{ shortfall: number, taxImpact: number, monthlyAdditionalTDS: number, remainingMonths: number }}
 */
function calculateTDSAdjustment(claimedAmount, approvedAmount, taxSlabRate = 0.30, calculationDate = new Date()) {
    const shortfall = Math.max(0, claimedAmount - approvedAmount);
    const taxImpact = shortfall * taxSlabRate;
    const remainingMonths = getRemainingMonthsInFY(calculationDate);

    // Prevent division by zero if calculated at the very end of the FY
    const monthlyAdditionalTDS = remainingMonths > 0 ? taxImpact / remainingMonths : taxImpact;

    return {
        shortfall: Math.round(shortfall * 100) / 100,
        taxImpact: Math.round(taxImpact * 100) / 100,
        monthlyAdditionalTDS: Math.round(monthlyAdditionalTDS * 100) / 100,
        remainingMonths
    };
}

/**
 * Aggregates all approved tax proofs for an employee to calculate total eligible deductions.
 * @param {Array} proofs - Array of TaxProof documents
 * @returns {Object} Map of section types to approved amounts
 */
function aggregateApprovedDeductions(proofs) {
    const aggregated = {
        '80C': 0,
        '80D': 0,
        'HRA': 0,
        'NPS': 0,
        'Other': 0,
        totalApproved: 0
    };

    proofs.forEach(proof => {
        if (proof.status === 'Approved' || proof.status === 'Partially Approved') {
            const amount = proof.approvedAmount || 0;
            aggregated.totalApproved += amount;

            if (proof.sectionType === '80C') aggregated['80C'] += amount;
            else if (proof.sectionType === '80D') aggregated['80D'] += amount;
            else if (proof.sectionType === 'HRA') aggregated['HRA'] += amount;
            else if (proof.sectionType === '80CCD(1B)') aggregated['NPS'] += amount;
            else aggregated['Other'] += amount;
        }
    });

    return aggregated;
}

module.exports = {
    getRemainingMonthsInFY,
    calculateTDSAdjustment,
    aggregateApprovedDeductions
};
