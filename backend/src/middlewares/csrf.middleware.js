const crypto = require('crypto');
const logger = require('../utils/logger');

const CSRF_SECRET = process.env.CSRF_SECRET || 'paysphere-csrf-secret-key-2026';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/csrf-token',
  '/api/health',
];

/**
 * Generate HMAC signature for CSRF token
 */
function generateSignature(token) {
  return crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex');
}

/**
 * Mint a fresh Anti-CSRF token
 */
exports.generateCsrfToken = (req, res) => {
  const randomValue = crypto.randomBytes(32).toString('hex');
  const signature = generateSignature(randomValue);
  const token = `${randomValue}.${signature}`;

  // Set XSRF-TOKEN cookie
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Accessible by frontend JS to read & place in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.status(200).json({ csrfToken: token });
};

/**
 * Verify Anti-CSRF Token for state-mutating requests
 */
exports.csrfProtection = (req, res, next) => {
  // Safe HTTP methods pass through
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Public / Exempt paths pass through
  if (EXEMPT_PATHS.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const tokenHeader =
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.headers['csrf-token'] ||
    req.body?._csrf;

  const tokenCookie = req.cookies?.['XSRF-TOKEN'];

  if (!tokenHeader) {
    logger.warn('CSRF validation failed: Missing Anti-CSRF token header', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({
      message: 'Invalid or missing Anti-CSRF token header',
      code: 'EBADCSRFTOKEN',
    });
  }

  // Validate token structure
  const parts = tokenHeader.split('.');
  if (parts.length !== 2) {
    return res.status(403).json({
      message: 'Malformed Anti-CSRF token',
      code: 'EBADCSRFTOKEN',
    });
  }

  const [randomValue, signature] = parts;
  const expectedSignature = generateSignature(randomValue);

  if (signature !== expectedSignature) {
    logger.warn('CSRF validation failed: Signature mismatch', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({
      message: 'Invalid Anti-CSRF token signature',
      code: 'EBADCSRFTOKEN',
    });
  }

  // If cookie exists, verify header matches cookie
  if (tokenCookie && tokenHeader !== tokenCookie) {
    logger.warn('CSRF validation failed: Cookie-header mismatch', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({
      message: 'Anti-CSRF token cookie mismatch',
      code: 'EBADCSRFTOKEN',
    });
  }

  next();
};
