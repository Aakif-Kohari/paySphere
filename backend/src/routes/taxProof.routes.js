const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  submitProof,
  getMyProofs,
  getVerificationQueue,
  verifyProof,
} = require('../controllers/taxProof.controller');

const router = express.Router();

// Employee endpoints
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TAX_PROOF),
  writeRateLimiter,
  submitProof,
);
router.get(
  '/my-proofs',
  auth,
  requirePermission(PERMISSIONS.SUBMIT_TAX_PROOF),
  getMyProofs,
);

// HR/Admin endpoints
router.get(
  '/queue',
  auth,
  requirePermission(PERMISSIONS.VERIFY_TAX_PROOF),
  getVerificationQueue,
);
router.patch(
  '/:id/verify',
  auth,
  requirePermission(PERMISSIONS.VERIFY_TAX_PROOF),
  writeRateLimiter,
  verifyProof,
);

module.exports = router;
