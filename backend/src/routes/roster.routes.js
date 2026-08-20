const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { getConstraints, updateConstraints, triggerAutoGeneration, getCalendar, swapShifts } = require('../controllers/roster.controller');

const router = express.Router();

router.get('/constraints', auth, requirePermission('READ_EMPLOYEE'), getConstraints);
router.post('/constraints', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateConstraints);

router.post('/generate', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, triggerAutoGeneration);
router.get('/calendar', auth, requirePermission('READ_EMPLOYEE'), getCalendar);
router.post('/swap', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, swapShifts);

module.exports = router;
