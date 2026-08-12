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

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { globalSearch } = require('../controllers/search.controller');

const router = express.Router();

router.get('/', auth, globalSearch);

module.exports = router;
