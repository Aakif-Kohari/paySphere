'use strict';
const { Router } = require('express');
const {
  liveness,
  readiness,
  metrics,
} = require('../controllers/health.controller');
const router = Router();

/**
 * @openapi
 * /health/live:
 *   get:
 *     summary: Check backend liveness
 *     tags:
 *       - System
 *     description: Endpoint used by orchestrators to check if the application is running.
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 */
router.get('/health/live', liveness);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Check backend readiness
 *     tags:
 *       - System
 *     description: Endpoint used to check if the database and third-party dependencies are ready to accept traffic.
 *     responses:
 *       200:
 *         description: Application is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: READY
 */
router.get('/health/ready', readiness);
router.get('/health/metrics', metrics);
module.exports = router;
