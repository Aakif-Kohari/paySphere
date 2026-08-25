/**
 * ESPP Routes - Issue #1596
 * Mounted at /api/espp
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  enrollEmployee,
  getEnrollments,
  previewPurchase,
  runBatchPurchase,
  getTransactions,
} = require('../controllers/espp.controller');

const router = Router();

router.get('/enrollments', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getEnrollments);
router.post('/enroll', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, enrollEmployee);
router.post('/preview', auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewPurchase);
router.post('/purchase-run', auth, requirePermission(PERMISSIONS.WRITE_PAYROLL), writeRateLimiter, runBatchPurchase);
router.get('/transactions', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getTransactions);

module.exports = router;