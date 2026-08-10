/**
 * Search Routes — mounted at /api/search in app.js
 *
 * Authentication is required: unauthenticated callers must not perform
 * full-text scans of employee or payroll data.
 *
 * ── #895 ───────────────────────────────────────────────────────────────────
 *
 * This file used to open with
 *
 *     const { verifyToken } = require('../middlewares/auth.middleware');
 *
 * and `auth.middleware.js` ends with `module.exports = auth` — the middleware
 * function itself, not an object containing it. So `verifyToken` was
 * `undefined`, `router.get('/', undefined, globalSearch)` threw at require
 * time, and requiring this router was enough to stop the server booting.
 *
 * That is character-for-character the failure that took the process down in
 * #614, and `archive.routes.js` carries a comment warning about it. A third
 * occurrence is a sign that the warning comment is not the control — so
 * `__tests__/search.routes.test.js` now requires this module and asserts every
 * handler in the stack is a function. A future `undefined` middleware fails a
 * test instead of a deployment.
 */
'use strict';

const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { requireTenantScope } = require('../utils/tenantScope');
const {
  globalSearch,
  permissionForRequest,
  VALID_INDEX_KEYS,
} = require('../controllers/search.controller');

const router = Router();

/**
 * Apply the permission that guards the index being searched.
 *
 * The gate cannot be chosen at mount time because the index arrives as a query
 * parameter, and one route serving several indices must not settle on the
 * weakest of their permissions. So the permission is resolved per request and
 * handed to the ordinary `requirePermission` middleware — the same
 * implementation every other route uses, rather than a second copy of the
 * permission logic living in the search feature.
 *
 * An unknown index is rejected here rather than passed through, so a caller
 * cannot skip the gate by naming an index that resolves to no permission.
 *
 * @returns {import('express').RequestHandler}
 */
function requireIndexPermission() {
  return (req, res, next) => {
    const permission = permissionForRequest(req);

    if (!permission) {
      return res.status(400).json({
        message: `Unknown index "${req.query?.index}". Valid values: ${VALID_INDEX_KEYS.join(', ')}`,
      });
    }

    return requirePermission(permission)(req, res, next);
  };
}

router.get(
  '/',
  auth,
  requireTenantScope(),
  requireIndexPermission(),
  globalSearch,
);

module.exports = router;
