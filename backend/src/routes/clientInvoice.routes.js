const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const { createInvoice, recordPayment, getDashboard } = require('../controllers/clientInvoice.controller');

const router = express.Router();

router.post('/invoices', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, createInvoice);
router.post('/invoices/:id/payment', auth, requirePermission('WRITE_EMPLOYEE'), writeRateLimiter, recordPayment);
router.get('/invoices/dashboard', auth, requirePermission('READ_EMPLOYEE'), getDashboard);

module.exports = router;
