const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createPlan, recordRevenue, issueDrawAdvance, processClawback, getMyDashboard } = require('../controllers/commission.controller');

const router = express.Router();

router.post('/plans', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createPlan);
router.post('/revenue', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, recordRevenue);
router.post('/draw', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, issueDrawAdvance);
router.post('/clawback', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processClawback);

router.get('/my-dashboard', auth, getMyDashboard);

module.exports = router;
