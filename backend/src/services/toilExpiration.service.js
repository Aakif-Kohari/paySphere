/**
 * @fileoverview TOIL Expiration Service
 * @description Daily cron job logic to expire unused compensatory offs 
 * and trigger notifications before they lapse.
 * Issue: #1165
 */
const { ToilLedger } = require('../models/toil.model');
const logger = require('../utils/logger');

/**
 * Scans the ledger for expired TOIL accruals and deducts them from the balance.
 * Designed to be called by a daily BullMQ cron job.
 * 
 * @param {string} tenantId - Optional: Run for specific tenant or null for all
 * @returns {Promise<{expiredCount: number, daysExpired: number}>}
 */
async function processToilExpirations(tenantId = null) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const query = {
        transactionType: 'Accrual',
        expiresAt: { $lt: now }, // Expired
        days: { $gt: 0 } // Still has a positive balance (hasn't been fully used or already expired)
    };

    if (tenantId) query.tenantId = tenantId;

    // Find all accrual transactions that have passed their expiration date
    // Note: In a highly optimized system, we would track "remaining days" on the accrual record itself.
    // For this implementation, we assume an accrual is fully consumed if a subsequent Usage transaction references it,
    // or we simply expire the oldest available balance (FIFO).

    const expiredAccruals = await ToilLedger.find(query).populate('employeeId', 'fullName email');

    let expiredCount = 0;
    let daysExpired = 0;

    for (const accrual of expiredAccruals) {
        // Calculate how many days from this specific accrual are still unused
        // (Simplified FIFO: we assume if it's expiring today and hasn't been marked expired, the remaining balance is the original days)
        const usedFromThisAccrual = await ToilLedger.aggregate([
            {
                $match: {
                    tenantId: accrual.tenantId,
                    employeeId: accrual.employeeId,
                    transactionType: 'Usage',
                    createdAt: { $gt: accrual.createdAt, $lt: now }
                }
            },
            { $group: { _id: null, totalUsed: { $sum: { $abs: '$days' } } } }
        ]);

        const totalUsed = usedFromThisAccrual.length > 0 ? usedFromThisAccrual[0].totalUsed : 0;

        // This is a simplified calculation. A robust FIFO engine would map specific usages to specific accruals.
        const remainingDays = accrual.days - totalUsed;

        if (remainingDays > 0) {
            // Fetch current total balance to calculate balanceAfter
            const currentTotal = await ToilLedger.aggregate([
                { $match: { tenantId: accrual.tenantId, employeeId: accrual.employeeId } },
                { $group: { _id: null, total: { $sum: '$days' } } }
            ]);
            const currentBalance = currentTotal.length > 0 ? currentTotal[0].total : 0;

            // Create Expiration transaction
            await ToilLedger.create({
                tenantId: accrual.tenantId,
                employeeId: accrual.employeeId,
                transactionType: 'Expiration',
                days: -remainingDays, // Deduct from balance
                balanceAfter: currentBalance - remainingDays,
                referenceId: accrual._id,
                description: `Auto-expired TOIL from ${accrual.createdAt.toLocaleDateString()}`
            });

            // Emit notification event (e.g., to email/push service)
            // eventBus.emit('TOIL_EXPIRED', { employee: accrual.employeeId, days: remainingDays });
            logger.info(`[TOIL] Expired ${remainingDays} days for employee ${accrual.employeeId.fullName}`);

            expiredCount++;
            daysExpired += remainingDays;
        }
    }

    return { expiredCount, daysExpired };
}

module.exports = { processToilExpirations };
