/**
 * Subscription Routes - Issue #1113
 * Mounted at /api/tenant in app.js
 */
'use strict';

const { Router }       = require('express');
const auth             = require('../middlewares/auth.middleware');
const { getSubscription } = require('../controllers/subscription.controller');

const router = Router();

router.get('/subscription', auth, getSubscription);

module.exports = router;