const crypto = require('crypto');
const User = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Generate a random Base32 secret for Google Authenticator.
 *
 * @param {number} [length=16] - Length of secret
 * @returns {string} Base32 secret string
 */
function generateBase32Secret(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += alphabet[bytes[i] % alphabet.length];
  }
  return secret;
}

/**
 * Decode a Base32 string to Buffer.
 *
 * @param {string} base32String - Base32 encoded secret
 * @returns {Buffer} Decoded binary buffer
 */
function decodeBase32(base32String) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32String.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error('Invalid Base32 character');
    }
    bits += idx.toString(2).padStart(5, '0');
  }

  const buffer = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const byte = parseInt(bits.substring(i, i + 8), 2);
    buffer.push(byte);
  }
  return Buffer.from(buffer);
}

/**
 * Generates an HOTP token for a buffer and counter value.
 *
 * @param {Buffer} secretBuffer - Secret buffer
 * @param {number} counter - Moving counter
 * @returns {string} 6-digit OTP
 */
function generateHOTP(secretBuffer, counter) {
  const buffer = Buffer.alloc(8);
  // Write counter as 64-bit BigInt Big Endian
  buffer.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
}

/**
 * Verifies a TOTP token against a secret.
 * Supports a window of +-1 time steps (30 seconds each) to accommodate drift.
 *
 * @param {string} token - 6-digit code
 * @param {string} secret - Base32 secret string
 * @returns {boolean} True if token matches
 */
function verifyTOTP(token, secret) {
  if (!token || !secret) return false;
  try {
    const secretBuffer = decodeBase32(secret);
    const timeStep = 30;
    const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

    // Check current, previous, and next window
    for (let i = -1; i <= 1; i++) {
      const generated = generateHOTP(secretBuffer, currentCounter + i);
      if (generated === String(token).trim()) {
        return true;
      }
    }
  } catch (error) {
    logger.error('TOTP verification error', { error: error.message });
  }
  return false;
}

/**
 * GET /api/auth/mfa/setup
 * Generates and returns a pending MFA secret.
 */
async function setupMFA(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const secret = generateBase32Secret(16);
    user.mfaPendingSecret = secret;
    await user.save();

    const label = encodeURIComponent(`PaySphere:${user.email}`);
    const issuer = encodeURIComponent('PaySphere');
    const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;

    res.status(200).json({
      success: true,
      secret,
      otpauthUrl,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/mfa/verify
 * Validates the MFA token and activates MFA on success.
 */
async function verifyMFASetup(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.mfaPendingSecret) {
      return res.status(400).json({ message: 'MFA setup has not been initiated' });
    }

    const isValid = verifyTOTP(token, user.mfaPendingSecret);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = null;
    user.isMfaEnabled = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'MFA activated successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Express middleware to enforce MFA checks on sensitive admin routes.
 * Passes through if MFA is not enabled for the user.
 */
async function requireMFA(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Pass through if the user hasn't set up MFA
    if (!user.isMfaEnabled) {
      return next();
    }

    const token = req.headers['x-paysphere-mfa-token'] || req.query.mfaToken;
    if (!token) {
      return res.status(401).json({ message: 'MFA token required' });
    }

    const isValid = verifyTOTP(token, user.mfaSecret);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid MFA token' });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  setupMFA,
  verifyMFASetup,
  requireMFA,
  generateBase32Secret,
  decodeBase32,
  generateHOTP,
  verifyTOTP,
};
