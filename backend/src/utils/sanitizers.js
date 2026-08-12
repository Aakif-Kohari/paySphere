/**
 * @fileoverview Deep Sanitization Utilities
 * @description Provides recursive sanitization for JSON payloads to prevent 
 * XSS attacks and NoSQL injection vectors. Uses DOMPurify for HTML stripping 
 * and custom regex for operator injection.
 * 
 * Issue: #727
 */

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// DOMPurify requires a DOM environment, so we use JSDOM to provide one in Node.js
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Configures DOMPurify to allow safe formatting but strip dangerous scripts/events
 */
DOMPurify.setConfig({
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
});

/**
 * Regex to detect MongoDB NoSQL injection operators (e.g., $gt, $ne, $where)
 */
const NOSQL_OPERATOR_REGEX = /^\$[a-zA-Z]+$/;

/**
 * Sanitizes a single string value
 * @param {string} value - The raw string
 * @returns {string} Cleaned string
 */
function sanitizeString(value) {
    if (typeof value !== 'string') return value;

    // Strip XSS vectors using DOMPurify
    let cleaned = DOMPurify.sanitize(value);

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
}

/**
 * Recursively traverses an object/array and sanitizes all string values.
 * Also strips MongoDB NoSQL injection operators from object keys.
 * 
 * @param {any} obj - The object to sanitize
 * @returns {any} The sanitized object
 */
function deepSanitize(obj) {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitize(item));
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
        const sanitizedObj = {};

        for (const [key, value] of Object.entries(obj)) {
            // Prevent NoSQL injection by stripping keys that start with '$'
            if (NOSQL_OPERATOR_REGEX.test(key)) {
                continue; // Drop the malicious key entirely
            }

            // Sanitize the key itself (in case it's a string with XSS)
            const cleanKey = sanitizeString(key);
            sanitizedObj[cleanKey] = deepSanitize(value);
        }

        return sanitizedObj;
    }

    // Return numbers, booleans, dates as-is
    return obj;
}

module.exports = {
    sanitizeString,
    deepSanitize,
};
