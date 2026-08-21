const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createAlumniProfile, searchAlumni, processBoomerangRehire } = require('../controllers/alumni.controller');

const router = express.Router();

router.post('/create', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createAlumniProfile);
router.get('/search', auth, requirePermission('READ_EMPLOYEE'), searchAlumni);
router.post('/rehire', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, processBoomerangRehire);

module.exports = router;
