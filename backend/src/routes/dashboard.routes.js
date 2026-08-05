/**
 * @fileoverview Dashboard Routes
 * @description Defines API endpoints for dashboard metrics, summaries, and customizable layouts.
 * Issue: #519 (Summary), Existing (Layouts)
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { getDashboardSummary } = require('../controllers/dashboard.controller');

const router = express.Router();

// ==========================================
// DASHBOARD LAYOUT ROUTES (Existing)
// ==========================================

const dashboardLayouts = new Map();

function getUserId(req) {
  // Support both req.user.id (common in older setups) and req.userId (from our auth middleware)
  return req.user?.id || req.userId || 'anonymous';
}

router.get('/layout', (req, res) => {
  const userId = getUserId(req);
  const order = dashboardLayouts.get(userId) || [];
  res.json({ order });
});

router.post('/layout', (req, res) => {
  const userId = getUserId(req);
  const { order } = req.body;

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'order must be an array' });
  }

  dashboardLayouts.set(userId, order);
  res.json({ success: true });
});

// ==========================================
// DASHBOARD METRICS ROUTES (Issue #519)
// ==========================================

/**
 * GET /api/dashboard/summary
 * Retrieves comprehensive dashboard metrics with Redis caching.
 * Requires READ_EMPLOYEE or READ_PAYROLL permissions.
 */
router.get(
  '/summary',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getDashboardSummary
);

module.exports = router;