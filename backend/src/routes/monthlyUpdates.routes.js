/**
 * @fileoverview Monthly Updates Routes
 * @description Defines API endpoints for managing monthly employee activity updates.
 * Issue: #509
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    createOrUpdateMonthlyUpdate,
    getEmployeeMonthlyUpdates,
    deleteMonthlyUpdate
} = require('../controllers/monthlyUpdates.controller');

const router = express.Router();

/**
 * POST /api/monthly-updates
 * Create or update a monthly activity record.
 */
router.post(
    '/',
    auth,
    requirePermission('WRITE_EMPLOYEE'),
    writeRateLimiter,
    createOrUpdateMonthlyUpdate
);

/**
 * GET /api/monthly-updates/:employeeId
 * Retrieve all monthly updates for a specific employee.
 */
router.get(
    '/:employeeId',
    auth,
    requirePermission('READ_EMPLOYEE'),
    getEmployeeMonthlyUpdates
);

/**
 * DELETE /api/monthly-updates/:id
 * Delete a specific monthly update record.
 */
router.delete(
    '/:id',
    auth,
    requirePermission('WRITE_EMPLOYEE'),
    writeRateLimiter,
    deleteMonthlyUpdate
);

module.exports = router;
