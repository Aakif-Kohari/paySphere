/**
 * @fileoverview HTTP Request Logger Middleware
 * @description Logs incoming HTTP requests and outgoing responses using Winston.
 * Replaces the standard Morgan middleware to ensure all logs go through the 
 * centralized structured logging pipeline.
 * 
 * Issue: #723
 */

const logger = require('../utils/logger');

/**
 * Express middleware to log HTTP requests and responses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestLogger(req, res, next) {
    const start = process.hrtime.bigint();

    // Extract useful metadata
    const meta = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.userId || null,
        tenantId: req.tenantId || null,
    };

    // Hook into the response finish event
    res.on('finish', () => {
        const durationNs = Number(process.hrtime.bigint() - start);
        const durationMs = Math.round(durationNs / 1e6);

        const logData = {
            ...meta,
            statusCode: res.statusCode,
            durationMs,
            contentLength: res.get('content-length') || 0,
        };

        // Determine log level based on status code
        if (res.statusCode >= 500) {
            logger.error('HTTP Server Error', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('HTTP Client Error', logData);
        } else {
            logger.info('HTTP Request', logData);
        }
    });

    next();
}

module.exports = requestLogger;
