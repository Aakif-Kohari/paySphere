/**
 * @fileoverview Celebration Cron Service
 * @description Daily cron job logic to scan the employee database for upcoming 
 * birthdays and work anniversaries, generating celebration events and triggering 
 * dashboard notifications.
 * Issue: #1286
 */
const { Celebration } = require('../models/celebration.model');
const Employee = require('../models/employee.model');
const logger = require('../utils/logger');

/**
 * Checks if a date matches the current month and day.
 * @param {Date} targetDate 
 * @param {Date} currentDate 
 * @returns {boolean}
 */
function isMatchingDay(targetDate, currentDate) {
    if (!targetDate) return false;
    const target = new Date(targetDate);
    return target.getMonth() === currentDate.getMonth() &&
        target.getDate() === currentDate.getDate();
}

/**
 * Calculates the number of years between two dates.
 * @param {Date} pastDate 
 * @param {Date} currentDate 
 * @returns {number}
 */
function calculateYears(pastDate, currentDate) {
    if (!pastDate) return 0;
    const past = new Date(pastDate);
    let years = currentDate.getFullYear() - past.getFullYear();
    const monthDiff = currentDate.getMonth() - past.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < past.getDate())) {
        years--;
    }
    return years;
}

/**
 * Generates a celebratory message based on the event type and milestone.
 * @param {string} employeeName 
 * @param {string} type 
 * @param {number} years 
 * @returns {string}
 */
function generateMessage(employeeName, type, years) {
    if (type === 'Birthday') {
        return `🎉 Happy Birthday, ${employeeName}! Wishing you a fantastic day and a great year ahead!`;
    }

    if (type === 'WorkAnniversary') {
        if (years === 1) return `🎊 Happy 1st Work Anniversary, ${employeeName}! Thank you for a great first year!`;
        if (years % 5 === 0) return `🏆 Happy ${years}th Work Anniversary, ${employeeName}! Thank you for your incredible dedication and milestone achievement!`;
        return `🎈 Happy ${years}th Work Anniversary, ${employeeName}! We appreciate your continued hard work!`;
    }

    return `Congratulations, ${employeeName}!`;
}

/**
 * Main cron execution function. Scans active employees and creates celebration records.
 * Designed to be called daily at 00:05 AM.
 * 
 * @param {string} tenantId - Optional: Run for specific tenant or null for all
 * @returns {Promise<{birthdays: number, anniversaries: number}>}
 */
async function processDailyCelebrations(tenantId = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = { isActive: true, isDeleted: { $ne: true } };
    if (tenantId) query.tenantId = tenantId;

    const employees = await Employee.find(query).select('tenantId fullName dateOfBirth joiningDate');

    let birthdayCount = 0;
    let anniversaryCount = 0;

    for (const emp of employees) {
        // 1. Check Birthday
        if (isMatchingDay(emp.dateOfBirth, today)) {
            try {
                const message = generateMessage(emp.fullName, 'Birthday', 0);
                await Celebration.create({
                    tenantId: emp.tenantId,
                    employeeId: emp._id,
                    type: 'Birthday',
                    eventDate: today,
                    message,
                    isNotified: true,
                    notifiedAt: new Date()
                });
                birthdayCount++;
                // In production: emit event to WebSocket/Push Notification service
                // eventBus.emit('CELEBRATION_TRIGGERED', { tenantId: emp.tenantId, employeeId: emp._id, type: 'Birthday' });
            } catch (error) {
                if (error.code !== 11000) { // Ignore duplicate key errors
                    logger.error(`[CelebrationCron] Failed to create birthday for ${emp._id}: ${error.message}`);
                }
            }
        }

        // 2. Check Work Anniversary
        if (isMatchingDay(emp.joiningDate, today)) {
            const years = calculateYears(emp.joiningDate, today);
            if (years > 0) {
                try {
                    const message = generateMessage(emp.fullName, 'WorkAnniversary', years);
                    await Celebration.create({
                        tenantId: emp.tenantId,
                        employeeId: emp._id,
                        type: 'WorkAnniversary',
                        milestoneYears: years,
                        eventDate: today,
                        message,
                        isNotified: true,
                        notifiedAt: new Date()
                    });
                    anniversaryCount++;
                    // eventBus.emit('CELEBRATION_TRIGGERED', { tenantId: emp.tenantId, employeeId: emp._id, type: 'WorkAnniversary' });
                } catch (error) {
                    if (error.code !== 11000) {
                        logger.error(`[CelebrationCron] Failed to create anniversary for ${emp._id}: ${error.message}`);
                    }
                }
            }
        }
    }

    logger.info(`[CelebrationCron] Processed ${birthdayCount} birthdays and ${anniversaryCount} anniversaries.`);
    return { birthdays: birthdayCount, anniversaries: anniversaryCount };
}

module.exports = { processDailyCelebrations };
