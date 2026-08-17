/**
 * @fileoverview Kudos Allowance Distributor
 * @description Cron-based utility to refresh employee point balances on the 1st of every month.
 * Handles carry-over limits and logs allowance distributions to the ledger.
 * Issue: #1084
 */
const { RecognitionConfig, KudosLedger, KudosBalance } = require('../models/recognition.model');
const Employee = require('../models/employee.model');
const logger = require('./logger');

/**
 * Distributes monthly Kudos allowances to all active employees in a tenant.
 * Enforces carry-over limits from the previous month.
 * 
 * @param {string} tenantId 
 * @returns {Promise<{processed: number, distributed: number}>}
 */
async function distributeMonthlyAllowances(tenantId) {
    const config = await RecognitionConfig.findOne({ tenantId });
    if (!config || !config.isActive) {
        logger.info(`[Kudos] No active config found for tenant ${tenantId}. Skipping distribution.`);
        return { processed: 0, distributed: 0 };
    }

    const activeEmployees = await Employee.find({ tenantId, isActive: true, isDeleted: { $ne: true } });
    let processedCount = 0;
    let distributedCount = 0;

    for (const emp of activeEmployees) {
        let balance = await KudosBalance.findOne({ tenantId, employeeId: emp._id });

        if (!balance) {
            balance = new KudosBalance({
                tenantId,
                employeeId: emp._id,
                availablePoints: 0,
                lifetimeEarned: 0,
                lifetimeRedeemed: 0
            });
        }

        // Apply carry-over limit to existing balance before adding new allowance
        const carriedOver = Math.min(balance.availablePoints, config.maxCarryOver);
        const pointsToAdd = config.monthlyAllowance;

        balance.availablePoints = carriedOver + pointsToAdd;
        balance.lifetimeEarned += pointsToAdd;
        balance.lastRefreshDate = new Date();

        await balance.save();

        // Log the allowance in the ledger
        await KudosLedger.create({
            tenantId,
            senderId: emp._id, // System allowance, sender is self or null (using self for schema simplicity)
            receiverId: emp._id,
            points: pointsToAdd,
            message: `Monthly Kudos Allowance for ${new Date().toLocaleString('default', { month: 'long' })}`,
            isPublic: false,
            transactionType: 'Allowance'
        });

        processedCount++;
        distributedCount += pointsToAdd;
    }

    logger.info(`[Kudos] Distributed ${distributedCount} points to ${processedCount} employees for tenant ${tenantId}`);
    return { processed: processedCount, distributed: distributedCount };
}

module.exports = { distributeMonthlyAllowances };
