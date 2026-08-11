'use strict';
const { Router } = require('express');
const { liveness, readiness, metrics } = require('../controllers/health.controller');
const router = Router();
router.get('/health/live',    liveness);
router.get('/health/ready',   readiness);
router.get('/health/metrics', metrics);
module.exports = router;