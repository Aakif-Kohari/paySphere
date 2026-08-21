/**
 * @fileoverview Tenure Reconciliation Engine
 * @description Calculates combined tenure for boomerang rehires and unlocks legacy benefits.
 * Issue: #1366
 */

/**
 * Calculates the combined tenure in days and determines the applicable leave tier.
 * @param {Date} originalJoinDate 
 * @param {Date} exitDate 
 * @param {Date} newJoinDate 
 * @param {Date} currentDate 
 * @returns {{ totalDays: number, years: number, leaveTier: string }}
 */
function calculateCombinedTenure(originalJoinDate, exitDate, newJoinDate, currentDate) {
    const previousTenureDays = Math.floor((new Date(exitDate) - new Date(originalJoinDate)) / (1000 * 60 * 60 * 24));
    const currentTenureDays = Math.floor((new Date(currentDate) - new Date(newJoinDate)) / (1000 * 60 * 60 * 24));

    const totalDays = previousTenureDays + currentTenureDays;
    const years = totalDays / 365.25;

    let leaveTier = 'Standard'; // e.g., 12 days/year
    if (years >= 5) leaveTier = 'Senior'; // e.g., 18 days/year
    if (years >= 10) leaveTier = 'Executive'; // e.g., 24 days/year

    return { totalDays, years: Math.round(years * 10) / 10, leaveTier };
}

/**
 * Checks if an employee is eligible for boomerang rehire based on exit reason.
 * @param {string} exitReason 
 * @returns {boolean}
 */
function isEligibleForRehire(exitReason) {
    // Involuntary terminations for cause are typically ineligible
    return exitReason !== 'Involuntary';
}

/**
 * Determines if vesting schedules (e.g., ESOP, 401k match) should be restored.
 * @param {number} previousTenureYears 
 * @param {number} gapYears - Years between exit and rehire
 * @returns {boolean}
 */
function shouldRestoreVesting(previousTenureYears, gapYears) {
    // Company policy: Restore vesting if previous tenure > 3 years and gap < 2 years
    return previousTenureYears >= 3 && gapYears <= 2;
}

module.exports = { calculateCombinedTenure, isEligibleForRehire, shouldRestoreVesting };
