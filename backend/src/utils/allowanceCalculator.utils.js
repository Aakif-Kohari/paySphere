/**
 * @fileoverview Allowance Calculator Utilities
 * @description Intersects punch logs with allowance rules, handles on-call stipends,
 * and enforces double-dip guardrails.
 * Issue: #1473
 */

/**
 * Parses a time string "HH:mm" into total minutes from midnight.
 * @param {string} timeStr 
 * @returns {number}
 */
function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Calculates the overlap in hours between a punch window and a rule time window.
 * Handles overnight shifts (e.g., 22:00 to 06:00).
 * 
 * @param {Date} punchIn 
 * @param {Date} punchOut 
 * @param {string} ruleStart - "HH:mm"
 * @param {string} ruleEnd - "HH:mm"
 * @returns {number} Overlapping hours
 */
function calculateOverlapHours(punchIn, punchOut, ruleStart, ruleEnd) {
    const startMin = parseTimeToMinutes(ruleStart);
    const endMin = parseTimeToMinutes(ruleEnd);
    const isOvernight = endMin <= startMin;

    let totalOverlapMinutes = 0;

    // Iterate through the punch duration in 1-minute increments (simplified for demo, 
    // in production use interval intersection math for performance)
    let current = new Date(punchIn);
    while (current < punchOut) {
        const currentMin = current.getHours() * 60 + current.getMinutes();

        let inWindow = false;
        if (isOvernight) {
            inWindow = currentMin >= startMin || currentMin < endMin;
        } else {
            inWindow = currentMin >= startMin && currentMin < endMin;
        }

        if (inWindow) totalOverlapMinutes++;

        current = new Date(current.getTime() + 60000); // Add 1 minute
    }

    return Math.round((totalOverlapMinutes / 60) * 100) / 100;
}

/**
 * Evaluates a set of punch logs against active allowance rules.
 * Enforces the "Double-Dip Guardrail".
 * 
 * @param {Array} punchLogs - Array of { punchIn, punchOut, date }
 * @param {Array} rules - Array of active AllowanceRule documents
 * @param {number} baseHourlyRate - Employee's base hourly rate
 * @param {Array} publicHolidays - Array of Date objects for public holidays
 * @returns {Array} Calculated line items
 */
function calculateShiftAllowances(punchLogs, rules, baseHourlyRate, publicHolidays) {
    const lineItems = {}; // Map<ruleId, { hours, amount, anomalies }>
    const holidaySet = new Set(publicHolidays.map(d => new Date(d).toISOString().split('T')[0]));

    // Sort rules by priority descending
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    for (const punch of punchLogs) {
        if (!punch.punchIn || !punch.punchOut) continue;

        const dateStr = new Date(punch.punchIn).toISOString().split('T')[0];
        const isHoliday = holidaySet.has(dateStr);
        const dayOfWeek = new Date(punch.punchIn).getDay();

        // Track which rules have already claimed hours for this specific punch to prevent double-dipping
        const claimedMinutes = new Set();

        for (const rule of sortedRules) {
            let applicableHours = 0;
            let isApplicable = false;

            if (rule.type === 'TimeWindow') {
                applicableHours = calculateOverlapHours(punch.punchIn, punch.punchOut, rule.startTime, rule.endTime);
                isApplicable = applicableHours > 0;
            } else if (rule.type === 'DayOfWeek') {
                if (rule.applicableDays.includes(dayOfWeek)) {
                    applicableHours = (punch.punchOut - punch.punchIn) / (1000 * 60 * 60);
                    isApplicable = true;
                }
            } else if (rule.type === 'PublicHoliday' && isHoliday) {
                applicableHours = (punch.punchOut - punch.punchIn) / (1000 * 60 * 60);
                isApplicable = true;
            }

            if (isApplicable && applicableHours > 0) {
                // Double-Dip Guardrail Check
                if (!rule.allowDoubleDip && claimedMinutes.size > 0) {
                    // If this rule doesn't allow double dipping, and hours are already claimed by a higher priority rule, skip.
                    // (A more granular implementation would check minute-by-minute overlap)
                    continue;
                }

                if (!lineItems[rule._id]) {
                    lineItems[rule._id] = {
                        ruleId: rule._id,
                        componentName: rule.name,
                        premiumHours: 0,
                        amount: 0,
                        anomalies: []
                    };
                }

                const premiumPay = rule.flatRatePerHour > 0
                    ? applicableHours * rule.flatRatePerHour
                    : applicableHours * baseHourlyRate * (rule.multiplier - 1.0); // Only pay the *differential*

                lineItems[rule._id].premiumHours += applicableHours;
                lineItems[rule._id].amount += Math.round(premiumPay * 100) / 100;

                // Mark minutes as claimed (simplified)
                claimedMinutes.add(rule._id);
            }
        }
    }

    return Object.values(lineItems);
}

/**
 * Calculates on-call stipends for a given month.
 * @param {Array} onCallSchedules 
 * @param {number} month 
 * @param {number} year 
 * @returns {{ componentName: string, amount: number, days: number }}
 */
function calculateOnCallStipends(onCallSchedules, month, year) {
    let totalDays = 0;
    let totalAmount = 0;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    for (const schedule of onCallSchedules) {
        const start = new Date(schedule.startDate);
        const end = new Date(schedule.endDate);

        // Find overlap with the target month
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;

        if (overlapStart <= overlapEnd) {
            const days = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
            totalDays += days;
            totalAmount += days * schedule.dailyStipend;
        }
    }

    return {
        componentName: 'On-Call Stipend',
        premiumHours: totalDays, // Repurposing field for days
        amount: Math.round(totalAmount * 100) / 100,
        anomalies: []
    };
}

module.exports = { calculateShiftAllowances, calculateOnCallStipends };
