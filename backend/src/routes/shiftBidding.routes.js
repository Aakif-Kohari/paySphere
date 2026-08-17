const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { postOpenShift, placeBid, getMarketplace, assignShift } = require('../controllers/shiftBidding.controller');

const router = express.Router();

router.post('/marketplace/open', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, postOpenShift);
router.get('/marketplace', auth, getMarketplace);
router.post('/marketplace/:id/bid', auth, writeRateLimiter, placeBid);
router.post('/marketplace/:id/assign', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, assignShift);

module.exports = router;
