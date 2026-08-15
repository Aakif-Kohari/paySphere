const Redis = require("ioredis");
const logger = require("../utils/logger");

/**
 * Shared Redis connection for the BullMQ-backed workers.
 *
 * Three modules required `../config/redis`, none of which existed (#645):
 * `services/webhook.service.js`, `workers/webhook.worker.js` and
 * `jobs/leaveAccrual.job.js`. So the webhook feature shipped without its own
 * transport — the queue and worker were never wired up, and the two files would
 * throw at require time the moment anything imported them.
 *
 * The connection mirrors `jobs/queue.service.js`, which is the working pattern
 * for BullMQ in this repo: `maxRetriesPerRequest: null` (BullMQ requires it) and
 * no custom `retryStrategy` (BullMQ manages its own reconnection and will keep
 * waiting for this client to come back).
 *
 * Redis is *optional* in PaySphere — `services/cache.service.js` falls back to
 * in-memory when `REDIS_URL` is unset. BullMQ cannot fall back, so webhook
 * deliveries pause (not crash) while Redis is unreachable:
 *
 *   - the service checks `isRedisAvailable()` before enqueueing,
 *   - this client logs its connection errors, throttled to one line a minute so
 *     a downed Redis does not turn into log spam on every reconnect attempt.
 */

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

let lastLoggedErrorAt = 0;
connection.on("error", (err) => {
  const now = Date.now();
  if (now - lastLoggedErrorAt > 60000) {
    lastLoggedErrorAt = now;
    logger.warn(
      "Redis connection error. Webhook dispatch and background jobs will pause until Redis is reachable.",
      { error: err.message },
    );
  }
});

connection.on("ready", () => {
  logger.info("Connected to Redis", { url: REDIS_URL });
});

/**
 * Is the Redis connection usable right now?
 *
 * BullMQ queues/workers created while Redis is down will come back on their own
 * once the connection recovers, but a delivery enqueued while nothing is
 * listening would sit there until then. Callers that care about that (the
 * webhook dispatch service) check this first.
 *
 * @returns {boolean}
 */
function isRedisAvailable() {
  return connection.status === "ready";
}

module.exports = connection;
module.exports.isRedisAvailable = isRedisAvailable;
