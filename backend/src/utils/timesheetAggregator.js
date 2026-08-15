/**
 * @fileoverview Timesheet Aggregation & Billing Engine
 * @description Calculates weekly billable hours, applies contractor rates, 
 * and prepares data for the Vendor Invoice (194C) generation.
 * Issue: #1000
 */

/**
 * Calculates duration in minutes between two dates.
 * @param {Date} start 
 * @param {Date} end 
 * @returns {number} Minutes
 */
function calculateDurationMinutes(start, end) {
    if (!start || !end) return 0;
    const diffMs = new Date(end) - new Date(start);
    return Math.max(0, Math.round(diffMs / 60000));
}

/**
 * Calculates the billable amount for a timesheet entry.
 * Formula: (Duration in Hours) * Hourly Rate
 * 
 * @param {number} durationMinutes 
 * @param {number} hourlyRate 
 * @returns {number} Billable amount rounded to 2 decimal places
 */
function calculateBillableAmount(durationMinutes, hourlyRate) {
    const hours = durationMinutes / 60;
    return Math.round((hours * hourlyRate) * 100) / 100;
}

/**
 * Aggregates approved timesheet entries for a specific contractor over a date range.
 * Used to draft a Vendor Invoice at the end of the week/month.
 * 
 * @param {Array} entries - Array of approved TimesheetEntry documents
 * @returns {{ totalMinutes: number, totalHours: number, totalAmount: number, breakdown: Array }}
 */
function aggregateTimesheetsForBilling(entries) {
    let totalMinutes = 0;
    let totalAmount = 0;

    const breakdown = entries.map(entry => {
        totalMinutes += entry.durationMinutes;
        totalAmount += entry.billableAmount;

        return {
            entryId: entry._id,
            date: entry.startTime,
            project: entry.projectId,
            durationMinutes: entry.durationMinutes,
            amount: entry.billableAmount,
            description: entry.description
        };
    });

    return {
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        breakdown
    };
}

/**
 * Idle Detection Heuristic
 * Flags entries where the duration exceeds a reasonable continuous work block
 * without explicit breaks (e.g., > 6 hours straight might indicate the timer was left running).
 * 
 * @param {number} durationMinutes 
 * @param {number} maxContinuousMinutes - Default 360 (6 hours)
 * @returns {{ isFlagged: boolean, reason: string }}
 */
function detectIdleOrFraud(durationMinutes, maxContinuousMinutes = 360) {
    if (durationMinutes > maxContinuousMinutes) {
        return {
            isFlagged: true,
            reason: `Continuous timer exceeded ${maxContinuousMinutes / 60} hours. Potential idle time or forgotten timer.`
        };
    }

    // Flag if duration is suspiciously short (e.g., < 2 minutes)
    if (durationMinutes > 0 && durationMinutes < 2) {
        return {
            isFlagged: true,
            reason: 'Duration too short (< 2 mins). Potential accidental timer start/stop.'
        };
    }

    return { isFlagged: false, reason: '' };
}

module.exports = {
    calculateDurationMinutes,
    calculateBillableAmount,
    aggregateTimesheetsForBilling,
    detectIdleOrFraud
};
