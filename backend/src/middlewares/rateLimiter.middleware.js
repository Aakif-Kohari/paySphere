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
  limit: 15, // Limit each IP to 15 requests per `window`
  message: {
    message: "Too many authentication attempts from this IP, please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
});

const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window`
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
});

const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200, // Limit each IP to 200 write requests per `window`
  message: {
    message: "Too many write operations from this IP, please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
});

module.exports = { authRateLimiter, generalRateLimiter, writeRateLimiter };
