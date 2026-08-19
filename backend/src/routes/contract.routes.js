const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { PERMISSIONS } = require('../config/permissions');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  issueContract,
  viewPublicContract,
  acceptContract,
} = require('../controllers/contract.controller');

const router = express.Router();

// HR Endpoints (Protected)
router.post(
  '/issue',
  auth,
  requirePermission(PERMISSIONS.MANAGE_CONTRACT),
  writeRateLimiter,
  issueContract,
);

// Public Candidate Endpoints (No Auth Required, secured by magic token)
router.get('/public/:token', viewPublicContract);
router.post('/public/:token/accept', writeRateLimiter, acceptContract);

module.exports = router;
