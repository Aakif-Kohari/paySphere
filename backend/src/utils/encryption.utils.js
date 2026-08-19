/**
 * @fileoverview Encryption Utilities
 * @description Provides AES-256-GCM encryption and decryption for sensitive 
 * whistleblower reports to ensure data privacy at rest.
 * Issue: #1207
 */
const crypto = require('crypto');

// In production, this MUST be loaded from a secure environment variable or KMS.
// For this implementation, we use a static key for architectural demonstration.
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.GRIEVANCE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} text - The plaintext to encrypt
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32); // Ensure 32 bytes

    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * @param {string} encrypted - The hex-encoded ciphertext
 * @param {string} iv - The hex-encoded initialization vector
 * @param {string} authTag - The hex-encoded authentication tag
 * @returns {string} The decrypted plaintext
 */
function decrypt(encrypted, iv, authTag) {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Generates a secure, URL-safe tracking token for anonymous reporters.
 * @returns {string} 32-character hex token
 */
function generateTrackingToken() {
    return crypto.randomBytes(16).toString('hex');
}

module.exports = { encrypt, decrypt, generateTrackingToken };
