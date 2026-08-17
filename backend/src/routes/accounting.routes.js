const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  getMappings,
  updateMappings,
  generateJournal,
  getTrialBalance,
  exportTallyXml,
  exportCsv,
} = require('../controllers/accounting.controller');

const router = express.Router();

router.get('/mappings', auth, requirePermission('READ_PAYROLL'), getMappings);
router.post('/mappings', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, updateMappings);
router.post('/generate-journal', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, generateJournal);
router.get('/trial-balance', auth, requirePermission('READ_PAYROLL'), getTrialBalance);
router.get('/export/:id/tally', auth, requirePermission('READ_PAYROLL'), exportTallyXml);
router.get('/export/:id/csv', auth, requirePermission('READ_PAYROLL'), exportCsv);

module.exports = router;
