/**
 * @fileoverview Employee Document Vault Schemas
 * @description Manages secure document storage categories, employee document
 * uploads, access control, versioning, sharing permissions, and audit logs.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');

// ============================================================================
// Document Category — admin-defined categories for organizing documents
// ============================================================================

const documentCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 300 },
    /** Who can see documents in this category. */
    visibility: {
      type: String,
      enum: ['Employee', 'Manager', 'HR', 'Admin'],
      default: 'Employee',
    },
    /** Whether employees can upload to this category. */
    allowEmployeeUpload: { type: Boolean, default: false },
    /** Required documents — triggers compliance alerts. */
    isRequired: { type: Boolean, default: false },
    /** Validity period in days — documents expire after this. */
    validityDays: { type: Number, default: 0, min: 0, max: 3650 },
    /** Allowed file extensions. */
    allowedExtensions: {
      type: [String],
      default: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    },
    /** Max file size in MB. */
    maxFileSizeMB: { type: Number, default: 10, min: 1, max: 50 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

documentCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
documentCategorySchema.plugin(auditTrailPlugin);
const DocumentCategory = mongoose.model(
  'DocumentCategory',
  documentCategorySchema,
);

// ============================================================================
// Employee Document — the actual document record
// ============================================================================

const documentVersionSchema = new mongoose.Schema(
  {
    versionNumber: { type: Number, required: true, min: 1 },
    fileUrl: { type: String, required: true, maxlength: 2000 },
    fileSize: { type: Number, default: 0, min: 0 }, // bytes
    mimeType: { type: String, default: '', maxlength: 100 },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: { type: Date, required: true, default: Date.now },
    changeNote: { type: String, default: '', maxlength: 300 },
  },
  { _id: false },
);

const employeeDocumentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentCategory',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', maxlength: 500 },
    /** Current/latest file URL. */
    fileUrl: { type: String, required: true, maxlength: 2000 },
    fileName: { type: String, required: true, maxlength: 255 },
    fileSize: { type: Number, default: 0, min: 0 },
    mimeType: { type: String, default: '', maxlength: 100 },
    /** Document expiry date (derived from category validity or manual). */
    expiresAt: { type: Date, default: null, index: true },
    /** Status tracking. */
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Archived', 'PendingReview', 'Rejected'],
      default: 'Active',
      index: true,
    },
    /** Review workflow for HR-required documents. */
    reviewStatus: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected'],
      default: 'None',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: '', maxlength: 500 },
    /** Versioning — all versions stored. */
    versions: { type: [documentVersionSchema], default: [] },
    currentVersion: { type: Number, default: 1, min: 1 },
    /** Tags for searchability. */
    tags: { type: [String], default: [] },
    /** Whether this document is pinned/starred by the employee. */
    isPinned: { type: Boolean, default: false },
    /** Download count for analytics. */
    downloadCount: { type: Number, default: 0, min: 0 },
    /** Last accessed timestamp. */
    lastAccessedAt: { type: Date, default: null },
    /** Shared with specific users. */
    sharedWith: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        permission: {
          type: String,
          enum: ['View', 'Download', 'Edit'],
          default: 'View',
        },
        sharedAt: { type: Date, default: Date.now },
        sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    /** Upload metadata. */
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: { type: Date, required: true, default: Date.now },
    /** Soft delete. */
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

employeeDocumentSchema.index({ tenantId: 1, employeeId: 1, categoryId: 1 });
employeeDocumentSchema.index({ tenantId: 1, status: 1, expiresAt: 1 });
employeeDocumentSchema.index({ tenantId: 1, isDeleted: 1 });
employeeDocumentSchema.index({ tenantId: 1, title: 'text', tags: 'text' });
employeeDocumentSchema.plugin(auditTrailPlugin);
const EmployeeDocument = mongoose.model(
  'EmployeeDocument',
  employeeDocumentSchema,
);

// ============================================================================
// Document Access Log — audit trail for all document access
// ============================================================================

const documentAccessLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeDocument',
      required: true,
      index: true,
    },
    accessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'View',
        'Download',
        'Upload',
        'Update',
        'Delete',
        'Share',
        'Restore',
        'Review',
      ],
      required: true,
    },
    ipAddress: { type: String, default: '', maxlength: 45 },
    userAgent: { type: String, default: '', maxlength: 500 },
    timestamp: { type: Date, required: true, default: Date.now },
    /** Additional context. */
    details: { type: Object, default: {} },
  },
  { timestamps: false },
);

documentAccessLogSchema.index({ tenantId: 1, documentId: 1, timestamp: -1 });
documentAccessLogSchema.index({ tenantId: 1, accessedBy: 1, timestamp: -1 });
const DocumentAccessLog = mongoose.model(
  'DocumentAccessLog',
  documentAccessLogSchema,
);

module.exports = {
  DocumentCategory,
  EmployeeDocument,
  DocumentAccessLog,
};
