const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createVendor,
  createInvoice,
  getVendorLedger,
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

module.exports = router;
