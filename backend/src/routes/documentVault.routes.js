/**
 * @fileoverview Document Vault Routes
 * @description API endpoints for employee document vault management.
 */

const express = require('express');
const auth = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const { writeRateLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory,
  uploadDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  softDeleteDocument,
  restoreDocument,
  shareDocument,
  removeShare,
  getExpiringDocuments,
  markExpired,
  getComplianceReport,
  getDashboard,
  getAccessLogs,
} = require('../controllers/documentVault.controller');

const router = express.Router();

// ─── Categories ───────────────────────────────────────────────────────────

router.get(
  '/categories',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getCategories,
);
router.post(
  '/categories',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  createCategory,
);
router.patch(
  '/categories/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  updateCategory,
);
router.delete(
  '/categories/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  deleteCategory,
);

// ─── Documents ────────────────────────────────────────────────────────────

router.get(
  '/documents',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getDocuments,
);
router.get(
  '/documents/:id',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getDocumentById,
);
router.post(
  '/documents',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  uploadDocument,
);
router.patch(
  '/documents/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  updateDocument,
);
router.delete(
  '/documents/:id',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  softDeleteDocument,
);
router.post(
  '/documents/:id/restore',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  restoreDocument,
);

// ─── Sharing ──────────────────────────────────────────────────────────────

router.post(
  '/documents/:id/share',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  shareDocument,
);
router.post(
  '/documents/:id/unshare',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  removeShare,
);

// ─── Compliance & Expiry ──────────────────────────────────────────────────

router.get(
  '/expiring',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getExpiringDocuments,
);
router.post(
  '/mark-expired',
  auth,
  requirePermission('WRITE_EMPLOYEE'),
  writeRateLimiter,
  markExpired,
);
router.get(
  '/compliance',
  auth,
  requirePermission('READ_PAYROLL'),
  getComplianceReport,
);

// ─── Dashboard & Logs ─────────────────────────────────────────────────────

router.get(
  '/dashboard',
  auth,
  requirePermission('READ_EMPLOYEE'),
  getDashboard,
);
router.get(
  '/access-logs',
  auth,
  requirePermission('READ_PAYROLL'),
  getAccessLogs,
);

module.exports = router;
