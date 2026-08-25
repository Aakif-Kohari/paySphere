/**
 * @fileoverview Corporate NPS API Routes
 * Issue: #1574
 */

const express = require('express');
const router = express.Router();
const {
  enrollCorporateNps,
  simulateNpsTaxImpact,
  getMonthlyContributionStatement,
} = require('../controllers/nps.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/corporate-enrollment', protect, enrollCorporateNps);
router.get('/tax-impact-simulator', protect, simulateNpsTaxImpact);
router.get('/monthly-contribution-statement', protect, getMonthlyContributionStatement);

module.exports = router;
