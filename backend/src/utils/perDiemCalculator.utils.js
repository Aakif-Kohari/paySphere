/**
 * @fileoverview Per Diem Calculator
 * @description Calculates allowable travel advances based on city tiers and trip duration.
 * Issue: #1209
 */
const { PerDiemPolicy } = require('../models/travel.model');

/**
 * Calculates the maximum allowable per diem advance for a trip.
 * @param {string} tenantId 
 * @param {string} cityTier 
 * @param {number} durationDays 
 * @returns {Promise<{dailyRate: number, totalPerDiem: number, hotelLimit: number}>}
 */
async function calculatePerDiem(tenantId, cityTier, durationDays) {
    const policy = await PerDiemPolicy.findOne({ tenantId, cityTier, isActive: true });

    if (!policy) {
        // Fallback default if no policy exists
        return { dailyRate: 1000, totalPerDiem: 1000 * durationDays, hotelLimit: 3000 };
    }

    return {
        dailyRate: policy.dailyAllowance,
        totalPerDiem: policy.dailyAllowance * durationDays,
        hotelLimit: policy.hotelLimit * durationDays
    };
}

/**
 * Reconciles the travel advance against actual expenses.
 * @param {number} advancePaid 
 * @param {number} actualExpenses 
 * @returns {{ balance: number, status: string }}
 */
function reconcileSettlement(advancePaid, actualExpenses) {
    const balance = actualExpenses - advancePaid;

    if (balance > 0) {
        return { balance, status: 'Settled (Payable)' }; // Company pays employee
    } else if (balance < 0) {
        return { balance, status: 'Settled (Recovery)' }; // Employee returns money / payroll deduction
    } else {
        return { balance: 0, status: 'Settled (Payable)' }; // Exact match
    }
}

module.exports = { calculatePerDiem, reconcileSettlement };
