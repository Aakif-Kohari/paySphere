const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    registerEntity, getHierarchy, initiateDeputation, approveDeputation, getConsolidatedReport
} = require('../controllers/entity.controller');

const router = express.Router();

router.post('/register', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, registerEntity);
router.get('/hierarchy', auth, requirePermission('READ_EMPLOYEE'), getHierarchy);

router.post('/deputations', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, initiateDeputation);
router.patch('/deputations/:id/approve', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, approveDeputation);

router.get('/consolidated-report', auth, requirePermission('READ_PAYROLL'), getConsolidatedReport);

module.exports = router;
