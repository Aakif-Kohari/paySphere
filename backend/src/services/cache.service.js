const Redis = require("ioredis");
const logger = require("../utils/logger");

// Use a mock cache if REDIS_URL is not provided so it doesn't crash environments without Redis
class CacheService {
  constructor() {
    this.isRedisEnabled = !!process.env.REDIS_URL;
    
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
    }
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
            await this.client.del(...keys);
          }
        } while (cursor !== "0");
      } catch (error) {
        logger.error(`Cache INVALIDATE error for pattern ${pattern}:`, error);
      }
    }
  }
}

module.exports = new CacheService();
