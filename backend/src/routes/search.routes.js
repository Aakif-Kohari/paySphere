/**
 * Search Routes — mounted at /api/search in app.js
 *
 * Authentication is required: unauthenticated callers must not perform
 * full-text scans of employee or payroll data.
 */
'use strict';

const { Router } = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { globalSearch } = require('../controllers/search.controller');

const router = Router();

router.get('/', verifyToken, globalSearch);

module.exports = router;
