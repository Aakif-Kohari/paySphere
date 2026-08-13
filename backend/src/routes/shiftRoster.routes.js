const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createTemplate,
    getRoster,
    assignShift,
    requestSwap,
    approveSwap,
} = require('../controllers/shiftRoster.controller');

const router = express.Router();

router.post('/templates', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createTemplate);
router.get('/roster', auth, requirePermission('READ_EMPLOYEE'), getRoster);
router.post('/roster', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, assignShift);

// Swap Workflows
router.post('/swap/request', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, requestSwap);
router.post('/swap/:id/approve', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, approveSwap);

module.exports = router;
