const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createObjective, logCheckIn, getMyOkrs, getCompanyTree } = require('../controllers/okr.controller');

const router = express.Router();

router.post('/', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createObjective);
router.post('/check-in', auth, writeRateLimiter, logCheckIn);
router.get('/my', auth, getMyOkrs);
router.get('/tree', auth, requirePermission('READ_EMPLOYEE'), getCompanyTree);

module.exports = router;
