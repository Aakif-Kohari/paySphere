/**
 * @fileoverview VPF API Routes
 * Issue: #1571
 */

const express = require('express');
const router = express.Router();
const {
  electVpf,
  getVpfSummary,
  getOrganizationVpfReport,
} = require('../controllers/vpf.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/elect', protect, electVpf);
router.get('/summary/:employeeId', protect, getVpfSummary);
router.get('/organization-report', protect, getOrganizationVpfReport);

module.exports = router;
