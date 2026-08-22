/**
 * Usage Rollup Job - Issue #1113
 *
 * Daily BullMQ repeatable job that persists Redis usage counters to
 * TenantSubscription.usage and resets daily keys for the previous month.
 *
 * Runs at 02:00 UTC every day via cron.jobs.js.
 *
 * Flow:
 *   1. Find all TenantSubscription documents
 *   2. For each tenant, read current month usage from Redis via usageCounter.service
 *   3. Persist the snapshot to tenantSubscription.usage
 *   4. If the month has rolled over, reset the previous month's Redis keys
 *   5. Check for overage alerts and dispatch notifications if thresholds are exceeded
 */
'use strict';

const { Queue, Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const TenantSubscription = require('../models/tenantSubscription.model');
const Plan = require('../models/plan.model');
const usageCounter = require('../services/usageCounter.service');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Queue definition
// ---------------------------------------------------------------------------

let usageRollupQueue;

if (process.env.REDIS_URL) {
  usageRollupQueue = new Queue('usage-rollup', {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 7,   // keep last 7 completed jobs for debugging
      removeOnFail: 14,      // keep last 14 failures
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });

  usageRollupQueue.on('error', (err) => {
    logger.warn('BullMQ usageRollupQueue error', { error: err.message });
  });

  logger.info('BullMQ usage-rollup queue initialized');
} else {
  usageRollupQueue = {
    add: async () => {
      logger.warn('Redis not configured. usageRollupQueue.add() ignored.');
      return { id: 'mock-rollup-job' };
    },
    on: () => {},
  };
  logger.warn('BullMQ usage-rollup queue mocked (Redis disabled)');
}

// ---------------------------------------------------------------------------
// Overage thresholds (percentage above limit that triggers an alert)
// ---------------------------------------------------------------------------

const OVERAGE_WARNING_THRESHOLD = 0.8;  // 80% — send a soft warning
const OVERAGE_CRITICAL_THRESHOLD = 1.0; // 100% — hard limit exceeded

// ---------------------------------------------------------------------------
// Core rollup logic
// ---------------------------------------------------------------------------

/**
 * Persist current Redis usage counters to the TenantSubscription document.
 *
 * @param {string} tenantId
 * @returns {Promise<{ persisted: boolean, usage: Object }>}
 */
async function persistUsageForTenant(tenantId) {
  const currentMonth = usageCounter.formatMonth();
  const usage = await usageCounter.getMonthlyUsage(tenantId, currentMonth);

  const sub = await TenantSubscription.findOne({ tenantId });
  if (!sub) {
    logger.warn('UsageRollup: no subscription for tenant', { tenantId });
    return { persisted: false, usage: {} };
  }

  // Merge: take the max of Redis counter and existing DB value
  // This protects against Redis key expiry mid-month
  const merged = {
    employees: Math.max(usage.employees || 0, sub.usage?.employees || 0),
    reportSchedules: Math.max(usage.reportSchedules || 0, sub.usage?.reportSchedules || 0),
  };

  sub.usage = merged;
  await sub.save();

  logger.debug('UsageRollup: persisted', { tenantId, usage: merged });
  return { persisted: true, usage: merged };
}

/**
 * Check if a tenant is approaching or exceeding plan limits.
 * Returns alert info or null if within bounds.
 *
 * @param {string} tenantId
 * @param {Object} usage — current usage snapshot
 * @returns {Promise<Object|null>}
 */
async function checkOverageAlerts(tenantId, usage) {
  const sub = await TenantSubscription.findOne({ tenantId }).lean();
  if (!sub) return null;

  const plan = await Plan.findOne({ slug: sub.planSlug, isActive: true }).lean();
  if (!plan || !plan.limits) return null;

  const alerts = [];

  for (const [metric, limit] of Object.entries(plan.limits)) {
    const current = usage[metric] || 0;
    if (limit <= 0 || limit === Infinity) continue;

    const ratio = current / limit;

    if (ratio >= OVERAGE_CRITICAL_THRESHOLD) {
      alerts.push({
        severity: 'critical',
        metric,
        current,
        limit,
        message: `${metric} usage (${current}) has exceeded plan limit (${limit}).`,
      });
    } else if (ratio >= OVERAGE_WARNING_THRESHOLD) {
      alerts.push({
        severity: 'warning',
        metric,
        current,
        limit,
        message: `${metric} usage (${current}) is approaching plan limit (${limit}).`,
      });
    }
  }

  return alerts.length > 0 ? alerts : null;
}

/**
 * Run the full rollup process for all active tenants.
 *
 * @returns {Promise<{ processed: number, errors: number, alerts: number }>}
 */
async function runUsageRollup() {
  const startTime = Date.now();
  let processed = 0;
  let errors = 0;
  let alertsFound = 0;

  logger.info('UsageRollup: starting daily rollup');

  try {
    const subscriptions = await TenantSubscription.find({
      status: { $in: ['active', 'trialing'] },
    }).lean();

    logger.info(`UsageRollup: processing ${subscriptions.length} active subscriptions`);

    for (const sub of subscriptions) {
      try {
        const tenantId = String(sub.tenantId);

        // 1. Persist current usage to DB
        const { persisted, usage } = await persistUsageForTenant(tenantId);
        if (!persisted) {
          errors++;
          continue;
        }

        // 2. Check for overage alerts
        const overageAlerts = await checkOverageAlerts(tenantId, usage);
        if (overageAlerts) {
          alertsFound += overageAlerts.length;

          // Log each alert with appropriate severity
          for (const alert of overageAlerts) {
            if (alert.severity === 'critical') {
              logger.warn('UsageRollup: CRITICAL overage', {
                tenantId,
                metric: alert.metric,
                current: alert.current,
                limit: alert.limit,
              });
            } else {
              logger.info('UsageRollup: overage warning', {
                tenantId,
                metric: alert.metric,
                current: alert.current,
                limit: alert.limit,
              });
            }
          }
        }

        processed++;
      } catch (err) {
        errors++;
        logger.error('UsageRollup: tenant processing failed', {
          tenantId: String(sub.tenantId),
          error: err.message,
        });
      }
    }

    // 3. Reset previous month's Redis keys if we're past the 1st
    const now = new Date();
    if (now.getUTCDate() > 1) {
      const prevMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
      const prevMonthStr = usageCounter.formatMonth(prevMonth);

      for (const sub of subscriptions) {
        try {
          await usageCounter.resetMonthly(String(sub.tenantId), prevMonthStr);
        } catch (err) {
          // Non-critical — old keys will expire naturally
          logger.debug('UsageRollup: reset failed (non-critical)', {
            tenantId: String(sub.tenantId),
            month: prevMonthStr,
            error: err.message,
          });
        }
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info('UsageRollup: completed', {
      processed,
      errors,
      alerts: alertsFound,
      elapsedMs: elapsed,
    });

    return { processed, errors, alerts: alertsFound };
  } catch (err) {
    logger.error('UsageRollup: fatal error', { error: err.message });
    return { processed, errors: errors + 1, alerts: alertsFound };
  }
}

// ---------------------------------------------------------------------------
// BullMQ Worker
// ---------------------------------------------------------------------------

let usageRollupWorker;

if (process.env.REDIS_URL) {
  usageRollupWorker = new Worker(
    'usage-rollup',
    async () => {
      return await runUsageRollup();
    },
    {
      connection: redisConnection,
      concurrency: 1, // Only one rollup job should run at a time
    },
  );

  usageRollupWorker.on('completed', (job, result) => {
    logger.info('UsageRollup worker completed', {
      jobId: job.id,
      ...result,
    });
  });

  usageRollupWorker.on('failed', (job, err) => {
    logger.error('UsageRollup worker failed', {
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('UsageRollup worker started');
}

// ---------------------------------------------------------------------------
// Manual trigger (for cron.jobs.js or testing)
// ---------------------------------------------------------------------------

/**
 * Schedule the daily rollup job. Called from cron.jobs.js on server startup.
 * Uses BullMQ's repeat option for cron-like scheduling.
 */
async function scheduleUsageRollup() {
  if (!process.env.REDIS_URL) {
    logger.warn('UsageRollup: skipping schedule (Redis not configured)');
    return;
  }

  try {
    await usageRollupQueue.add(
      'daily-rollup',
      {},
      {
        repeat: {
          pattern: '0 2 * * *', // 02:00 UTC every day
        },
        jobId: 'usage-rollup-daily',
      },
    );
    logger.info('UsageRollup: scheduled daily at 02:00 UTC');
  } catch (err) {
    // If the job already exists, BullMQ throws; that's fine
    if (err.message?.includes('already exists')) {
      logger.debug('UsageRollup: daily job already scheduled');
    } else {
      logger.error('UsageRollup: schedule failed', { error: err.message });
    }
  }
}

module.exports = {
  runUsageRollup,
  scheduleUsageRollup,
  persistUsageForTenant,
  checkOverageAlerts,
  usageRollupQueue,
};
