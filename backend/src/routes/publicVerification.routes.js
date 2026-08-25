'use strict';
const { Router } = require('express');
const { verifyDocumentSeal } = require('../controllers/publicVerification.controller');

const router = Router();

router.post('/verify', verifyDocumentSeal);

module.exports = router;