/**
 * @fileoverview Refresh Token Schema
 * @description Stores hashed refresh tokens for JWT rotation. Tracks token 
 * family, expiration, and revocation status to prevent token theft and replay attacks.
 * 
 * Issue: #725
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    // Token family tracks the lineage of rotated tokens. 
    // If a reused token is detected, the entire family is revoked.
    family: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: auto-deletes expired tokens
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    }
  },
  { timestamps: true }
);

/**
 * Hashes a raw refresh token string before storage
 * @param {string} token - The raw JWT refresh token
 * @returns {string} SHA-256 hex digest
 */
refreshTokenSchema.statics.hashToken = function (token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
