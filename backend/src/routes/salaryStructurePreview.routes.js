/**
 * Salary Structure Preview Routes - Issue #1111
 * Mounted at /api/salary-structures in app.js
 */
'use strict';

const { Router }            = require('express');
const auth                  = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS }       = require('../config/permissions');
const { previewStructure, validateStructure } = require('../controllers/salaryStructurePreview.controller');

const router = Router();

router.post('/preview',         auth, requirePermission(PERMISSIONS.READ_PAYROLL), previewStructure);
router.post('/:id/validate',    auth, requirePermission(PERMISSIONS.READ_PAYROLL), validateStructure);

module.exports = router;