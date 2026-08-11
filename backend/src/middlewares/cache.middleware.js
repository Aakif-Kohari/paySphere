/**
 * @fileoverview HTTP Response Caching Middleware
 * @description Intercepts Express responses to cache JSON payloads in Redis.
 * Generates deterministic cache keys based on the user ID, URL, and query parameters.
 * 
 * Issue: #722
 */

const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

/**
 * Creates a caching middleware for Express routes
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Time to live in seconds (default: 900 / 15 mins)
 * @param {string} options.prefix - Cache key prefix (e.g., 'reports')
 * @param {string[]} options.tags - Tags for group invalidation
 * @param {Function} options.keyGenerator - Custom function to generate cache key
 * @returns {Function} Express middleware
 */
function cacheMiddleware(options = {}) {
    const {
        ttl = 900,
        prefix = 'api',
        tags = [],
        keyGenerator = null,
    } = options;

    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip caching if explicitly requested via header
        if (req.headers['x-cache-control'] === 'no-cache') {
            return next();
        }

        try {
            // Generate deterministic cache key
            let cacheKey;
            if (keyGenerator && typeof keyGenerator === 'function') {
                cacheKey = keyGenerator(req);
            } else {
                // Default key: prefix:userId:url:queryHash
                const userId = req.userId || 'anonymous';
                const queryHash = cacheService.generateHash(JSON.stringify(req.query));
                cacheKey = `${prefix}:${userId}:${req.originalUrl}:${queryHash}`;
            }

            // Attempt to serve from cache
            const cachedData = await cacheService.get(cacheKey);

            if (cachedData) {
                logger.debug(`Cache HIT: ${cacheKey}`);
                res.set('X-Cache', 'HIT');
                res.set('Cache-Control', `private, max-age=${ttl}`);
                return res.status(200).json(cachedData);
            }

            logger.debug(`Cache MISS: ${cacheKey}`);
            res.set('X-Cache', 'MISS');

            // Intercept res.json to capture the response payload
            const originalJson = res.json.bind(res);

            res.json = function (body) {
                // Only cache successful responses (2xx status codes)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // Inject tenant/user specific tags for targeted invalidation
                    const dynamicTags = [...tags];
                    if (req.userId) {
                        dynamicTags.push(`${prefix}:${req.userId}`);
                    }

                    // Fire-and-forget cache set (don't block response)
                    cacheService.setEx(cacheKey, ttl, body, dynamicTags).catch(err => {
                        logger.error('Failed to set cache:', err.message);
                    });
                }

                // Call original res.json to send response to client
                return originalJson(body);
            };

            next();
        } catch (error) {
            // If caching fails, gracefully degrade and continue to controller
            logger.error('Cache middleware error:', error.message);
            next();
        }
    };
}

module.exports = cacheMiddleware;
