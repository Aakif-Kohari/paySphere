/**
 * @fileoverview Global Input Sanitization Middleware
 * @description Intercepts all incoming Express requests and deeply sanitizes 
 * `req.body`, `req.query`, and `req.params` to prevent XSS and NoSQL injection.
 * 
 * Issue: #727
 */

const { deepSanitize } = require('../utils/sanitizers');
const logger = require('../utils/logger');

/**
 * List of routes/paths to skip sanitization (e.g., file uploads, raw HTML editors)
 */
const EXCLUDED_PATHS = [
    '/api/reports/custom', // Custom report builder might need raw queries
    '/api/employees/import', // CSV parsing handles its own sanitization
];

/**
 * Express middleware to sanitize request payloads
 */
function sanitizeMiddleware(req, res, next) {
    try {
        // Skip if path is excluded
        if (EXCLUDED_PATHS.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Sanitize Body (POST/PUT/PATCH)
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            req.body = deepSanitize(req.body);
        }

        // Sanitize Query Parameters (GET)
        if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
            req.query = deepSanitize(req.query);
        }

        // Sanitize URL Parameters
        if (req.params && typeof req.params === 'object' && Object.keys(req.params).length > 0) {
            req.params = deepSanitize(req.params);
        }

        next();
    } catch (error) {
        logger.error('Sanitization middleware failed:', error.message);
        // If sanitization crashes, fail closed (block request)
        res.status(400).json({ message: 'Invalid request payload format' });
    }
}

module.exports = sanitizeMiddleware;
