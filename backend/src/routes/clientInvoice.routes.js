const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createInvoice,
  recordPayment,
  getDashboard,
  getAgingReport,
} = require('../controllers/clientInvoice.controller');

const router = express.Router();

router.post(
  '/invoices',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INVOICE),
  writeRateLimiter,
  createInvoice,
);
router.post(
  '/invoices/:id/payment',
  auth,
  requirePermission(PERMISSIONS.MANAGE_INVOICE),
  writeRateLimiter,
  recordPayment,
);
router.get(
  '/invoices/dashboard',
  auth,
  requirePermission(PERMISSIONS.READ_INVOICE),
  getDashboard,
);
router.get(
  '/invoices/aging-report',
  auth,
  requirePermission(PERMISSIONS.READ_INVOICE),
  getAgingReport,
);

module.exports = router;
