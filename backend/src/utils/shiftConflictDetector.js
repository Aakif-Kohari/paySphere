/**
 * @fileoverview Shift Conflict Detection Engine
 * @description Validates shift rosters against labor laws and business rules
 * to prevent double-bookings, rest period violations, and max hours breaches.
 * Issue: #956
 */

/**
 * Parses "HH:mm" string into minutes since midnight.
 * @param {string} timeStr 
 * @returns {number}
 */
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + minutes;
}

/**
 * Calculates the duration of a shift in minutes, handling overnight shifts.
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {number} Duration in minutes
 */
function getShiftDurationMins(startTime, endTime) {
    let start = parseTimeToMinutes(startTime);
    let end = parseTimeToMinutes(endTime);

    // Handle overnight shifts (e.g., 22:00 to 06:00)
    if (end <= start) {
        end += 24 * 60; // Add 24 hours
    }

    return end - start;
}

/**
 * Checks if two shifts on the same day overlap.
 * @param {Object} shiftA - { startTime, endTime }
 * @param {Object} shiftB - { startTime, endTime }
 * @returns {boolean} True if they overlap
 */
function doShiftsOverlap(shiftA, shiftB) {
    let startA = parseTimeToMinutes(shiftA.startTime);
    let endA = parseTimeToMinutes(shiftA.endTime);
    let startB = parseTimeToMinutes(shiftB.startTime);
    let endB = parseTimeToMinutes(shiftB.endTime);

    // Normalize overnight shifts for simple comparison on the same day
    if (endA <= startA) endA += 24 * 60;
    if (endB <= startB) endB += 24 * 60;

    return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Main validation function to check all conflict rules before saving a roster.
 * 
 * @param {Object} newShift - { employeeId, date, shiftTemplateId }
 * @param {Array} existingShifts - Array of existing shifts for this employee in the surrounding 7 days
 * @param {Object} newTemplate - The ShiftTemplate document being assigned
 * @param {Array} allTemplates - Map of all templates for quick lookup
 * @param {Object} config - Tenant specific rules (e.g., minRestHours: 12, maxWeeklyHours: 48)
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateShiftAssignment(newShift, existingShifts, newTemplate, allTemplates, config) {
    const errors = [];
    const minRestMins = (config.minRestHours || 12) * 60;
    const maxWeeklyMins = (config.maxWeeklyHours || 48) * 60;

    const newDate = new Date(newShift.date);
    newDate.setHours(0, 0, 0, 0);

    let weeklyTotalMins = getShiftDurationMins(newTemplate.startTime, newTemplate.endTime);

    for (const existing of existingShifts) {
        const exDate = new Date(existing.date);
        exDate.setHours(0, 0, 0, 0);

        const exTemplate = allTemplates[existing.shiftTemplateId.toString()];
        if (!exTemplate) continue;

        // 1. Double Booking Check (Same Day)
        if (exDate.getTime() === newDate.getTime()) {
            if (doShiftsOverlap(newTemplate, exTemplate)) {
                errors.push(`Double booking detected on ${newDate.toDateString()}. Shifts overlap.`);
            }
        }

        // 2. Rest Period Violation Check (Adjacent Days)
        const diffDays = (newDate - exDate) / (1000 * 60 * 60 * 24);

        if (Math.abs(diffDays) <= 1) {
            let gapMins = 0;
            if (diffDays === 1) {
                // New shift is the day AFTER existing shift
                const exEnd = parseTimeToMinutes(exTemplate.endTime);
                const newStart = parseTimeToMinutes(newTemplate.startTime);
                gapMins = (24 * 60 - exEnd) + newStart;
            } else if (diffDays === -1) {
                // New shift is the day BEFORE existing shift
                const newEnd = parseTimeToMinutes(newTemplate.endTime);
                const exStart = parseTimeToMinutes(exTemplate.startTime);
                gapMins = (24 * 60 - newEnd) + exStart;
            }

            if (gapMins < minRestMins) {
                errors.push(`Rest period violation: Only ${Math.round(gapMins / 60)}h gap between shifts. Minimum required is ${config.minRestHours}h.`);
            }
        }

        // 3. Max Hours Violation (Rolling 7-day window)
        const daysDiff = Math.abs((newDate - exDate) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
            weeklyTotalMins += getShiftDurationMins(exTemplate.startTime, exTemplate.endTime);
        }
    }

    if (weeklyTotalMins > maxWeeklyMins) {
        errors.push(`Max hours violation: Scheduled for ${Math.round(weeklyTotalMins / 60)}h in a 7-day window. Limit is ${config.maxWeeklyHours}h.`);
    }

    return { isValid: errors.length === 0, errors };
}

module.exports = { validateShiftAssignment, getShiftDurationMins, parseTimeToMinutes };
