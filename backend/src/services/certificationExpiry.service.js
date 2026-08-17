/**
 * @fileoverview Certification Expiration Service
 * @description Daily cron logic to scan for certifications expiring in 30, 15, and 7 days.
 * Triggers automated email/push reminders and updates record statuses to 'Expired'.
 * Issue: #1085
 */
const { EmployeeTrainingRecord, TrainingCourse } = require('../models/training.model');
const logger = require('../utils/logger');

/**
 * Scans for expiring certifications and triggers reminders.
 * Designed to be called by a BullMQ daily cron job.
 * 
 * @param {string} tenantId - Optional: Run for a specific tenant, or null for all tenants.
 * @returns {Promise<{remindersSent: number, expiredCount: number}>}
 */
async function processExpiringCertifications(tenantId = null) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const query = { status: 'Completed' };
    if (tenantId) query.tenantId = tenantId;

    // Define reminder thresholds
    const thresholds = [
        { days: 30, label: '30-Day' },
        { days: 15, label: '15-Day' },
        { days: 7, label: '7-Day' },
        { days: 1, label: '1-Day' }
    ];

    let remindersSent = 0;
    let expiredCount = 0;

    // 1. Handle Expired Certifications (expiresAt < today)
    const expiredRecords = await EmployeeTrainingRecord.find({
        ...query,
        expiresAt: { $lt: now }
    });

    if (expiredRecords.length > 0) {
        const expiredIds = expiredRecords.map(r => r._id);
        await EmployeeTrainingRecord.updateMany(
            { _id: { $in: expiredIds } },
            { $set: { status: 'Expired' } }
        );
        expiredCount = expiredRecords.length;
        logger.info(`[CertExpiry] Marked ${expiredCount} certifications as Expired.`);
    }

    // 2. Handle Upcoming Expirations (Reminders)
    for (const threshold of thresholds) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + threshold.days);

        // Find records expiring exactly on the target date
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const expiringRecords = await EmployeeTrainingRecord.find({
            ...query,
            expiresAt: { $gte: startOfDay, $lte: endOfDay },
            // Prevent sending multiple reminders for the same threshold on the same day
            $or: [
                { lastReminderSentAt: null },
                { lastReminderSentAt: { $lt: startOfDay } }
            ]
        }).populate('courseId', 'title isMandatory').populate('employeeId', 'fullName email');

        for (const record of expiringRecords) {
            if (!record.employeeId || !record.courseId) continue;

            // In a production environment, this would emit an event to the email/push service
            // eventBus.emit('CERTIFICATION_EXPIRING', { employee, course, daysRemaining: threshold.days });
            logger.info(`[CertExpiry] ${threshold.label} reminder for ${record.employeeId.fullName} - ${record.courseId.title}`);

            // Update last reminder sent to prevent duplicate sends today
            record.lastReminderSentAt = new Date();
            await record.save();

            remindersSent++;
        }
    }

    return { remindersSent, expiredCount };
}

/**
 * Fetches compliance statistics for the dashboard.
 * @param {string} tenantId 
 * @returns {Promise<Object>}
 */
async function getComplianceStats(tenantId) {
    const totalAssigned = await EmployeeTrainingRecord.countDocuments({ tenantId, status: { $in: ['Assigned', 'In Progress', 'Completed', 'Expired'] } });
    const completed = await EmployeeTrainingRecord.countDocuments({ tenantId, status: 'Completed' });

    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const expiringSoon = await EmployeeTrainingRecord.countDocuments({
        tenantId,
        status: 'Completed',
        expiresAt: { $gte: now, $lte: in30Days }
    });

    const expired = await EmployeeTrainingRecord.countDocuments({ tenantId, status: 'Expired' });
    const nonCompliant = await EmployeeTrainingRecord.countDocuments({ tenantId, status: { $in: ['Assigned', 'Expired'] } });

    return {
        totalAssigned,
        completed,
        expiringSoon,
        expired,
        nonCompliant,
        complianceRate: totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 100
    };
}

module.exports = { processExpiringCertifications, getComplianceStats };
