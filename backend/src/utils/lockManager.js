const { redisClient } = require('../services/cache.service');
const CronLock = require('../models/cronlock.model');
const logger = require('./logger');

/**
 * Attempts to acquire a distributed lock.
 * Uses Redis first if active, otherwise falls back to MongoDB CronLock collections.
 * 
 * @param {string} lockKey - Unique identifier for the lock
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @returns {Promise<boolean>} True if lock acquired, false if already locked
 */
async function acquireLock(lockKey, ttlMs = 300000) { // Default 5 minutes TTL
  try {
    // 1. Attempt using Redis NX (set if not exists)
    if (redisClient && redisClient.isOpen) {
      const result = await redisClient.set(lockKey, '1', {
        NX: true,
        PX: ttlMs,
      });
      if (result === 'OK') {
        logger.info(`Lock acquired in Redis: ${lockKey}`);
        return true;
      }
      logger.warn(`Redis lock already held: ${lockKey}`);
      return false;
    }
  } catch (error) {
    logger.warn('Failed to acquire lock via Redis. Falling back to MongoDB.', { error: error.message });
  }

  // 2. Fallback to MongoDB unique _id constraint lock
  try {
    const expiresAt = new Date(Date.now() + ttlMs);
    await CronLock.create({
      _id: lockKey,
      lockedAt: new Date(),
      expiresAt,
    });
    logger.info(`Lock acquired in MongoDB: ${lockKey}`);
    return true;
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error: lock already exists and is active
      // Check if it has expired (Mongoose expireAfterSeconds: 0 cleanup is eventual)
      const existing = await CronLock.findById(lockKey);
      if (existing && existing.expiresAt < new Date()) {
        // Safe to override expired lock
        await CronLock.findByIdAndUpdate(lockKey, {
          lockedAt: new Date(),
          expiresAt: new Date(Date.now() + ttlMs),
        });
        logger.info(`Override expired MongoDB lock: ${lockKey}`);
        return true;
      }
      logger.warn(`MongoDB lock already held: ${lockKey}`);
      return false;
    }
    logger.error('Failed to acquire lock via MongoDB:', error.message);
    return false;
  }
}

/**
 * Releases a previously acquired distributed lock.
 * 
 * @param {string} lockKey - Unique identifier for the lock
 * @returns {Promise<void>}
 */
async function releaseLock(lockKey) {
  try {
    // Release in Redis
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(lockKey);
      logger.info(`Lock released in Redis: ${lockKey}`);
    }
  } catch (error) {
    logger.warn('Failed to release lock in Redis:', error.message);
  }

  try {
    // Release in MongoDB
    await CronLock.deleteOne({ _id: lockKey });
    logger.info(`Lock released in MongoDB: ${lockKey}`);
  } catch (error) {
    logger.error('Failed to release lock in MongoDB:', error.message);
  }
}

module.exports = {
  acquireLock,
  releaseLock,
};
