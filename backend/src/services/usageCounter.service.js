/**
 * Usage Counter Service - Issue #1113
 *
 * Redis-backed metered usage tracking for tenant subscriptions.
 * Every tenant gets daily bucket keys: usage:{tenantId}:{YYYY-MM}:{metric}
 *
 * Supports:
 *   - increment()     — atomic Redis HINCRBY on daily bucket
 *   - getMonthlyUsage() — aggregates all daily keys for the current month
 *   - checkLimit()    — compares current usage against plan limits
 *   - resetMonthly()  — clears daily keys after rollup
 *   - getUsageHistory() — returns usage for the last N months
 *
 * Redis is optional: falls back to in-memory Map when REDIS_URL is unset,
 * matching the pattern in cache.service.js.
 */
'use strict';

const { createClient } = require('redis');
const TenantSubscription = require('../models/tenantSubscription.model');
const Plan = require('../models/plan.model');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Redis or in-memory fallback
// ---------------------------------------------------------------------------

let redisClient = null;
const memoryStore = new Map(); // fallback: "tenantId:YYYY-MM:metric" → number

async function getRedisClient() {
  if (redisClient) return redisClient;

  if (!process.env.REDIS_URL) return null;

  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => {
      logger.warn('UsageCounter Redis error', { error: err.message });
      redisClient = null; // allow reconnection attempt later
    });
    await redisClient.connect();
    logger.info('UsageCounter connected to Redis');
    return redisClient;
  } catch (err) {
    logger.warn('UsageCounter Redis unavailable, using in-memory fallback', {
      error: err.message,
    });
    redisClient = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the daily bucket key for a given tenant, month, and metric.
 * Format: usage:{tenantId}:{YYYY-MM}:{metric}
 */
function dailyBucketKey(tenantId, month, metric) {
  return `usage:${tenantId}:${month}:${metric}`;
}

/**
 * Format a Date as YYYY-MM.
 */
function formatMonth(date) {
  const d = date || new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Build the list of daily keys for a given month (1..31).
 * We generate all 31 possible keys and let Redis return nil for missing ones.
 */
function dailyKeysForMonth(tenantId, month, metric, maxDay = 31) {
  const keys = [];
  for (let day = 1; day <= maxDay; day++) {
    const dd = String(day).padStart(2, '0');
    keys.push(`${dailyBucketKey(tenantId, month, metric)}:${dd}`);
  }
  return keys;
}

/**
 * Days in a given month (YYYY-MM).
 */
function daysInMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Increment a usage counter for a tenant.
 *
 * @param {string} tenantId
 * @param {string} metric — e.g. 'employees', 'reportSchedules', 'apiCalls'
 * @param {number} delta  — amount to add (default 1)
 * @returns {Promise<number>} new daily total
 */
async function increment(tenantId, metric, delta = 1) {
  if (!tenantId || !metric) {
    throw new Error('increment requires tenantId and metric');
  }

  const month = formatMonth();
  const day = new Date().getUTCDate();
  const key = `${dailyBucketKey(tenantId, month, metric)}:${day}`;

  const client = await getRedisClient();

  if (client) {
    try {
      const newVal = await client.hIncrBy(`usage:${tenantId}:${month}`, metric, delta);
      // Also set a daily expiry on the key so old months don't leak memory
      await client.expire(`usage:${tenantId}:${month}`, 90 * 24 * 3600); // 90 days
      logger.debug('UsageCounter increment (Redis)', { tenantId, metric, delta, newVal });
      return newVal;
    } catch (err) {
      logger.warn('UsageCounter Redis increment failed, falling back', { error: err.message });
    }
  }

  // In-memory fallback
  const storeKey = `usage:${tenantId}:${month}:${metric}`;
  const current = memoryStore.get(storeKey) || 0;
  const newVal = current + delta;
  memoryStore.set(storeKey, newVal);

  // Prune old keys periodically (simple TTL approximation)
  if (memoryStore.size > 10000) {
    const cutoff = `${formatMonth(new Date(Date.now() - 90 * 24 * 3600000))}`;
    for (const [k] of memoryStore) {
      const parts = k.split(':');
      if (parts[2] < cutoff) memoryStore.delete(k);
    }
  }

  logger.debug('UsageCounter increment (memory)', { tenantId, metric, delta, newVal });
  return newVal;
}

/**
 * Get aggregated monthly usage for a tenant.
 *
 * @param {string} tenantId
 * @param {string} [month] — YYYY-MM, defaults to current month
 * @returns {Promise<Object>} { employees: N, reportSchedules: N, apiCalls: N, ... }
 */
async function getMonthlyUsage(tenantId, month) {
  const targetMonth = month || formatMonth();
  const client = await getRedisClient();

  const metrics = ['employees', 'reportSchedules', 'apiCalls'];
  const result = {};

  if (client) {
    try {
      for (const metric of metrics) {
        const hashKey = `usage:${tenantId}:${targetMonth}`;
        const val = await client.hGet(hashKey, metric);
        result[metric] = val ? parseInt(val, 10) : 0;
      }
      return result;
    } catch (err) {
      logger.warn('UsageCounter getMonthlyUsage Redis failed', { error: err.message });
    }
  }

  // In-memory fallback: sum daily keys
  for (const metric of metrics) {
    let total = 0;
    const maxDay = daysInMonth(targetMonth);
    for (let day = 1; day <= maxDay; day++) {
      const storeKey = `usage:${tenantId}:${targetMonth}:${metric}`;
      total += memoryStore.get(storeKey) || 0;
    }
    result[metric] = total;
  }

  return result;
}

/**
 * Check whether a tenant is within plan limits for a given metric.
 *
 * @param {string} tenantId
 * @param {string} metric
 * @returns {Promise<{ allowed: boolean, current: number, limit: number, overage: number }>}
 */
async function checkLimit(tenantId, metric) {
  const sub = await TenantSubscription.findOne({ tenantId }).lean();
  if (!sub) {
    return { allowed: false, current: 0, limit: 0, overage: 0, reason: 'No subscription found' };
  }

  const plan = await Plan.findOne({ slug: sub.planSlug, isActive: true }).lean();
  if (!plan) {
    return { allowed: false, current: 0, limit: 0, overage: 0, reason: 'Plan not found' };
  }

  const limit = plan.limits[metric];
  if (limit === undefined || limit === null) {
    // Metric not tracked for this plan — allow by default
    return { allowed: true, current: 0, limit: Infinity, overage: 0 };
  }

  const usage = await getMonthlyUsage(tenantId);
  const current = usage[metric] || 0;
  const allowed = current < limit;
  const overage = allowed ? 0 : current - limit;

  return { allowed, current, limit, overage };
}

/**
 * Reset daily Redis keys for a completed month (called by usageRollup.job).
 * After rollup to tenantSubscription.usage, daily keys are no longer needed.
 *
 * @param {string} tenantId
 * @param {string} month — YYYY-MM
 * @returns {Promise<number>} number of keys deleted
 */
async function resetMonthly(tenantId, month) {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    const hashKey = `usage:${tenantId}:${month}`;
    const exists = await client.exists(hashKey);
    if (exists) {
      await client.del(hashKey);
      logger.info('UsageCounter reset monthly', { tenantId, month });
      return 1;
    }
    return 0;
  } catch (err) {
    logger.warn('UsageCounter resetMonthly failed', { error: err.message });
    return 0;
  }
}

/**
 * Get usage history for the last N months (aggregated from DB).
 *
 * @param {string} tenantId
 * @param {number} months — how many months back (default 6)
 * @returns {Promise<Array>} [{ month: '2025-01', employees: 12, ... }, ...]
 */
async function getUsageHistory(tenantId, months = 6) {
  const sub = await TenantSubscription.findOne({ tenantId }).lean();
  if (!sub) return [];

  // We don't store historical usage in the DB yet, so we return the current
  // month as a single entry. The usageRollup job will eventually persist
  // monthly snapshots that can power this endpoint.
  const currentMonth = formatMonth();
  const usage = await getMonthlyUsage(tenantId, currentMonth);

  return [
    {
      month: currentMonth,
      ...usage,
    },
  ];
}

module.exports = {
  increment,
  getMonthlyUsage,
  checkLimit,
  resetMonthly,
  getUsageHistory,
  formatMonth,
};
