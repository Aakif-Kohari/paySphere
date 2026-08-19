/**
 * Employee Document Model - Issue #1114
 *
 * Stores metadata for files in the employee document vault.
 * The actual bytes live in object storage (S3/Cloudinary).
 * The fileKey (storage path) is never returned to the client directly.
 * Access goes through a pre-signed URL generated on demand.
 */
'use strict';

const mongoose = require('mongoose');

const DOCUMENT_TYPES = ['payslip', 'offer_letter', 'form16', 'contract', 'investment_proof', 'other'];

const employeeDocumentSchema = new mongoose.Schema(
  {
    tenantId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',   required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type:       { type: String, enum: DOCUMENT_TYPES, required: true },
    // Internal storage path - never sent to the browser.
    fileKey:    { type: String, required: true, select: false },
    originalName: { type: String, default: '' },
    mimeType:   { type: String, default: 'application/octet-stream' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // E-signature tracking
    requiresSignature: { type: Boolean, default: false },
    signedAt:   { type: Date,   default: null },
    signedByIp: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);