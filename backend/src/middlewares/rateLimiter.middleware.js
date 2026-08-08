/**
 * @fileoverview Rate limiting middleware.
 * @description Redis-backed sliding-window limiters for the API, falling back
 * to in-process memory when Redis is not configured.
 *
 * Issues: #159, #287, #484, #540, #685, #793.
 *
 * ---
 *
 * #685 replaced this module wholesale and broke four things at once (#793):
 *
 *   1. `const RedisStore = require('rate-limit-redis')` — v4+ has no default
 *      export, so `new RedisStore(...)` threw `RedisStore is not a constructor`
 *      and the module could not be required at all.
 *
 *   2. The three limiters were renamed to `standardLimiter` / `strictLimiter` /
 *      `writeRateLimiter`, while `app.js` and ten route modules import
 *      `generalRateLimiter` and `authRateLimiter`. Those became `undefined`, and
 *      `router.post('/login', undefined, handler)` throws at require time — so
 *      the server could not boot even once the file itself parsed.
 *
 *   3. The Redis store was constructed unconditionally. Redis is *optional*
 *      here — `cache.service.js` falls back to in-memory, `index.js` skips the
 *      webhook worker without `REDIS_URL` — so on a machine with no Redis every
 *      request got a store whose commands reject, which `express-rate-limit`
 *      surfaces as a 500 on everything.
 *
 *   4. The ceilings #287 and #540 raised on purpose were hardcoded back down
 *      (general 1000 -> 100, write 500/15min -> 10/min) and the env overrides
 *      were dropped. A tenant finalizing payroll for 40 employees hits that.
 *
 * What is kept from #685: per-user keying on the write limiter, which is a real
 * improvement — a shared office IP should not have one person's bulk edit lock
 * out their colleagues — and the structured log line on each rejection.
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Read a positive integer out of the environment, or fall back.
 *
 * `parseInt` alone is not enough: `RATE_LIMIT=` in a .env file parses to NaN,
 * and `express-rate-limit` treats a NaN limit as "reject everything", which is
 * a rough way to find out you have a typo in your deployment config.
 *
 * @param {string} name environment variable
 * @param {number} fallback
 * @returns {number}
 */
function limitFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (process.env[name] !== undefined) {
      logger.warn(`Ignoring unusable ${name}; falling back to the default`, {
        value: process.env[name],
        fallback,
      });
    }

    return fallback;
  }

  return parsed;
}

/**
 * The shared store, or `undefined` for the library's in-process default.
 *
 * Resolved once, through `cache.service` rather than `config/redis` directly,
 * so the limiter and the cache cannot disagree about whether Redis is in play.
 * Built lazily inside the guard: requiring `rate-limit-redis` is harmless, but
 * constructing a store against a client that does not exist is not.
 *
 * A single store instance is shared by all three limiters. That is safe —
 * `express-rate-limit` namespaces each limiter's keys with its own prefix — and
 * it means one Redis connection instead of three.
 *
 * @returns {object|undefined}
 */
function resolveStore() {
  if (!cacheService.isRedisEnabled || !cacheService.client) {
    logger.info(
      'Rate limiting is using the in-memory store: Redis is not configured. Counters will not be shared between instances.',
    );
    return undefined;
  }

  try {
    const { RedisStore } = require('rate-limit-redis');

    return new RedisStore({
      sendCommand: (...args) => cacheService.client.call(...args),
    });
  } catch (error) {
    // A limiter that cannot reach Redis should still limit, per instance,
    // rather than take the process down on the way up.
    logger.error(
      'Could not build the Redis rate-limit store; falling back to in-memory',
      { error: error.message },
    );
    return undefined;
  }
}

const store = resolveStore();

/**
 * Build one limiter.
 *
 * @param {object} options
 * @param {string} options.name for the log line
 * @param {number} options.windowMs
 * @param {number} options.limit
 * @param {string} options.message sent to the client on rejection
 * @param {Function} [options.keyGenerator]
 * @returns {Function} express middleware
 */
function buildLimiter({ name, windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded (${name})`, {
        ip: req.ip,
        userId: req.userId,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({ message });
    },
  });
}

/**
 * Sign-up, sign-in, OAuth, password reset and 2FA validation.
 *
 * Tighter than the rest because these are the endpoints worth guessing at, and
 * because a legitimate user hits them a handful of times a day at most.
 */
const authRateLimiter = buildLimiter({
  name: 'auth',
  windowMs: FIFTEEN_MINUTES,
  limit: limitFromEnv('AUTH_RATE_LIMIT', 30),
  message:
    'Too many authentication attempts from this IP, please try again after 15 minutes.',
});

/** Everything under /api. Sized for list and dashboard traffic at peak (#540). */
const generalRateLimiter = buildLimiter({
  name: 'general',
  windowMs: FIFTEEN_MINUTES,
  limit: limitFromEnv('GENERAL_RATE_LIMIT', 1000),
  message: 'Too many requests from this IP, please try again after 15 minutes.',
});

/**
 * State-changing routes: payroll finalization, bulk employee edits, deletes.
 *
 * Keyed by the authenticated user rather than the IP (#685), so a shared office
 * address does not let one person's bulk import throttle everyone behind the
 * same NAT. `ipKeyGenerator` is the library's own helper for the anonymous
 * fallback — a bare `req.ip` mis-buckets IPv6 clients, since a single client
 * gets a whole /64 and would otherwise look like an unlimited supply of
 * distinct callers.
 */
const writeRateLimiter = buildLimiter({
  name: 'write',
  windowMs: FIFTEEN_MINUTES,
  limit: limitFromEnv('WRITE_RATE_LIMIT', 500),
  message: 'Too many write operations, please try again after 15 minutes.',
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
});

module.exports = {
  authRateLimiter,
  generalRateLimiter,
  writeRateLimiter,

  // #685's names, kept as aliases so anything written against that PR keeps
  // working and nobody has to guess which of two vocabularies is current.
  standardLimiter: generalRateLimiter,
  strictLimiter: authRateLimiter,

  // Exported for the tests, and for anything that needs to know whether the
  // counters are shared across instances.
  isUsingRedisStore: () => store !== undefined,
};
