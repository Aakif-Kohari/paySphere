'use strict';
const crypto = require('crypto');
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

function getFingerprint(req) {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const accept = req.headers['accept'] || '';
  const raw = `${userAgent}|${acceptLanguage}|${accept}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function verifyFingerprint(req, res, next) {
  try {
    if (!req.userId) return next();

    const fingerprint = getFingerprint(req);
    const cacheKey = `sess:fp:${req.userId}`;

    const storedFp = await cacheService.get(cacheKey);
    if (!storedFp) {
      await cacheService.set(cacheKey, fingerprint, 3600);
    } else if (storedFp !== fingerprint) {
      logger.warn('Session fingerprint mismatch detected - potential hijacking attempt', {
        userId: req.userId,
        stored: storedFp,
        incoming: fingerprint,
      });
      return res.status(401).json({ message: 'Session invalid/expired due to device change.' });
    }
    next();
  } catch (err) {
    logger.error('Session fingerprint verification error', { error: err.message });
    next();
  }
}

module.exports = verifyFingerprint;