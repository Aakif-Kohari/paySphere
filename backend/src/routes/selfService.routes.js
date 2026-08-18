/**
 * Self-Service Routes - Issue #1114
 * Mounted at /api/self in app.js.
 * All routes: auth middleware + employeePortalGuard.
 */
'use strict';

const { Router }              = require('express');
const auth                    = require('../middlewares/auth.middleware');
const { employeePortalGuard } = require('../middlewares/employeePortal.middleware');
const {
  getMyPayslips,
  getMyDocuments,
  downloadDocument,
  getMyLeaveBalance,
} = require('../controllers/selfService.controller');

const router = Router();

// Every route in this file requires both auth and the employee portal guard.
router.use(auth, employeePortalGuard);

router.get('/payslips',                getMyPayslips);
router.get('/documents',               getMyDocuments);
router.get('/documents/:id/download',  downloadDocument);
router.get('/leave-balance',           getMyLeaveBalance);

module.exports = router;