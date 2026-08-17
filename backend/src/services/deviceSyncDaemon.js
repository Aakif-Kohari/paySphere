/**
 * @fileoverview Biometric Device Sync Daemon
 * @description Background service to process unprocessed raw punch logs, 
 * run anomaly detection, and update the status of the logs.
 * Issue: #1002
 */
const { RawPunchLog } = require('../models/biometric.model');
const { reconcileEmployeeDay } = require('../utils/punchReconciler');
const logger = require('../utils/logger');

/**
 * Processes all unprocessed raw logs for a specific tenant and date.
 * Groups them by employee, runs the reconciler, and updates statuses.
 * 
 * @param {string} tenantId 
 * @param {Date} targetDate 
 * @returns {Promise<{ processed: number, flagged: number }>}
 */
async function processDailySync(tenantId, targetDate) {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all unprocessed logs for the day
    const rawLogs = await RawPunchLog.find({
        tenantId,
        timestamp: { $gte: startOfDay, $lte: endOfDay },
        status: 'Unprocessed'
    }).sort({ externalEmployeeId: 1, timestamp: 1 });

    if (rawLogs.length === 0) {
        return { processed: 0, flagged: 0 };
    }

    // Group logs by employee
    const groupedByEmployee = {};
    rawLogs.forEach(log => {
        if (!groupedByEmployee[log.externalEmployeeId]) {
            groupedByEmployee[log.externalEmployeeId] = [];
        }
        groupedByEmployee[log.externalEmployeeId].push(log);
    });

    let processedCount = 0;
    let flaggedCount = 0;

    // Process each employee's day
    for (const [empId, logs] of Object.entries(groupedByEmployee)) {
        const result = reconcileEmployeeDay(logs);

        const newStatus = result.isClean ? 'Reconciled' : 'Flagged';
        const logIds = logs.map(l => l._id);

        // Update all logs for this employee/day with the new status
        // In a full implementation, we'd also write the paired shifts to the official Attendance ledger here.
        await RawPunchLog.updateMany(
            { _id: { $in: logIds } },
            {
                $set: { status: newStatus },
                $push: { anomalyFlags: { $each: result.globalAnomalies } }
            }
        );

        processedCount += logs.length;
        if (!result.isClean) flaggedCount += logs.length;
    }

    logger.info(`Biometric Sync Daemon: Processed ${processedCount} logs, flagged ${flaggedCount} for tenant ${tenantId}`);
    return { processed: processedCount, flagged: flaggedCount };
}

module.exports = { processDailySync };
