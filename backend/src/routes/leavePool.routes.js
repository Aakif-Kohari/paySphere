/**
 * @fileoverview Leave Pool API Routes
 * Issue: #1575
 */

const express = require('express');
const router = express.Router();
const {
  donateLeave,
  applyRelief,
  grantRelief,
  getPoolMetrics,
} = require('../controllers/leavePool.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/donate', protect, donateLeave);
router.post('/apply-relief', protect, applyRelief);
router.post('/grant-relief', protect, grantRelief);
router.get('/pool-metrics', protect, getPoolMetrics);

module.exports = router;
