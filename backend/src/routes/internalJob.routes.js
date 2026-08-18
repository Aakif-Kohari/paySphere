const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { postJob, getOpenJobs, applyToJob, getPipeline, updateApplicationStatus } = require('../controllers/internalJob.controller');

const router = express.Router();

router.post('/', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, postJob);
router.get('/open', auth, getOpenJobs);
router.post('/:jobId/apply', auth, writeRateLimiter, applyToJob);

router.get('/:jobId/pipeline', auth, requirePermission('WRITE_EMPLOYEE'), getPipeline);
router.patch('/applications/:id/status', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, updateApplicationStatus);

module.exports = router;
