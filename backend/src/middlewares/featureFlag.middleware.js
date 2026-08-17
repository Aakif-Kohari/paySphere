/**
 * Feature Flag Middleware - Issue #1113
 *
 * requireFeature('VARIANCE_REPORT') checks the tenant plan feature list
 * and returns 402 if the feature is not included.
 *
 * Resolution is cached for 60 seconds per tenant so plan changes
 * take effect quickly without a DB hit on every request.
 * Errors in the check are caught and fail-open (next() is called)
 * so a Redis or DB blip never locks all users out.
 */
'use strict';

const TenantSubscription = require('../models/tenantSubscription.model');
const Plan               = require('../models/plan.model');
const cacheService       = require('../services/cache.service');
const logger             = require('../utils/logger');

const CACHE_TTL_SECONDS = 60;

async function resolveFeatures(tenantId) {
  const cacheKey = 'plan:features:' + tenantId;
  const cached   = await cacheService.get(cacheKey);
  if (cached) return cached;

  const sub = await TenantSubscription.findOne({ tenantId }).lean();
  if (!sub) return [];

  const plan     = await Plan.findOne({ slug: sub.planSlug, isActive: true }).lean();
  const features = (plan && plan.features) || [];

  await cacheService.set(cacheKey, features, CACHE_TTL_SECONDS);
  return features;
}

function requireFeature(featureSlug) {
  return async (req, res, next) => {
    try {
      if (!req.tenantId) return res.status(401).json({ message: 'Authentication required.' });

      const features = await resolveFeatures(String(req.tenantId));

      if (!features.includes(featureSlug)) {
        logger.warn('Feature access denied', { tenantId: req.tenantId, featureSlug });
        return res.status(402).json({
          message:    'This feature is not available on your current plan.',
          feature:    featureSlug,
          upgradeUrl: '/settings/subscription',
        });
      }

      next();
    } catch (err) {
      // Fail-open: never block a request due to a feature-check error.
      logger.error('requireFeature middleware error', { featureSlug, error: err.message });
      next();
    }
  };
}

module.exports = { requireFeature };