const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
    upsertJurisdiction, saveTaxRules, getJurisdictions, getRemoteWorkerReport,
    syncTaxSlabs, getSyncLogs
} = require('../controllers/regionalTax.controller');

const router = express.Router();

router.post('/jurisdictions', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, upsertJurisdiction);
router.get('/jurisdictions', auth, requirePermission('READ_PAYROLL'), getJurisdictions);

router.post('/rules', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, saveTaxRules);

router.get('/report/remote-workers', auth, requirePermission('READ_PAYROLL'), getRemoteWorkerReport);

router.post('/sync', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, syncTaxSlabs);
router.get('/sync-logs', auth, requirePermission('READ_PAYROLL'), getSyncLogs);

module.exports = router;
