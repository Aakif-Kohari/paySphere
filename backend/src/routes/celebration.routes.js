/**
 * @fileoverview Celebration Routes
 * @description Defines API routes for fetching and interacting with celebration events.
 * Issue: #1286
 */
const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const {
    getTodaysCelebrations,
    getUpcomingCelebrations,
    reactToCelebration,
    triggerManual
} = require('../controllers/celebration.controller');

const router = express.Router();

// Public routes for authenticated employees
router.get('/today', auth, getTodaysCelebrations);
router.get('/upcoming', auth, getUpcomingCelebrations);
router.post('/:id/react', auth, writeRateLimiter, reactToCelebration);

// Admin only route for manual triggering
router.post('/trigger-manual', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, triggerManual);

module.exports = router;
