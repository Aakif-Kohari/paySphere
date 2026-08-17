const express = require('express');
const {
  previewSettlement,
  initiateExit,
  createSettlement,
  updateSettlement,
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  markSettlementPaid,
  cancelSettlement,
  getSettlements,
  getSettlementById,
} = require('../controllers/settlement.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// An F&F is a payout, so it carries the payroll permissions rather than the
// employee ones. Approving one is the same class of decision as approving a
// payroll run, so where an approval permission exists it is used.
const APPROVE = PERMISSIONS.APPROVE_PAYROLL || PERMISSIONS.WRITE_PAYROLL;

router.get('/', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getSettlements);

// Declared before `/:id` so the literal segment is not captured as an id.
// Preview writes nothing, so an admin can model the number before committing.
router.get(
  '/preview',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  previewSettlement,
);

router.post(
  '/initiate',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  initiateExit,
);

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  createSettlement,
);

router.get(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getSettlementById,
);

router.patch(
  '/:id',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  updateSettlement,
);

router.post(
  '/:id/submit',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  submitSettlement,
);

router.post(
  '/:id/approve',
  auth,
  requirePermission(APPROVE),
  writeRateLimiter,
  approveSettlement,
);

router.post(
  '/:id/reject',
  auth,
  requirePermission(APPROVE),
  writeRateLimiter,
  rejectSettlement,
);

// Marking an F&F paid is the moment the employee actually leaves, so it is
// gated on the approval permission rather than plain write access.
router.post(
  '/:id/mark-paid',
  auth,
  requirePermission(APPROVE),
  writeRateLimiter,
  markSettlementPaid,
);

router.post(
  '/:id/cancel',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  cancelSettlement,
);

module.exports = router;
