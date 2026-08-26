/**
 * @fileoverview Gratuity Fund API Routes
 * Issue: #1572
 */

const express = require('express');
const router = express.Router();
const {
  getGratuityLiabilityLedger,
  getEmployeeGratuityTimeline,
  runActuarialRevaluation,
} = require('../controllers/gratuityFund.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/liability-ledger', protect, getGratuityLiabilityLedger);
router.get('/employee/:employeeId', protect, getEmployeeGratuityTimeline);
router.post('/actuarial-revaluation', protect, runActuarialRevaluation);

module.exports = router;
