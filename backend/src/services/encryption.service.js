/**
 * Field-Level Encryption Service
 *
 * Implements AES-256-GCM authenticated encryption for sensitive PII fields
 * (bank account numbers, national IDs, etc.) before they are persisted to
 * MongoDB.
 *
 * Encryption format (Base64-encoded, single token):
 *   iv (12 bytes) || authTag (16 bytes) || ciphertext
 *
 * The encryption key is read from the `ENCRYPTION_KEY` environment variable
 * as a 64-character hex string (32 bytes).  A missing or malformed key logs
 * a warning and disables encryption rather than crashing — so development
 * environments without the variable still boot.  Production deployments
 * MUST supply the key; a startup health-check should assert its presence.
 *
 * Compliance: GDPR Article 25, SOC 2 Type II CC6.1.
 */
'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

const ALGORITHM      = 'aes-256-gcm';
const IV_LENGTH      = 12; // 96-bit — GCM recommended
const AUTH_TAG_LEN   = 16; // 128-bit authentication tag

let _key = null;

function _getKey() {
  if (_key) return _key;
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    logger.warn('ENCRYPTION_KEY is not set — field-level encryption is DISABLED');
    return null;
  }
  if (hexKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
  }
  _key = Buffer.from(hexKey, 'hex');
  return _key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param  {string} plaintext
 * @returns {string}  Base64-encoded ciphertext, or the original value when
 *                    encryption is disabled (no key configured).
 */
function encrypt(plaintext) {
  const key = _getKey();
  if (!key) return plaintext;

  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
  const body   = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return Buffer.concat([iv, tag, body]).toString('base64');
}

/**
 * Decrypt a ciphertext produced by `encrypt`.
 *
 * @param  {string} encryptedBase64
 * @returns {string}  Plaintext, or the original value if decryption fails or
 *                    encryption is disabled.
 */
function decrypt(encryptedBase64) {
  const key = _getKey();
  if (!key) return encryptedBase64;

  try {
    const buf        = Buffer.from(encryptedBase64, 'base64');
    const iv         = buf.subarray(0, IV_LENGTH);
    const tag        = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LEN);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LEN);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LEN });
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
  } catch (err) {
    logger.error('Decryption failed — returning raw value', { error: err.message });
    return encryptedBase64;
  }
}

/**
 * Mask a value for display to unprivileged users.
 *
 * @param  {string|number} value
 * @param  {number}        [visibleChars=4]
 * @returns {string}  e.g. "1234567890" → "******7890"
 */
function mask(value, visibleChars = 4) {
  const str = String(value || '');
  if (str.length <= visibleChars) return '****';
  return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars);
}

module.exports = { encrypt, decrypt, mask };
