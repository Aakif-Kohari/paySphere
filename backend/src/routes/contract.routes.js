const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { issueContract, viewPublicContract, acceptContract } = require('../controllers/contract.controller');

const router = express.Router();

// HR Endpoints (Protected)
router.post('/issue', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, issueContract);

// Public Candidate Endpoints (No Auth Required, secured by magic token)
router.get('/public/:token', viewPublicContract);
router.post('/public/:token/accept', writeRateLimiter, acceptContract);

module.exports = router;
