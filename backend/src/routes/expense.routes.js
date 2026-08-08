const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const upload = require('../middlewares/upload.middleware');
const {
    submitExpense,
    getExpenses,
    updateExpenseStatus,
} = require('../controllers/expense.controller');

const router = express.Router();

router.post('/', auth, requirePermission('WRITE_EXPENSE'), writeRateLimiter, upload.array('receipts', 5), submitExpense);
router.get('/', auth, requirePermission('READ_EXPENSE'), getExpenses);
router.patch('/:id/status', auth, requirePermission('APPROVE_EXPENSE'), writeRateLimiter, updateExpenseStatus);

module.exports = router;
