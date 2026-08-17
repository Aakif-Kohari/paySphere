/**
 * Employee Import Routes - Issue #1112
 * Mounted at /api/employees in app.js
 */
'use strict';

const { Router }            = require('express');
const multer                = require('multer');
const auth                  = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS }       = require('../config/permissions');
const { startImport, getImportJob, commitJob, rollbackJob } = require('../controllers/employeeImport.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/import',               auth, requirePermission(PERMISSIONS.WRITE_EMPLOYEE), upload.single('csv'), startImport);
router.get('/import/:jobId',         auth, requirePermission(PERMISSIONS.READ_EMPLOYEE),  getImportJob);
router.post('/import/:jobId/commit', auth, requirePermission(PERMISSIONS.WRITE_EMPLOYEE), commitJob);
router.delete('/import/:jobId',      auth, requirePermission(PERMISSIONS.WRITE_EMPLOYEE), rollbackJob);

module.exports = router;