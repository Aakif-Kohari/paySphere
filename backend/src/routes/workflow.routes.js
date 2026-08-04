const express = require('express');
const {
  createWorkflow,
  getWorkflows,
  startInstance,
  getInstances,
  transitionInstance,
} = require('../controllers/workflow.controller');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

/**
 * The workflow engine's routes (#590), mounted and guarded (#614).
 *
 * Two things were wrong here. The router was never registered in app.js, so
 * every one of these was a 404 and `WorkflowBuilder.jsx` had nothing to talk to.
 * And it imported a named export that does not exist:
 *
 *     const { verifyToken } = require('../middlewares/auth.middleware');
 *     router.use(verifyToken);
 *
 * `auth.middleware.js` ends with `module.exports = auth` — one function, no
 * named exports — so `verifyToken` was `undefined` and the first line executed
 * at require time was
 *
 *     TypeError: Router.use() requires a middleware function but got a undefined
 *
 * Mounting this file as it stood took the process down at boot. Every other
 * router in the repo imports it as `const auth = require(...)`, and so does
 * this one now.
 *
 * The permission guards follow payroll.routes.js (#413/#458): defining a chain
 * and raising a request are WRITE_PAYROLL actions, and *acting* on a request
 * needs APPROVE_PAYROLL — a distinct permission, so the person who raises a
 * request cannot also be the only one who signs it off. #590 had
 * `router.use(auth)` and nothing more, which let any authenticated account,
 * including an employee-portal login, approve a payroll run.
 */

// --- Definitions ----------------------------------------------------------
router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  createWorkflow,
);
router.get('/', auth, requirePermission(PERMISSIONS.READ_PAYROLL), getWorkflows);

// --- Requests raised against a definition ---------------------------------
//
// The two literal `/instances` paths are declared before `/:workflowId/...` so
// "instances" can never be captured as a workflow id.
router.get(
  '/instances',
  auth,
  requirePermission(PERMISSIONS.READ_PAYROLL),
  getInstances,
);
router.post(
  '/instances/:instanceId/transition',
  auth,
  requirePermission(PERMISSIONS.APPROVE_PAYROLL),
  writeRateLimiter,
  transitionInstance,
);
router.post(
  '/:workflowId/instances',
  auth,
  requirePermission(PERMISSIONS.WRITE_PAYROLL),
  writeRateLimiter,
  startInstance,
);

module.exports = router;
