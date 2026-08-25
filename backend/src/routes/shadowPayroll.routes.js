const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createAssignment, processShadowPayroll, getAssignments, getAuditData } = require('../controllers/shadowPayroll.controller');

const router = express.Router();

router.post('/assignments', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, createAssignment);
router.get('/assignments', auth, requirePermission('READ_PAYROLL'), getAssignments);

router.post('/process', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processShadowPayroll);
router.get('/audit', auth, requirePermission('READ_PAYROLL'), getAuditData);

module.exports = router;
