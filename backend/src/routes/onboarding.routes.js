const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createPlan, getPlans, triggerOnboarding, getMyTasks, updateTaskStatus, uploadDocument
} = require('../controllers/onboarding.controller');

const router = express.Router();

router.post('/plans', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createPlan);
router.get('/plans', auth, requirePermission('READ_EMPLOYEE'), getPlans);
router.post('/trigger', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, triggerOnboarding);

router.get('/my-tasks', auth, getMyTasks);
router.patch('/tasks/:id/status', auth, writeRateLimiter, updateTaskStatus);
router.post('/documents', auth, writeRateLimiter, uploadDocument);

module.exports = router;
