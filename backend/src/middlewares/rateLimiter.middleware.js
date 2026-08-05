const rateLimit = require("express-rate-limit");
const cacheService = require("../services/cache.service");

// Determine the store to use (Redis if configured, memory otherwise)
let store = undefined;
if (cacheService.isRedisEnabled && cacheService.client) {
  const { RedisStore } = require("rate-limit-redis");
  store = new RedisStore({
    sendCommand: (...args) => cacheService.client.call(...args),
  });
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: parseInt(process.env.AUTH_RATE_LIMIT, 10) || 30, // Default 30 (increased from 15)
  message: {
    message: "Too many authentication attempts from this IP, please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
});

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: parseInt(process.env.GENERAL_RATE_LIMIT, 10) || 1000, // Increased threshold for high-volume read/list operations during peak hours (from 100)
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
});

const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: parseInt(process.env.WRITE_RATE_LIMIT, 10) || 500, // Increased limit for bulk payroll processing & edits (from 200)
  message: {
    message: "Too many write operations from this IP, please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
});

module.exports = { authRateLimiter, generalRateLimiter, writeRateLimiter };
