/**
 * Subscription Controller - Issue #1113
 *
 * GET /api/tenant/subscription  - current plan, usage, and features
 */
'use strict';

const TenantSubscription = require('../models/tenantSubscription.model');
const Plan               = require('../models/plan.model');
const logger             = require('../utils/logger');

async function getSubscription(req, res) {
  try {
    let sub = await TenantSubscription.findOne({ tenantId: req.tenantId }).lean();

    // Auto-create a basic trial on first access - no config step needed for new tenants.
    if (!sub) {
      sub = await TenantSubscription.create({ tenantId: req.tenantId, planSlug: 'basic', status: 'trialing' });
    }

    const plan = await Plan.findOne({ slug: sub.planSlug }).lean();

    return res.json({
      plan:             sub.planSlug,
      status:           sub.status,
      features:         (plan && plan.features) || [],
      limits:           (plan && plan.limits)   || {},
      usage:            sub.usage,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  } catch (err) {
    logger.error('getSubscription error', { error: err.message });
    return res.status(500).json({ message: 'Could not fetch subscription details.' });
  }
}

module.exports = { getSubscription };