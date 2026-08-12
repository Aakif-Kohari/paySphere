const cacheService = require("../services/cache.service");
const logger = require("../utils/logger");

const memoryStore = new Map();

// Periodic cleanup of expired entries in memoryStore to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of memoryStore.entries()) {
    const valid = timestamps.filter(t => now - t < 15 * 60 * 1000);
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, valid);
    }
  }
}, 60000);
cleanupInterval.unref();

function runInMemoryFallback(key, now, windowStart, limit, windowMs) {
  let timestamps = memoryStore.get(key) || [];
  timestamps = timestamps.filter(t => t >= windowStart);

  let allowed = true;
  if (timestamps.length < limit) {
    timestamps.push(now);
    memoryStore.set(key, timestamps);
  } else {
    allowed = false;
  }

  const currentRequests = timestamps.length;
  const oldestTimestamp = timestamps[0] || now;
  const resetTime = oldestTimestamp + windowMs;

  return {
    allowed,
    currentRequests,
    resetTime,
  };
}

function createSlidingWindowRateLimiter({
  windowMs,
  limit,
  message,
  prefix,
}) {
  return async (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress || "unknown";
    const key = `ratelimit:${prefix}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const ttlSeconds = Math.ceil(windowMs / 1000);

    let allowed = true;
    let currentRequests = 0;
    let resetTime = now + windowMs;

    if (cacheService.isRedisEnabled && cacheService.client) {
      try {
        const uniqueMember = `${now}-${Math.random()}`;
        // Lua script for sliding window rate limiting
        const luaScript = `
          redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
          local currentRequests = redis.call('ZCARD', KEYS[1])
          if currentRequests < tonumber(ARGV[3]) then
            redis.call('ZADD', KEYS[1], ARGV[1], ARGV[5])
            redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
            return {1, currentRequests + 1}
          else
            return {0, currentRequests}
          end
        `;

        const result = await cacheService.client.eval(
          luaScript,
          1,
          key,
          now.toString(),
          windowStart.toString(),
          limit.toString(),
          ttlSeconds.toString(),
          uniqueMember
        );

        allowed = result[0] === 1;
        currentRequests = result[1];

        // Retrieve oldest timestamp in the set to compute precise reset time
        const oldest = await cacheService.client.zrange(key, 0, 0, "WITHSCORES");
        if (oldest && oldest.length >= 2) {
          const oldestScore = parseFloat(oldest[1]);
          resetTime = oldestScore + windowMs;
        }
      } catch (err) {
        logger.error(`Redis sliding window rate limiter error for key ${key}:`, err);
        const fallback = runInMemoryFallback(key, now, windowStart, limit, windowMs);
        allowed = fallback.allowed;
        currentRequests = fallback.currentRequests;
        resetTime = fallback.resetTime;
      }
    } else {
      const fallback = runInMemoryFallback(key, now, windowStart, limit, windowMs);
      allowed = fallback.allowed;
      currentRequests = fallback.currentRequests;
      resetTime = fallback.resetTime;
    }

    const remaining = Math.max(0, limit - currentRequests);

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));

    if (!allowed) {
      return res.status(429).json(message);
    }

    next();
  };
}

const authRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.AUTH_RATE_LIMIT, 10) || 30,
  message: {
    message: "Too many authentication attempts from this IP, please try again after 15 minutes."
  },
  prefix: "auth",
});

const generalRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.GENERAL_RATE_LIMIT, 10) || 1000,
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes."
  },
  prefix: "general",
});

const writeRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: parseInt(process.env.WRITE_RATE_LIMIT, 10) || 500,
  message: {
    message: "Too many write operations from this IP, please try again after 15 minutes."
  },
  prefix: "write",
});

module.exports = {
  authRateLimiter,
  generalRateLimiter,
  writeRateLimiter,
  _memoryStore: memoryStore,
};
