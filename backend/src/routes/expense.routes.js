/**
 * Expense claim routes (#719).
 *
 * Mounted at /api/expenses by app.js — it was not mounted anywhere until #792,
 * so every endpoint here was a 404 from the day the file was written, and the
 * permissions it asks for did not exist until #794, so they were a 403 after
 * that.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
// `receiptUpload`, not the default CSV uploader: that one rejects everything
// that is not `text/csv` and stores to memory, so a receipt could never be
// uploaded and would have had no filename to record if it had been (#794).
const { receiptUpload } = require('../middlewares/upload.middleware');
const { PERMISSIONS } = require('../config/permissions');
const {
  submitExpense,
  getExpenses,
  updateExpenseStatus,
  getCategories,
  createCategory,
  updateCategory,
} = require('../controllers/expense.controller');

const router = express.Router();

// --- Categories -----------------------------------------------------------
//
// Declared before `/:id/status` so `/categories` cannot be swallowed by a
// parameterised route, and kept on this router rather than a new mount point so
// the whole feature stays behind one prefix.
//
// A claim's category is required and there was no way to create one, so the
// collection was empty on every install and the first possible POST /api/expenses
// was a guaranteed 404 (#794).

router.get(
  '/categories',
  auth,
  requirePermission(PERMISSIONS.READ_EXPENSE),
  getCategories,
);

router.post(
  '/categories',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EXPENSE_CATEGORY),
  writeRateLimiter,
  createCategory,
);

router.patch(
  '/categories/:id',
  auth,
  requirePermission(PERMISSIONS.MANAGE_EXPENSE_CATEGORY),
  writeRateLimiter,
  updateCategory,
);

// --- Claims ---------------------------------------------------------------

router.post(
  '/',
  auth,
  requirePermission(PERMISSIONS.WRITE_EXPENSE),
  writeRateLimiter,
  receiptUpload.array('receipts', 5),
  submitExpense,
);

router.get('/', auth, requirePermission(PERMISSIONS.READ_EXPENSE), getExpenses);

router.patch(
  '/:id/status',
  auth,
  requirePermission(PERMISSIONS.APPROVE_EXPENSE),
  writeRateLimiter,
  updateExpenseStatus,
);

module.exports = router;
