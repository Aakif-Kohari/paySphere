const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createCycle, upsertGoals, submitSelfReview, submitManagerReview, getMyReview
} = require('../controllers/appraisal.controller');

const router = express.Router();

router.post('/cycles', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createCycle);
router.post('/goals', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, upsertGoals);
router.get('/my-review', auth, requirePermission('READ_EMPLOYEE'), getMyReview);

router.patch('/reviews/:id/self-review', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitSelfReview);
router.patch('/reviews/:id/manager-review', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitManagerReview);

module.exports = router;
