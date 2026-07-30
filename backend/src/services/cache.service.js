let Redis;
try {
  Redis = require("ioredis");
} catch {
  Redis = null;
}
const logger = require("../utils/logger");

// Use a mock cache if REDIS_URL is not provided so it doesn't crash environments without Redis
class CacheService {
  constructor() {
    this.isRedisEnabled = !!process.env.REDIS_URL && !!Redis;
    
    if (this.isRedisEnabled) {
      this.client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 50, 2000);
        }
      });
      
      this.client.on("error", (err) => {
        logger.error("Redis connection error:", err);
      });
      
      this.client.on("connect", () => {
        logger.info("Connected to Redis");
      });
    } else {
      logger.info("Redis is disabled (no REDIS_URL). Using in-memory fallback.");
      this.memoryCache = new Map();
      
      // Prevent memory leak by periodically cleaning up expired keys
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, item] of this.memoryCache.entries()) {
          if (now > item.expiresAt) {
            this.memoryCache.delete(key);
          }
        }
      }, 60000); // Check every minute
      this.cleanupInterval.unref(); // Don't block Node.js from exiting
    }
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.isRedisEnabled && this.client) this.client.disconnect();
  }

  async get(key) {
    try {
      if (this.isRedisEnabled) {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        const item = this.memoryCache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
          this.memoryCache.delete(key);
          return null;
        }
        return item.data;
      }
    } catch (error) {
      logger.error(`Cache GET error for key ${key}:`, error);
      return null; // Fail silently so app continues
    }
  }

  async setEx(key, ttlSeconds, data) {
    try {
      if (this.isRedisEnabled) {
        await this.client.setex(key, ttlSeconds, JSON.stringify(data));
      } else {
        this.memoryCache.set(key, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000
        });
      }
    } catch (error) {
      logger.error(`Cache SETEX error for key ${key}:`, error);
    }
  }

  async del(key) {
    try {
      if (this.isRedisEnabled) {
        await this.client.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.error(`Cache DEL error for key ${key}:`, error);
    }
  }

  /**
   * Invalidate every cached analytics response for a user.
   *
   * `getAnalytics` caches under `analytics:<userId>:<monthsBack>` for an hour,
   * so a single user has one entry per range they have viewed. This clears all
   * of them.
   *
   * Call this from anything that changes payroll aggregates — finalizing
   * payroll, deleting an employee, toggling one inactive. Before #415 only
   * addEmployee and updateEmployee did, so running payroll left the Reports
   * page showing stale figures for up to an hour.
   *
   * Never throws: a cache outage must not fail a payroll write.
   *
   * @param {string} userId
   * @returns {Promise<boolean>} whether invalidation completed cleanly
   */
  async invalidateAnalytics(userId) {
    if (!userId) return false;

    try {
      await this.invalidatePattern(`analytics:${userId}`);
      return true;
    } catch (error) {
      logger.error(`Analytics cache invalidation failed for user ${userId}:`, error);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    // In production with real Redis, you'd use SCAN
    // For this simple mock/fallback, we'll iterate
    if (!this.isRedisEnabled) {
      for (const k of this.memoryCache.keys()) {
        if (k.includes(pattern)) {
          this.memoryCache.delete(k);
        }
      }
    } else {
      // Basic SCAN implementation
      try {
        let cursor = "0";
        do {
          const res = await this.client.scan(cursor, "MATCH", `*${pattern}*`, "COUNT", "100");
          cursor = res[0];
          const keys = res[1];
          if (keys.length > 0) {
            const BATCH_SIZE = 500;
            for (let i = 0; i < keys.length; i += BATCH_SIZE) {
              const batch = keys.slice(i, i + BATCH_SIZE);
              await this.client.del(batch);
            }
          }
        } while (cursor !== "0");
      } catch (error) {
        logger.error(`Cache INVALIDATE error for pattern ${pattern}:`, error);
      }
    }
  }
}

const instance = new CacheService();
instance.CacheService = CacheService;
module.exports = instance;
