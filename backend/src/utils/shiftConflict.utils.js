/**
 * @fileoverview Shift Conflict & Priority Engine
 * @description Validates bids against existing rosters, rest periods, and max hours.
 * Calculates priority scores based on tenure and department matching.
 * Issue: #1081
 */
const ShiftRoster = require('../models/shiftRoster.model').ShiftRoster;
const ShiftTemplate = require('../models/shiftRoster.model').ShiftTemplate;

/**
 * Parses "HH:mm" to minutes since midnight.
 */
function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Checks if a proposed shift conflicts with an employee's existing roster.
 * @param {string} tenantId 
 * @param {string} employeeId 
 * @param {Date} date 
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {Promise<{hasConflict: boolean, reasons: string[]}>}
 */
async function checkShiftConflicts(tenantId, employeeId, date, startTime, endTime) {
    const reasons = [];
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Fetch shifts for the target date and adjacent days (for rest period checks)
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 1);

    const existingShifts = await ShiftRoster.find({
        tenantId,
        employeeId,
        date: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Cancelled' }
    }).populate('shiftTemplateId');

    const newStart = parseTime(startTime);
    let newEnd = parseTime(endTime);
    if (newEnd <= newStart) newEnd += 24 * 60; // Handle overnight

    for (const existing of existingShifts) {
        if (!existing.shiftTemplateId) continue;
        const exDate = new Date(existing.date);
        exDate.setHours(0, 0, 0, 0);

        const exStart = parseTime(existing.shiftTemplateId.startTime);
        let exEnd = parseTime(existing.shiftTemplateId.endTime);
        if (exEnd <= exStart) exEnd += 24 * 60;

        // Same day overlap check
        if (exDate.getTime() === targetDate.getTime()) {
            if (Math.max(newStart, exStart) < Math.min(newEnd, exEnd)) {
                reasons.push('Overlaps with existing shift on the same day.');
            }
        }

        // Rest period check (12 hours minimum between shifts)
        const diffDays = (targetDate - exDate) / (1000 * 60 * 60 * 24);
        if (Math.abs(diffDays) === 1) {
            let gapMins = 0;
            if (diffDays === 1) { // New shift is after existing
                gapMins = (24 * 60 - exEnd) + newStart;
            } else { // New shift is before existing
                gapMins = (24 * 60 - newEnd) + exStart;
            }
            if (gapMins < 720) { // 12 hours * 60 mins
                reasons.push(`Violates 12-hour mandatory rest period (Gap: ${Math.round(gapMins / 60)}h).`);
            }
        }
    }

    return { hasConflict: reasons.length > 0, reasons };
}

/**
 * Calculates a priority score for a bidder.
 * @param {Object} employee - Employee document
 * @param {Object} openShift - OpenShift document
 * @returns {number} Score (higher is better)
 */
function calculatePriorityScore(employee, openShift) {
    let score = 0;

    // Department match bonus
    if (openShift.requiredDepartment && employee.department === openShift.requiredDepartment) {
        score += 50;
    }

    // Role match bonus
    if (openShift.requiredRole && employee.role === openShift.requiredRole) {
        score += 30;
    }

    // Tenure bonus (1 point per month of service, max 50)
    if (employee.joiningDate) {
        const monthsEmployed = (new Date() - new Date(employee.joiningDate)) / (1000 * 60 * 60 * 24 * 30);
        score += Math.min(Math.floor(monthsEmployed), 50);
    }

    return score;
}

module.exports = { checkShiftConflicts, calculatePriorityScore };
