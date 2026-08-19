const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { getPolicy, updatePolicy, getMyToilData, requestToil, approveRequest, getUpcomingExpirationsByDepartment } = require('../controllers/toil.controller');

const router = express.Router();

router.get('/policy', auth, requirePermission('READ_EMPLOYEE'), getPolicy);
router.post('/policy', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, updatePolicy);

router.get('/my-data', auth, getMyToilData);
router.post('/request', auth, writeRateLimiter, requestToil);
router.patch('/request/:id/approve', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, approveRequest);
router.get('/expirations', auth, requirePermission('READ_EMPLOYEE'), getUpcomingExpirationsByDepartment);

module.exports = router;
