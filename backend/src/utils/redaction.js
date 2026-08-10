const mongoose = require('mongoose');

const SENSITIVE_KEYS = new Set([
  'ssn',
  'salary',
  'basesalary',
  'netsalary',
  'monthlysalary',
  'proratedsalary',
  'previoussalary',
  'newsalary',
  'salarychange',
  'pan',
  'bankaccount',
  'bankaccountnumber',
  'ifsc',
  'phone',
  'email',
]);

function maskValue(key, value) {
  if (value === null || value === undefined) return value;
  
  const str = String(value).trim();
  if (str === "") return str;

  if (key === 'email') {
    const parts = str.split('@');
    if (parts.length === 2) {
      const local = parts[0];
      const domain = parts[1];
      if (local.length <= 2) {
        return `${local.substring(0, 1)}*@${domain}`;
      }
      return `${local.substring(0, 2)}***@${domain}`;
    }
    return '***@***.***';
  }

  if (key === 'phone') {
    if (str.length <= 4) return '****';
    return '*'.repeat(str.length - 4) + str.slice(-4);
  }

  if (key.includes('salary') || key.includes('change')) {
    return '[REDACTED]';
  }

  if (str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

function redact(val) {
  if (val === null || val === undefined) return val;

  // Handle Mongoose/MongoDB query objects or schemas to avoid deep infinite loops
  if (val instanceof mongoose.Query || typeof val.then === 'function') {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map(redact);
  }

  if (val instanceof Date) {
    return val;
  }

  if (typeof val === 'object') {
    // If it's a Mongoose document, convert to plain object
    let rawObj = val;
    if (typeof val.toObject === 'function') {
      try {
        rawObj = val.toObject();
      } catch {
        rawObj = val;
      }
    } else if (val.constructor && val.constructor.name === 'ObjectID') {
      return val;
    }

    const result = {};
    for (const [key, value] of Object.entries(rawObj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        result[key] = maskValue(lowerKey, value);
      } else {
        result[key] = redact(value);
      }
    }
    return result;
  }

  return val;
}

module.exports = {
  redact,
  maskValue,
  SENSITIVE_KEYS,
};
