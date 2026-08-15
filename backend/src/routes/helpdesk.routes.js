const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { uploadKnowledge, askQuestion, escalateToTicket } = require('../controllers/helpdesk.controller');

const router = express.Router();

// HR Admin endpoints
router.post('/knowledge/upload', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, uploadKnowledge);

// Employee endpoints
router.post('/ask', auth, writeRateLimiter, askQuestion);
router.post('/tickets/escalate', auth, writeRateLimiter, escalateToTicket);

module.exports = router;
