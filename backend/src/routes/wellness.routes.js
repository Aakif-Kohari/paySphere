const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createChallenge, createTeam, logActivity, getLeaderboard, processPayrollInjection } = require('../controllers/wellness.controller');

const router = express.Router();

router.post('/challenges', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createChallenge);
router.post('/teams', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createTeam);
router.post('/activity', auth, writeRateLimiter, logActivity);
router.get('/leaderboard/:challengeId', auth, getLeaderboard);
router.post('/payroll-inject/:challengeId', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, processPayrollInjection);

module.exports = router;
