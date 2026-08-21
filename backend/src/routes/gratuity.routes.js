const express = require('express');

const {
  getAssumptions,
  updateAssumptions,
  previewValuation,
  commitValuation,
  listValuations,
  getValuation,
  getEmployeeObligation,
} = require('../controllers/gratuity.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// --- Actuarial assumptions (#1344) -----------------------------------------
//
// Reading the assumptions is part of reading a valuation, so it carries the
// read permission. Changing them is not: the discount rate decides the reported
// provision, and moving it 50 basis points moves the balance sheet. That is a
// judgement made with the auditor, which is why it has its own permission and
// stays with the owner — the same reasoning as MANAGE_COMPLIANCE.

router.get(
  '/assumptions',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_VALUATION),
  getAssumptions,
);

router.put(
  '/assumptions',
  auth,
  requirePermission(PERMISSIONS.MANAGE_GRATUITY_ASSUMPTIONS),
  writeRateLimiter,
  updateAssumptions,
);

// --- Running a valuation ---------------------------------------------------

// A preview writes nothing, and finance runs several before settling on one.
// Gated as a read for that reason — being able to model the provision is not
// the same authority as committing to a reported figure.
//
// POST rather than GET despite writing nothing: the assumption overrides are a
// nested object, and threading seven rates through a query string would be
// unparseable at both ends.
router.post(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_VALUATION),
  previewValuation,
);

// Committing is the write. It produces the number that goes into the accounts
// and, from next year's perspective, the opening balance every subsequent
// roll-forward starts from.
router.post(
  '/valuations',
  auth,
  requirePermission(PERMISSIONS.RUN_GRATUITY_VALUATION),
  writeRateLimiter,
  commitValuation,
);

router.get(
  '/valuations',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_VALUATION),
  listValuations,
);

router.get(
  '/valuations/:id',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_VALUATION),
  getValuation,
);

// --- One employee's share --------------------------------------------------
//
// Declared last so `/valuations` and `/assumptions` are matched as the literal
// segments they are, rather than being captured by a parameter.
router.get(
  '/employees/:employeeId',
  auth,
  requirePermission(PERMISSIONS.READ_GRATUITY_VALUATION),
  getEmployeeObligation,
);

module.exports = router;
