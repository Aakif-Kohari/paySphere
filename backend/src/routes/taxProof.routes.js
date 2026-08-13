const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { submitProof, getMyProofs, getVerificationQueue, verifyProof } = require('../controllers/taxProof.controller');

const router = express.Router();

// Employee endpoints
router.post('/', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, submitProof);
router.get('/my-proofs', auth, requirePermission('READ_EMPLOYEE'), getMyProofs);

// HR/Admin endpoints
router.get('/queue', auth, requirePermission('READ_PAYROLL'), getVerificationQueue);
router.patch('/:id/verify', auth, requirePermission('WRITE_PAYROLL'), writeRateLimiter, verifyProof);

module.exports = router;
