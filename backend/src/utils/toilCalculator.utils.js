/**
 * @fileoverview TOIL Accrual Calculator
 * @description Scans approved weekend and holiday attendance logs to calculate 
 * and credit TOIL balances based on the active company policy.
 * Issue: #1165
 */
const { ToilPolicy, ToilLedger } = require('../models/toil.model');
const logger = require('./logger');

/**
 * Determines if a specific date falls on a weekend.
 * @param {Date} date 
 * @returns {boolean}
 */
function isWeekend(date) {
    const day = new Date(date).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Calculates the current active TOIL balance for an employee.
 * @param {string} tenantId 
 * @param {string} employeeId 
 * @returns {Promise<number>}
 */
async function getCurrentBalance(tenantId, employeeId) {
    const result = await ToilLedger.aggregate([
        { $match: { tenantId: mongoose.Types.ObjectId(tenantId), employeeId: mongoose.Types.ObjectId(employeeId) } },
        { $group: { _id: null, total: { $sum: '$days' } } }
    ]);
    return result.length > 0 ? result[0].total : 0;
}

/**
 * Processes a batch of approved attendance records and credits TOIL.
 * 
 * @param {Array} attendanceRecords - Array of approved Attendance documents
 * @param {string} tenantId 
 * @param {Array<string>} publicHolidays - Array of date strings (YYYY-MM-DD) for public holidays
 * @returns {Promise<{processed: number, credited: number}>}
 */
async function processToilAccruals(attendanceRecords, tenantId, publicHolidays = []) {
    const policy = await ToilPolicy.findOne({ tenantId, isActive: true });
    if (!policy) {
        logger.info(`[TOIL] No active policy for tenant ${tenantId}. Skipping accruals.`);
        return { processed: 0, credited: 0 };
    }

    const holidaySet = new Set(publicHolidays.map(d => new Date(d).toISOString().split('T')[0]));
    let processedCount = 0;
    let creditedCount = 0;

    for (const record of attendanceRecords) {
        const dateStr = new Date(record.date).toISOString().split('T')[0];
        const isHoliday = holidaySet.has(dateStr);
        const isWeekendDay = isWeekend(record.date);

        // Only accrue if worked on a weekend or public holiday
        if (!isHoliday && !isWeekendDay) continue;

        // Check if TOIL was already credited for this specific attendance record
        const existingCredit = await ToilLedger.findOne({
            tenantId,
            employeeId: record.employeeId,
            referenceId: record._id,
            transactionType: 'Accrual'
        });

        if (existingCredit) continue;

        // Calculate accrual amount
        const multiplier = isHoliday ? policy.holidayMultiplier : policy.weekendMultiplier;
        const daysToCredit = 1 * multiplier; // Assuming 1 full day of work

        if (daysToCredit <= 0) continue;

        // Check accumulation cap
        const currentBalance = await getCurrentBalance(tenantId, record.employeeId);
        const allowedCredit = Math.min(daysToCredit, policy.maxAccumulationDays - currentBalance);

        if (allowedCredit <= 0) {
            logger.info(`[TOIL] Employee ${record.employeeId} reached max accumulation cap.`);
            continue;
        }

        // Calculate expiration date
        const expiresAt = new Date(record.date);
        expiresAt.setDate(expiresAt.getDate() + policy.expirationDays);

        // Create ledger entry
        await ToilLedger.create({
            tenantId,
            employeeId: record.employeeId,
            transactionType: 'Accrual',
            days: allowedCredit,
            balanceAfter: currentBalance + allowedCredit,
            expiresAt,
            referenceId: record._id,
            description: `TOIL Accrual for ${isHoliday ? 'Public Holiday' : 'Weekend'} work on ${dateStr}`
        });

        creditedCount += allowedCredit;
        processedCount++;
    }

    return { processed: processedCount, credited: creditedCount };
}

module.exports = { processToilAccruals, getCurrentBalance, isWeekend };
