/**
 * Search Routes — mounted at /api/search in app.js
 *
 * Authentication is required: unauthenticated callers must not perform
 * full-text scans of employee or payroll data.
 */
'use strict';

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { globalSearch } = require('../controllers/search.controller');

const router = express.Router();

router.get('/', auth, globalSearch);

module.exports = router;
