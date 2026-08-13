'use strict';
const Policy = require('../models/policy.model');
const cacheService = require('./cache.service');
// `../utils/logger`, not `./logger`: there is no services/logger.js, so
// requiring this module threw MODULE_NOT_FOUND and the row-level-security
// policy engine could never load — the same one-character mistake that kept
// notificationDispatcher.service.js from ever running (#952).
const logger = require('../utils/logger');
const CACHE_TTL = 60;
function interpolate(value, user) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{user\.(\w+)\}\}/g, (_, f) => (user && user[f] !== undefined) ? user[f] : null);
}
function conditionToFilter({ field, op, value }, user) {
  const v = interpolate(value, user);
  if (op === 'eq')         return { [field]: v };
  if (op === 'ne')         return { [field]: { $ne: v } };
  if (op === 'in')         return { [field]: { $in: Array.isArray(v) ? v : [v] } };
  if (op === 'startsWith') return { [field]: { $regex: '^' + v, $options: 'i' } };
  if (op === 'createdBy')  return { createdBy: user && user._id };
  logger.warn('PolicyService: unknown op', { op }); return null;
}
async function fetchPolicies(tenantId, resource, action) {
  const key = 'policies:' + tenantId + ':' + resource + ':' + action;
  const cached = await cacheService.get(key);
  if (cached) return cached;
  const policies = await Policy.find({ tenantId, resource, isActive: true, action: { $in: [action, '*'] } }).lean();
  // `setEx(key, ttl, value)`. There is no `set` on the cache service, and the
  // argument order is not the one this call assumed either (#952).
  await cacheService.setEx(key, CACHE_TTL, policies);
  return policies;
}
async function buildQuery(resource, action, req) {
  const { tenantId, user, accountType } = req;
  if (!tenantId) return {};
  try {
    const policies = await fetchPolicies(String(tenantId), resource, action);
    const applicable = policies.filter(p => !p.roles || !p.roles.length || p.roles.includes(accountType) || p.roles.includes(user && user.role));
    if (!applicable.length) return {};
    const clauses = applicable.map(p => conditionToFilter(p.condition, user)).filter(Boolean);
    if (!clauses.length) return {};
    if (clauses.length === 1) return clauses[0];
    return { $or: clauses };
  } catch (err) {
    logger.error('PolicyService.buildQuery error', { error: err.message });
    return {};
  }
}
async function canAccessDocument(resource, action, req, document) {
  const filter = await buildQuery(resource, action, req);
  if (!Object.keys(filter).length) return true;
  for (const [key, val] of Object.entries(filter)) {
    if (key === '$or') {
      if (!val.some(c => Object.entries(c).every(([k,v]) => String(document[k]) === String(v)))) return false;
    } else if (String(document[key]) !== String(val)) { return false; }
  }
  return true;
}
module.exports = { buildQuery, canAccessDocument };