const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createVendor,
  createInvoice,
  getVendorLedger,
  getForm16ASummary,
} = require('../controllers/vendor.controller');

const router = express.Router();

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.MANAGE_VENDOR),
  writeRateLimiter,
  createVendor,
);
router.post(
  '/:id/invoices',
  auth,
  requirePermission(PERMISSIONS.MANAGE_VENDOR),
  writeRateLimiter,
  createInvoice,
);
router.get(
  '/:id/ledger',
  auth,
  requirePermission(PERMISSIONS.READ_VENDOR),
  getVendorLedger,
);
router.get(
  '/:id/form-16a',
  auth,
  requirePermission(PERMISSIONS.READ_VENDOR),
  getForm16ASummary,
);

module.exports = router;
