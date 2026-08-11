/**
 * Distributed Cron Lock Service
 *
 * Provides a Mongoose-backed distributed mutex that prevents duplicate job
 * execution when multiple application instances are running concurrently
 * (PM2 cluster mode, Kubernetes pods, Heroku dynos).
 *
 * Strategy: MongoDB's unique index on CronLock._id provides atomic
 * compare-and-swap semantics. Two instances racing to insert the same
 * lock name will produce one success and one E11000 duplicate-key error.
 * A TTL index on `expiresAt` auto-deletes locks held by dead processes.
 *
 * Usage:
 *   const { acquireLock, releaseLock } = require('./cronLock.service');
 *
 *   const lock = await acquireLock('monthly_payroll');
 *   if (!lock) return; // another instance already running
 *   try {
 *     await runPayrollJob();
 *     await releaseLock('monthly_payroll', 'completed');
 *   } catch (err) {
 *     await releaseLock('monthly_payroll', 'failed', err.message);
 *     throw err;
 *   }
 */
'use strict';

const CronLock = require('../models/cronlock.model');
const logger   = require('../utils/logger');

/** Default lock TTL — 5 minutes. Override per job as needed. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Attempt to acquire a named lock.
 *
 * @param {string} lockName   Unique job key (e.g. `'monthly_payroll'`).
 * @param {number} [ttlMs]    Lock time-to-live in milliseconds.
 * @returns {Promise<object|null>}  Lock document on success, `null` if already held.
 */
async function acquireLock(lockName, ttlMs = DEFAULT_TTL_MS) {
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const lock = await CronLock.create({
      _id: lockName,
      lockedAt: now,
      expiresAt,
      status: CronLock.LOCK_STATUS.PROCESSING,
    });
    logger.info('Cron lock acquired', { lockName, expiresAt });
    return lock;
  } catch (err) {
    if (err.code === 11000) {
      // Another instance already holds this lock.
      logger.warn('Cron lock already held — skipping job execution', { lockName });
      return null;
    }
    throw err;
  }
}

/**
 * Release a previously acquired lock.
 *
 * Updates the status fields before deletion so that a short-lived read after
 * job completion can see the outcome (the document is gone milliseconds later).
 *
 * @param {string}         lockName
 * @param {'completed'|'failed'} [finalStatus='completed']
 * @param {string|null}    [errorMessage=null]
 * @returns {Promise<void>}
 */
async function releaseLock(lockName, finalStatus = 'completed', errorMessage = null) {
  try {
    await CronLock.findByIdAndUpdate(lockName, {
      status:      finalStatus,
      completedAt: new Date(),
      error:       errorMessage,
    });
    await CronLock.findByIdAndDelete(lockName);
    logger.info('Cron lock released', { lockName, finalStatus });
  } catch (err) {
    // Never re-throw: a failure to release must not mask the job's own result.
    logger.error('Failed to release cron lock', { lockName, error: err.message });
  }
}

module.exports = { acquireLock, releaseLock };
