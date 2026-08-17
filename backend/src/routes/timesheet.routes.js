const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  startTimer,
  stopTimer,
  approveEntry,
  getTimesheetSummary,
  generateInvoiceFromTimesheets,
} = require('../controllers/timesheet.controller');

const router = express.Router();

// Contractor timer endpoints
router.post('/start', auth, writeRateLimiter, startTimer);
router.post('/stop', auth, writeRateLimiter, stopTimer);

// Summaries & Invoicing
router.get('/summary', auth, requirePermission('READ_PAYROLL'), getTimesheetSummary);
router.post('/generate-invoice', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateInvoiceFromTimesheets);

// Manager/Admin approval endpoints
router.patch('/:id/approve', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, approveEntry);

module.exports = router;
