/**
 * Data Masking Middleware
 *
 * Wraps `res.json` to replace sensitive PII fields with masked values
 * (e.g. "***-**-6789" or "******6789") for any authenticated user who is not an owner or admin.
 */
'use strict';

const { mask } = require('../services/encryption.service');

const SSN_FIELDS = new Set(['ssn', 'socialSecurityNumber']);
const BANK_AND_ID_FIELDS = new Set([
  'bankAccount',
  'bankAccountNumber',
  'accountNumber',
  'routingNumber',
  'iban',
  'swiftCode',
  'panNumber',
  'taxId',
  'nationalId',
  'nationalInsuranceNumber',
  'aadhaar',
  'aadhaarNumber',
  'passportNumber',
]);

const PRIVILEGED_TYPES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);

function formatMaskedValue(field, rawValue) {
  const str = String(rawValue || '').trim();
  if (!str) return str;

  if (SSN_FIELDS.has(field)) {
    const digitsOnly = str.replace(/\D/g, '');
    const last4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : str.slice(-4);
    return `***-**-${last4}`;
  }

  return mask(str, 4);
}

function maskObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(maskObject);
    return;
  }

  for (const key of Object.keys(obj)) {
    if (SSN_FIELDS.has(key) || BANK_AND_ID_FIELDS.has(key)) {
      if (obj[key] != null) {
        obj[key] = formatMaskedValue(key, obj[key]);
      }
    } else if (obj[key] && typeof obj[key] === 'object') {
      maskObject(obj[key]);
    }
  }
}

/**
 * Express middleware — intercepts `res.json` to mask sensitive fields.
 */
function maskPII(req, res, next) {
  const accountType = (req.accountType || req.user?.accountType || '').toLowerCase();
  const roleName = (req.user?.role?.name || '').toLowerCase();

  if (PRIVILEGED_TYPES.has(accountType) || PRIVILEGED_TYPES.has(roleName)) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = function maskedJson(body) {
    maskObject(body);
    return originalJson(body);
  };
  next();
}

module.exports = { maskPII, maskObject };
