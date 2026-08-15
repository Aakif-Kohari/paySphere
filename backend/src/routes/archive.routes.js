const express = require('express');
const router = express.Router();
const {
  getArchivedEmployees,
  getArchivedEmployee,
} = require('../controllers/archive.controller');
// `auth.middleware` exports the middleware itself (`module.exports = auth`),
// not an object containing it. Destructuring gave `undefined`, and
// `router.get(path, undefined, handler)` throws at require time — so simply
// mounting this router was enough to stop the server booting. Same shape as
// the `verifyToken` destructure that broke #614.
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { requireTenantScope } = require('../utils/tenantScope');
const { PERMISSIONS } = require('../config/permissions');

/**
 * The archive (#759, gated in #897).
 *
 * These routes were behind `auth` and nothing else, so any authenticated
 * account — including an EMPLOYEE-type account whose access is meant to stop at
 * the self-service portal — could read whole employee documents: salary, email,
 * department, the lot. `GET /api/employees` sits behind READ_EMPLOYEE. Deleting
 * a record should not widen who can read it.
 */

router.get(
  '/employees',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getArchivedEmployees,
);

router.get(
  '/employees/:id',
  auth,
  requireTenantScope(),
  requirePermission(PERMISSIONS.READ_EMPLOYEE),
  getArchivedEmployee,
);

module.exports = router;
