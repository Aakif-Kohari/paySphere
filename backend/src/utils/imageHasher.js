const crypto = require('crypto');

/**
 * Calculates a SHA-256 hash for a file buffer to detect duplicate receipt uploads.
 * 
 * @param {Buffer} buffer - File buffer
 * @returns {string} SHA-256 hash string
 */
function calculateImageHash(buffer) {
  if (!buffer) return '';
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = {
  calculateImageHash
};
