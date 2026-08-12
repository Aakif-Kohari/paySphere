const express = require('express');
const auth = require('../middlewares/auth.middleware');
const requireICC = require('../middlewares/iccAuth.middleware');
const { fileGrievance, getCases, decryptCase } = require('../controllers/grievance.controller');

const router = express.Router();

// Public / Authenticated endpoint for filing (No ICC check required)
router.post('/file', auth, fileGrievance);

// Strict ICC-only endpoints
router.get('/cases', auth, requireICC, getCases);
router.post('/:id/decrypt', auth, requireICC, decryptCase);

module.exports = router;
