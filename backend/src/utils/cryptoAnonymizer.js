/**
 * @fileoverview Cryptographic Anonymizer for POSH Compliance
 * @description Implements AES-256-GCM encryption for sensitive grievance data at rest.
 * Keys are derived from environment variables and ICC member PINs.
 * Issue: #958
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// In production, this should be fetched from a secure KMS or env var
const MASTER_KEY = process.env.POSH_MASTER_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} text - The sensitive data to encrypt
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(MASTER_KEY, 'hex'), iv);

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
 * Decrypts ciphertext using AES-256-GCM.
 * @param {string} encrypted - The hex-encoded ciphertext
 * @param {string} iv - The hex-encoded initialization vector
 * @param {string} authTag - The hex-encoded authentication tag
 * @returns {string} The decrypted plaintext
 */
function decrypt(encrypted, iv, authTag) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(MASTER_KEY, 'hex'),
        Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Generates a unique, sequential case number for the current year.
 * @param {number} currentCount - The number of cases filed this year
 * @returns {string} e.g., "POSH-2026-004"
 */
function generateCaseNumber(currentCount) {
    const year = new Date().getFullYear();
    const seq = String(currentCount + 1).padStart(3, '0');
    return `POSH-${year}-${seq}`;
}

module.exports = { encrypt, decrypt, generateCaseNumber };
