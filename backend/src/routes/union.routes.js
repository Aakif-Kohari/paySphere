const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createCBA, addTier, calculateDuesBatch, fileGrievance, checkSLABreaches, getAdminDashboard } = require('../controllers/union.controller');

const router = express.Router();

router.post('/cba', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createCBA);
router.post('/tiers', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, addTier);
router.post('/calculate-dues', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, calculateDuesBatch);

router.post('/grievances', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, fileGrievance);
router.get('/sla-check', auth, requirePermission('READ_EMPLOYEE'), checkSLABreaches);

router.get('/dashboard', auth, requirePermission('READ_EMPLOYEE'), getAdminDashboard);

module.exports = router;
