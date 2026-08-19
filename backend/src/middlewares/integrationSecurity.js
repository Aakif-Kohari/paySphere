const crypto = require('crypto');
const IntegrationConfig = require('../models/integrationConfig.model');
const { decrypt } = require('../services/encryption.service');
const { redisClient } = require('../services/cache.service');
const logger = require('../utils/logger');

/**
 * Pure JS IPv4 CIDR range checker.
 * Checks whether client IP lies within a CIDR subnet or matches a static IP.
 *
 * @param {string} ip - IPv4 address (e.g. "127.0.0.1")
 * @param {string} cidr - CIDR range or static IP (e.g. "127.0.0.1/24" or "10.0.0.1")
 * @returns {boolean} True if client IP matches range
 */
function ipInCidr(ip, cidr) {
  if (!cidr || !ip) return false;
  const targetCidr = cidr.trim();
  if (!targetCidr.includes('/')) {
    return ip === targetCidr;
  }
  const [range, bitsStr] = targetCidr.split('/');
  const bits = parseInt(bitsStr, 10);
  
  const ipParts = ip.split('.').map(Number);
  const rangeParts = range.split('.').map(Number);
  
  if (ipParts.length !== 4 || rangeParts.length !== 4 || isNaN(bits)) {
    return false; // IPv4 only
  }
  
  const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
  const rangeInt = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
  
  const mask = bits === 0 ? 0 : (~0 << (32 - bits));
  return (ipInt & mask) === (rangeInt & mask);
}

// Memory fallback to support offline Redis environments
const memoryRateLimits = new Map();

/**
 * Sliding Window Rate Limiter
 * Limits incoming integration synchronization calls to 5 requests per minute per tenant.
 *
 * @param {string} tenantId - Tenant UUID/ObjectID
 * @returns {Promise<boolean>} True if rate limit is within limits, false if exceeded
 */
async function checkRateLimit(tenantId) {
  const limit = 5;
  const windowMs = 60000;
  const now = Date.now();
  const key = `integration:rate_limit:${tenantId}`;

  if (redisClient && redisClient.isOpen) {
    try {
      const minScore = now - windowMs;
      const transaction = redisClient.multi();
      
      transaction.zRemRangeByScore(key, 0, minScore);
      transaction.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      transaction.zCard(key);
      transaction.expire(key, 60);

      const results = await transaction.exec();
      const count = results[2]; // ZCARD count result
      if (count > limit) {
        return false;
      }
      return true;
    } catch (err) {
      logger.warn('Redis rate limit check failed. Falling back to memory.', { error: err.message });
    }
  }

  // Fallback to local memory sliding window
  if (!memoryRateLimits.has(tenantId)) {
    memoryRateLimits.set(tenantId, []);
  }
  let timestamps = memoryRateLimits.get(tenantId);
  timestamps = timestamps.filter(ts => now - ts < windowMs);
  
  if (timestamps.length >= limit) {
    memoryRateLimits.set(tenantId, timestamps);
    return false;
  }
  
  timestamps.push(now);
  memoryRateLimits.set(tenantId, timestamps);
  return true;
}

/**
 * Express middleware performing signature, rate-limit, and IP check validations
 * for public integration routes.
 */
async function integrationSecurity(req, res, next) {
  try {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    const provider = req.params.provider || req.headers['x-provider'] || req.query.provider;

    if (!tenantId || !provider) {
      return res.status(401).json({ message: 'Missing tenant or provider identifier' });
    }

    // 1. Fetch integration configurations
    const config = await IntegrationConfig.findOne({
      tenantId,
      provider: String(provider).toLowerCase()
    });

    if (!config) {
      return res.status(401).json({ message: 'Integration configuration not found' });
    }

    if (!config.isActive) {
      return res.status(401).json({ message: 'Integration is inactive' });
    }

    // 2. IP CIDR filtering
    let clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.substring(7);
    }
    if (clientIp === '::1') {
      clientIp = '127.0.0.1';
    }

    const allowedIps = [];
    if (config.allowedIpRanges && Array.isArray(config.allowedIpRanges)) {
      allowedIps.push(...config.allowedIpRanges);
    }
    if (config.credentials && Array.isArray(config.credentials.allowedIpRanges)) {
      allowedIps.push(...config.credentials.allowedIpRanges);
    }
    if (process.env.ALLOWED_INTEGRATION_IPS) {
      allowedIps.push(...process.env.ALLOWED_INTEGRATION_IPS.split(','));
    }

    if (allowedIps.length > 0) {
      const isAllowed = allowedIps.some(range => ipInCidr(clientIp, range));
      if (!isAllowed) {
        logger.warn(`Blocked request from disallowed IP address: ${clientIp}`);
        return res.status(403).json({ message: 'Forbidden: IP address not allowed' });
      }
    }

    // 3. Signature verification
    const signature = req.headers['x-integration-signature'];
    if (!signature) {
      return res.status(401).json({ message: 'Signature missing' });
    }

    const encryptedSecret = config.credentials.clientSecret || config.credentials.apiKey || config.credentials.webhookSecret;
    if (!encryptedSecret) {
      return res.status(401).json({ message: 'Integration credentials secret not configured' });
    }

    const secret = decrypt(encryptedSecret);
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // 4. Sliding window rate limit check
    const rateLimitPassed = await checkRateLimit(tenantId);
    if (!rateLimitPassed) {
      return res.status(429).json({ message: 'Too Many Requests' });
    }

    // Attach validated values to request object
    req.tenantId = tenantId;
    req.provider = provider;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  integrationSecurity,
  ipInCidr,
  checkRateLimit,
  memoryRateLimits,
};
