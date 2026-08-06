/**
 * @fileoverview Leave Accrual Mathematical Engine
 * @description Pure functions for calculating leave accruals, pro-ration, 
 * and year-end carry-forwards. Designed to be easily unit-tested.
 * 
 * Issue: #646
 */

/**
 * Calculates the number of days in a specific month/year.
 * Correctly handles leap years for February.
 * 
 * @param {number} month - 1-indexed month (1 = Jan, 12 = Dec)
 * @param {number} year - 4-digit year
 * @returns {number} Number of days in the month
 */
function getDaysInMonth(month, year) {
    // Day 0 of the next month gives the last day of the current month
    return new Date(year, month, 0).getDate();
}

/**
 * Checks if a year is a leap year.
 * @param {number} year 
 * @returns {boolean}
 */
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Calculates pro-rated leave accrual for a partial month.
 * 
 * Scenario: Employee joins on the 15th of a 30-day month. 
 * They worked 16 days (15th to 30th inclusive).
 * Pro-ration factor = 16 / 30.
 * 
 * @param {number} monthlyRate - The standard monthly accrual rate (e.g., 1.5 days)
 * @param {Date} startDate - Employee joining date or month start
 * @param {Date} endDate - Employee exit date or month end
 * @param {number} month - 1-indexed month
 * @param {number} year - 4-digit year
 * @returns {number} Pro-rated leave amount (rounded to 2 decimal places)
 */
function calculateProRatedAccrual(monthlyRate, startDate, endDate, month, year) {
    const daysInMonth = getDaysInMonth(month, year);

    // Determine the effective start day within this specific month
    const startDay = startDate.getMonth() + 1 === month && startDate.getFullYear() === year
        ? startDate.getDate()
        : 1;

    // Determine the effective end day within this specific month
    const endDay = endDate.getMonth() + 1 === month && endDate.getFullYear() === year
        ? endDate.getDate()
        : daysInMonth;

    // Calculate active days (inclusive of both start and end dates)
    const activeDays = Math.max(0, endDay - startDay + 1);

    if (activeDays === 0) return 0;
    if (activeDays >= daysInMonth) return monthlyRate;

    // Pro-rate based on calendar days worked in the month
    const factor = activeDays / daysInMonth;
    return Math.round((monthlyRate * factor) * 100) / 100;
}

/**
 * Calculates the carry-forward balance for year-end.
 * 
 * @param {number} currentBalance - Total unused leaves at year-end
 * @param {number} maxCarryForward - Maximum allowed carry-forward per policy
 * @returns {Object} { carriedForward: number, lapsed: number }
 */
function calculateCarryForward(currentBalance, maxCarryForward) {
    if (maxCarryForward === null || maxCarryForward === undefined || maxCarryForward < 0) {
        // If no limit, carry everything
        return { carriedForward: currentBalance, lapsed: 0 };
    }

    const carriedForward = Math.min(currentBalance, maxCarryForward);
    const lapsed = Math.max(0, currentBalance - maxCarryForward);

    return {
        carriedForward: Math.round(carriedForward * 100) / 100,
        lapsed: Math.round(lapsed * 100) / 100
    };
}

module.exports = {
    getDaysInMonth,
    isLeapYear,
    calculateProRatedAccrual,
    calculateCarryForward
};
