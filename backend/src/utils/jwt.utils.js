/**
 * @fileoverview JWT Utility Functions
 * @description Handles the generation and verification of short-lived access tokens 
 * and long-lived refresh tokens.
 * 
 * Issue: #725
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'default_access_secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';

// Short-lived access token (15 minutes)
const ACCESS_TOKEN_EXPIRY = '15m';
// Long-lived refresh token (7 days)
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generates a short-lived access token
 * @param {Object} payload - User data to encode (e.g., { userId, tenantId, role })
 * @returns {string} Signed JWT
 */
function generateAccessToken(payload) {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'paysphere-api',
    });
}

/**
 * Generates a cryptographically secure random refresh token string
 * @returns {string} 64-character hex string
 */
function generateRefreshTokenString() {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * Verifies an access token
 * @param {string} token - The JWT access token
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, { issuer: 'paysphere-api' });
}

/**
 * Calculates the expiration date for a refresh token
 * @returns {Date} Expiration date (7 days from now)
 */
function getRefreshTokenExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

module.exports = {
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    generateAccessToken,
    generateRefreshTokenString,
    verifyAccessToken,
    getRefreshTokenExpiry,
};
