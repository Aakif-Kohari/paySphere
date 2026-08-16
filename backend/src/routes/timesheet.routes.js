const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { startTimer, stopTimer, approveEntry } = require('../controllers/timesheet.controller');

const router = express.Router();

// Contractor endpoints (Assuming a vendor-auth middleware or mapping userId to contractorId)
router.post('/start', auth, writeRateLimiter, startTimer);
router.post('/stop', auth, writeRateLimiter, stopTimer);

// Manager/Admin approval endpoints
router.patch('/:id/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, approveEntry);

module.exports = router;
