'use strict';
const { buildQuery } = require('../services/policy.service');
const logger = require('../utils/logger');

/**
 * Row-Level Security middleware factory.
 * Calls PolicyService.buildQuery and attaches req.rlsFilter.
 * Controllers merge: { ...tenantFilter(req), ...(req.rlsFilter || {}) }
 * Issue: #914
 */
function rls(resource, action) {
  return async (req, res, next) => {
    try {
      req.rlsFilter = await buildQuery(resource, action, req);
    } catch (err) {
      logger.error('RLS middleware error', { resource, action, error: err.message });
      req.rlsFilter = {};
    }
    next();
  };
}
module.exports = { rls };