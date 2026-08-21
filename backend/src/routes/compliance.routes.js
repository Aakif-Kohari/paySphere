/**
 * Statutory compliance routes (#933, mounted in #951).
 *
 * There was no routes file for this feature at all. `compliance.controller.js`
 * had been in the tree since #933 with no URL pointing at it, which is why
 * nobody discovered that neither model it requires had been committed.
 *
 * Gated on its own permissions rather than on READ_REPORT. A Form 16 is one
 * person's complete tax position for a year, and a Form 24Q export is every
 * employee's PAN, salary and tax in a single downloadable file — that is a
 * heavier read than "view analytics", and READ_REPORT is held by every role in
 * the product including Employee. Writing the company's TAN, or marking a
 * declaration verified, is heavier still: a return is filed against it.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  generateForm16,
  generateForm24Q,
  getComplianceConfig,
  upsertComplianceConfig,
  getTaxDeclarations,
  upsertTaxDeclaration,
} = require('../controllers/compliance.controller');

const router = express.Router();

// --- Employer details -----------------------------------------------------
//
// Declared before the report routes so `/config` is matched as the literal it
// is, following the ordering convention the rest of the routers use.

router.get(
  '/config',
  auth,
  requirePermission(PERMISSIONS.READ_COMPLIANCE),
  getComplianceConfig,
);

router.put(
  '/config',
  auth,
  requirePermission(PERMISSIONS.MANAGE_COMPLIANCE),
  writeRateLimiter,
  upsertComplianceConfig,
);

// --- Employee declarations ------------------------------------------------

router.get(
  '/declarations',
  auth,
  requirePermission(PERMISSIONS.READ_COMPLIANCE),
  getTaxDeclarations,
);

router.put(
  '/declarations/:employeeId',
  auth,
  requirePermission(PERMISSIONS.MANAGE_COMPLIANCE),
  writeRateLimiter,
  upsertTaxDeclaration,
);

// --- Statutory reports ----------------------------------------------------

router.get(
  '/form-16/:employeeId',
  auth,
  requirePermission(PERMISSIONS.READ_COMPLIANCE),
  generateForm16,
);

router.get(
  '/form-24q',
  auth,
  requirePermission(PERMISSIONS.READ_COMPLIANCE),
  generateForm24Q,
);

module.exports = router;
