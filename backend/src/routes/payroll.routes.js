const express = require('express');
const {
  finalizePayroll,
  parsePayrollCSV,
  getPayrollSummary,
  exportPayrollCSV,
  sendPayslipEmailHandler,
  sendAllPayslipsEmailHandler,
} = require('../controllers/payroll.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const upload = require('../middlewares/upload.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const router = express.Router();

router.post(
  '/parse-csv',
  auth,
  requirePermission('WRITE_PAYROLL'),
  writeRateLimiter,
  upload.single('file'),
  parsePayrollCSV,
);
router.post('/finalize', auth, writeRateLimiter, finalizePayroll);
router.get('/summary', auth, getPayrollSummary);
router.get('/export-csv', auth, exportPayrollCSV);
router.post('/send-email/:id', auth, writeRateLimiter, sendPayslipEmailHandler);
router.post(
  '/send-all-emails',
  auth,
  writeRateLimiter,
  sendAllPayslipsEmailHandler,
);

module.exports = router;
