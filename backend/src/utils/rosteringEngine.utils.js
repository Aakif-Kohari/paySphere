/**
 * @fileoverview Algorithmic Rostering Engine
 * @description Uses constraint-satisfaction logic to auto-fill shifts while 
 * calculating fatigue scores and enforcing labor law guardrails.
 * Issue: #1289
 */

/**
 * Calculates a Fatigue Score (0-100) based on consecutive days worked and rest gaps.
 * @param {number} consecutiveDays - Number of consecutive days worked prior to this shift
 * @param {number} restHours - Hours rested since the last shift ended
 * @param {Object} constraints - Active RosterConstraint document
 * @returns {number} Fatigue score (0-100)
 */
function calculateFatigueScore(consecutiveDays, restHours, constraints) {
    let score = 0;

    // Penalty for consecutive days (Approaching max limit increases fatigue)
    const consecutiveRatio = consecutiveDays / constraints.maxConsecutiveDays;
    score += consecutiveRatio * 50; // Max 50 points from consecutive days

    // Penalty for insufficient rest (Below minimum threshold spikes fatigue)
    if (restHours < constraints.minRestHoursBetweenShifts) {
        const restDeficit = constraints.minRestHoursBetweenShifts - restHours;
        score += (restDeficit / constraints.minRestHoursBetweenShifts) * 50; // Max 50 points from rest deficit
    } else if (restHours < constraints.minRestHoursBetweenShifts + 2) {
        score += 10; // Slight fatigue for barely meeting the rest requirement
    }

    return Math.min(Math.round(score), 100);
}

/**
 * Checks if a proposed shift violates any labor law or company constraints.
 * @param {Object} proposedShift - { date, shiftTemplate, previousShift }
 * @param {number} weeklyHoursAccumulated - Hours already scheduled this week
 * @param {Object} constraints - Active RosterConstraint document
 * @returns {{ isCompliant: boolean, warnings: string[] }}
 */
function checkComplianceGuardrail(proposedShift, weeklyHoursAccumulated, constraints) {
    const warnings = [];

    // 1. Check Max Shift Duration
    if (proposedShift.shiftTemplate.durationHours > constraints.maxShiftDurationHours) {
        warnings.push(`Shift duration (${proposedShift.shiftTemplate.durationHours}h) exceeds max limit (${constraints.maxShiftDurationHours}h).`);
    }

    // 2. Check Weekly Hours Limit
    if (weeklyHoursAccumulated + proposedShift.shiftTemplate.durationHours > constraints.maxWeeklyHours) {
        warnings.push(`Weekly hours limit (${constraints.maxWeeklyHours}h) will be exceeded.`);
    }

    // 3. Check Minimum Rest Gap
    if (proposedShift.previousShift) {
        const prevEnd = new Date(proposedShift.previousShift.date);
        const [prevH, prevM] = proposedShift.previousShift.shiftTemplate.endTime.split(':').map(Number);
        prevEnd.setHours(prevH, prevM, 0, 0);

        const currStart = new Date(proposedShift.date);
        const [currH, currM] = proposedShift.shiftTemplate.startTime.split(':').map(Number);
        currStart.setHours(currH, currM, 0, 0);

        const restGapHours = (currStart - prevEnd) / (1000 * 60 * 60);

        if (restGapHours < constraints.minRestHoursBetweenShifts) {
            warnings.push(`Violates mandatory ${constraints.minRestHoursBetweenShifts}-hour rest gap (Actual: ${restGapHours.toFixed(1)}h).`);
        }
    }

    return {
        isCompliant: warnings.length === 0,
        warnings
    };
}

/**
 * Auto-generates a compliant roster for a list of employees over a date range.
 * Uses a greedy constraint-satisfaction approach.
 * 
 * @param {Array} employees - Array of employee objects
 * @param {Array} shiftTemplates - Available shift templates
 * @param {Object} constraints - Active RosterConstraint document
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Array} Array of generated roster objects
 */
function generateAutoRoster(employees, shiftTemplates, constraints, startDate, endDate) {
    const roster = [];
    const currentDate = new Date(startDate);

    // Simplified state tracking for the algorithm
    const employeeState = {};
    employees.forEach(emp => {
        employeeState[emp._id.toString()] = {
            consecutiveDays: 0,
            weeklyHours: 0,
            lastShiftEnd: null,
            currentWeekStart: new Date(startDate)
        };
    });

    while (currentDate <= endDate) {
        // Reset weekly hours if we crossed into a new week (assuming Monday start)
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek === 1) { // Monday
            Object.keys(employeeState).forEach(id => {
                employeeState[id].weeklyHours = 0;
            });
        }

        for (const emp of employees) {
            const state = employeeState[emp._id.toString()];

            // Simple rotation logic: Assign Morning shift if compliant, otherwise Day Off
            const morningShift = shiftTemplates.find(s => s.name.toLowerCase().includes('morning')) || shiftTemplates[0];

            const proposedShift = {
                date: new Date(currentDate),
                shiftTemplate: morningShift,
                previousShift: state.lastShiftEnd ? { date: state.lastShiftEnd.date, shiftTemplate: state.lastShiftEnd.template } : null
            };

            const compliance = checkComplianceGuardrail(proposedShift, state.weeklyHours, constraints);

            // Calculate fatigue based on state
            const fatigue = calculateFatigueScore(state.consecutiveDays, 24, constraints); // Mocking 24h rest if no prev shift

            if (compliance.isCompliant && state.consecutiveDays < constraints.maxConsecutiveDays) {
                roster.push({
                    tenantId: emp.tenantId,
                    employeeId: emp._id,
                    shiftTemplateId: morningShift._id,
                    date: new Date(currentDate),
                    fatigueScore: fatigue,
                    isCompliant: true,
                    complianceWarnings: [],
                    status: 'Draft'
                });

                // Update state
                state.consecutiveDays += 1;
                state.weeklyHours += morningShift.durationHours;
                state.lastShiftEnd = { date: new Date(currentDate), template: morningShift };
            } else {
                // Force a day off to reset consecutive days and reduce fatigue
                state.consecutiveDays = 0;
                state.lastShiftEnd = null; // Reset rest gap tracking
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return roster;
}

module.exports = { calculateFatigueScore, checkComplianceGuardrail, generateAutoRoster };
