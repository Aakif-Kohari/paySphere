/**
 * @fileoverview Monthly Leave Accrual Cron Job
 * @description Runs on the 1st of every month at 00:00 UTC. Processes leave 
 * accruals for all active employees, handling pro-ration and idempotency 
 * via the CronLock model to prevent double-accrual on restarts.
 * 
 * Issue: #646
 */

const mongoose = require('mongoose');
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const Employee = require('../models/employee.model');
const LeavePolicy = require('../models/leavePolicy.model');
const LeaveBalance = require('../models/leaveBalance.model');
const CronLock = require('../models/cronlock.model'); // Existing model for idempotency
const { calculateProRatedAccrual } = require('../utils/leaveAccrual');
const logger = require('../utils/logger');

const accrualQueue = new Queue('leave-accruals', { connection: redisConnection });

/**
 * Processes the monthly leave accrual for all active employees.
 * Uses CronLock to ensure idempotency (Issue #283 pattern).
 */
async function processMonthlyAccrual() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lockKey = `leave-accrual-${currentYear}-${currentMonth}`;

    // 1. Idempotency Check: Prevent double-accrual if job restarts
    const lock = await CronLock.findOneAndUpdate(
        { _id: lockKey },
        { $setOnInsert: { lockedAt: new Date(), status: 'processing' } },
        { upsert: true, new: true }
    );

    if (lock.status === 'completed') {
        logger.info(`Leave accrual for ${currentMonth}/${currentYear} already completed. Skipping.`);
        return;
    }

    try {
        logger.info(`Starting monthly leave accrual for ${currentMonth}/${currentYear}`);

        // 2. Fetch all active policies and employees
        const policies = await LeavePolicy.find({ isActive: true }).lean();
        if (policies.length === 0) {
            logger.info('No active leave policies found.');
            await CronLock.updateOne({ _id: lockKey }, { status: 'completed' });
            return;
        }

        // Group policies by tenant for efficient processing
        const policiesByTenant = policies.reduce((acc, p) => {
            if (!acc[p.tenantId]) acc[p.tenantId] = [];
            acc[p.tenantId].push(p);
            return acc;
        }, {});

        const tenantIds = Object.keys(policiesByTenant);

        // 3. Process each tenant's employees
        for (const tenantId of tenantIds) {
            const tenantPolicies = policiesByTenant[tenantId];

            const employees = await Employee.find({
                tenantId,
                isActive: true,
                isDeleted: { $ne: true },
                employmentStatus: { $ne: 'exited' }
            }).select('_id joiningDate exitDetails').lean();

            for (const emp of employees) {
                for (const policy of tenantPolicies) {
                    try {
                        // Determine effective start date for pro-ration
                        const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : null;
                        const monthStart = new Date(currentYear, currentMonth - 1, 1);
                        const monthEnd = new Date(currentYear, currentMonth, 0); // Last day of month

                        // If employee joined after this month ended, skip
                        if (joinDate && joinDate > monthEnd) continue;

                        // Calculate pro-rated accrual
                        const accrualAmount = calculateProRatedAccrual(
                            policy.accrualRate,
                            joinDate || monthStart,
                            monthEnd,
                            currentMonth,
                            currentYear
                        );

                        if (accrualAmount <= 0) continue;

                        // Upsert the balance record
                        await LeaveBalance.findOneAndUpdate(
                            {
                                tenantId,
                                employeeId: emp._id,
                                policyId: policy._id,
                                year: currentYear
                            },
                            {
                                $inc: { currentBalance: accrualAmount },
                                $set: {
                                    lastAccrualDate: now,
                                    leaveType: policy.leaveType
                                },
                                $setOnInsert: {
                                    usedThisYear: 0,
                                    carriedForwardFromLastYear: 0
                                }
                            },
                            { upsert: true, new: true }
                        );
                    } catch (empError) {
                        logger.error(`Failed to accrue leave for employee ${emp._id}`, { error: empError.message });
                    }
                }
            }
        }

        // 4. Mark lock as completed
        await CronLock.updateOne({ _id: lockKey }, { status: 'completed', completedAt: new Date() });
        logger.info(`Successfully completed leave accrual for ${currentMonth}/${currentYear}`);

    } catch (error) {
        logger.error('Monthly leave accrual job failed', { error: error.message });
        // Don't mark as completed so it can be retried manually or next run
        await CronLock.updateOne({ _id: lockKey }, { status: 'failed', error: error.message });
        throw error;
    }
}

module.exports = { processMonthlyAccrual, accrualQueue };
