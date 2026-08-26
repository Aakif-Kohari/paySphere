'use strict';
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { getIpWhitelist, upsertIpWhitelist } = require('../controllers/securitySettings.controller');

const router = Router();

router.get('/ip-whitelists', auth, requirePermission(PERMISSIONS.READ_COMPLIANCE), getIpWhitelist);
router.put('/ip-whitelists', auth, requirePermission(PERMISSIONS.MANAGE_COMPLIANCE), upsertIpWhitelist);

module.exports = router;