/**
 * @fileoverview Commission Engine Utilities
 * @description Calculates tiered commissions, applies accelerators, 
 * and manages draw recoveries and clawbacks.
 * Issue: #1472
 */

/**
 * Calculates the commission payout based on revenue booked and accelerator tiers.
 * 
 * @param {number} revenueBooked 
 * @param {number} quotaTarget 
 * @param {number} baseRate 
 * @param {Array} accelerators - Sorted array of { attainmentThreshold, multiplier }
 * @returns {{ baseCommission: number, acceleratorBonus: number, totalCommission: number, attainment: number }}
 */
function calculateCommission(revenueBooked, quotaTarget, baseRate, accelerators) {
    const attainment = quotaTarget > 0 ? revenueBooked / quotaTarget : 0;

    // Base commission on all revenue
    const baseCommission = Math.round(revenueBooked * baseRate * 100) / 100;

    // Find applicable accelerator
    let applicableMultiplier = 1.0;
    // Sort accelerators descending to find the highest threshold met
    const sortedAccelerators = [...accelerators].sort((a, b) => b.attainmentThreshold - a.attainmentThreshold);

    for (const tier of sortedAccelerators) {
        if (attainment >= tier.attainmentThreshold) {
            applicableMultiplier = tier.multiplier;
            break;
        }
    }

    // If multiplier > 1, the bonus is the extra amount above the base rate
    let acceleratorBonus = 0;
    if (applicableMultiplier > 1.0) {
        acceleratorBonus = Math.round(baseCommission * (applicableMultiplier - 1.0) * 100) / 100;
    }

    const totalCommission = Math.round((baseCommission + acceleratorBonus) * 100) / 100;

    return {
        baseCommission,
        acceleratorBonus,
        totalCommission,
        attainment: Math.round(attainment * 10000) / 100 // e.g., 115.50%
    };
}

/**
 * Processes draw recovery against a calculated commission.
 * If the employee has a positive draw balance, it is offset against the commission.
 * 
 * @param {number} calculatedCommission 
 * @param {number} currentDrawBalance - Positive means employee owes the company
 * @returns {{ netPayout: number, drawOffset: number, newDrawBalance: number }}
 */
function processDrawRecovery(calculatedCommission, currentDrawBalance) {
    if (currentDrawBalance <= 0) {
        return {
            netPayout: calculatedCommission,
            drawOffset: 0,
            newDrawBalance: 0
        };
    }

    // Offset the draw balance
    const drawOffset = Math.min(calculatedCommission, currentDrawBalance);
    const netPayout = Math.round((calculatedCommission - drawOffset) * 100) / 100;
    const newDrawBalance = Math.round((currentDrawBalance - drawOffset) * 100) / 100;

    return { netPayout, drawOffset, newDrawBalance };
}

/**
 * Processes a clawback by adding the amount to the employee's draw balance 
 * (making them owe the company) or flagging it for payroll deduction.
 * 
 * @param {number} clawbackAmount 
 * @param {number} currentDrawBalance 
 * @returns {{ newDrawBalance: number, requiresPayrollDeduction: boolean }}
 */
function processClawback(clawbackAmount, currentDrawBalance) {
    // Add clawback to the draw balance (employee now owes more)
    const newDrawBalance = Math.round((currentDrawBalance + clawbackAmount) * 100) / 100;

    // If the balance exceeds a certain threshold, it might require immediate payroll deduction
    // For this engine, we just flag it if it exceeds 50% of their monthly quota commission equivalent
    const requiresPayrollDeduction = newDrawBalance > 10000; // Mock threshold

    return { newDrawBalance, requiresPayrollDeduction };
}

module.exports = { calculateCommission, processDrawRecovery, processClawback };
