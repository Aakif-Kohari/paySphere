/**
 * Data Masking Middleware
 *
 * Wraps `res.json` to replace sensitive PII fields with masked values
 * (e.g. "****6789") for any authenticated user who is not an owner or admin.
 *
 * Attach to any route that returns employee data:
 *   router.get('/:id', verifyToken, maskPII, getEmployee);
 */
'use strict';

const { mask } = require('../services/encryption.service');

const SENSITIVE_FIELDS = ['bankAccount', 'panNumber', 'taxId', 'nationalId'];
const PRIVILEGED_TYPES = new Set(['owner', 'admin']);

function maskObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { obj.forEach(maskObject); return; }
  for (const field of SENSITIVE_FIELDS) {
    if (obj[field] != null) obj[field] = mask(String(obj[field]));
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') maskObject(val);
  }
}

/**
 * Express middleware — intercepts `res.json` to mask sensitive fields.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function maskPII(req, res, next) {
  const accountType = (req.user?.accountType || '').toLowerCase();
  if (PRIVILEGED_TYPES.has(accountType)) return next();

  const originalJson = res.json.bind(res);
  res.json = function maskedJson(body) {
    maskObject(body);
    return originalJson(body);
  };
  next();
}

module.exports = { maskPII };
