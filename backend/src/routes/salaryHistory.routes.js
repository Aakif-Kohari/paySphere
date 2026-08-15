const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const {
    getSalaryHistory,
    createSalaryHistoryManual,
    exportSalaryHistory,
    deleteSalaryHistory,
    getSalaryStatistics,
} = require('../controllers/salaryHistory.controller');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');

const router = express.Router();

/**
 * Salary History Routes
 * 
 * Issue: #505
 * 
 * These routes provide simple salary change tracking separate from
 * the more complex SalaryStructure system.
 */

/**
 * GET /api/employees/:id/salary-history-simple
 * 
 * Retrieve salary change history for a specific employee.
 * Requires READ_EMPLOYEE permission.
 */
router.get(
    '/employees/:id/salary-history-simple',
    auth,
    requirePermission('READ_EMPLOYEE'),
    getSalaryHistory
);

/**
 * POST /api/employees/:id/salary-history-simple
 * 
 * Manually create a salary history entry.
 * Requires WRITE_EMPLOYEE permission.
 */
router.post(
    '/employees/:id/salary-history-simple',
    auth,
    requirePermission('WRITE_EMPLOYEE'),
    writeRateLimiter,
    createSalaryHistoryManual
);

/**
 * GET /api/salary-history-simple/export
 * 
 * Export salary history as CSV.
 * Requires READ_EMPLOYEE permission.
 */
router.get(
    '/salary-history-simple/export',
    auth,
    requirePermission('READ_EMPLOYEE'),
    exportSalaryHistory
);

/**
 * DELETE /api/salary-history-simple/:id
 * 
 * Delete a specific salary history entry.
 * Requires WRITE_EMPLOYEE permission.
 */
router.delete(
    '/salary-history-simple/:id',
    auth,
    requirePermission('WRITE_EMPLOYEE'),
    writeRateLimiter,
    deleteSalaryHistory
);

/**
 * GET /api/salary-history-simple/statistics
 * 
 * Get aggregate statistics about salary changes.
 * Requires READ_EMPLOYEE permission.
 */
router.get(
    '/salary-history-simple/statistics',
    auth,
    requirePermission('READ_EMPLOYEE'),
    getSalaryStatistics
);

module.exports = router;
