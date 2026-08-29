/**
 * @fileoverview Expense Approval Delegation API Routes
 * Issue: #1573
 */

const express = require('express');
const router = express.Router();
const {
  createDelegation,
  getActiveDelegations,
  processEscalations,
} = require('../controllers/expenseDelegation.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/delegate', protect, createDelegation);
router.get('/active', protect, getActiveDelegations);
router.post('/process-escalations', protect, processEscalations);

module.exports = router;
