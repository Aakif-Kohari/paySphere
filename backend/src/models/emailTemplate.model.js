/**
 * @fileoverview Email Template Schema
 * @description Stores customizable WYSIWYG HTML email templates for notifications.
 * Supports variable interpolation (e.g., {{employeeName}}).
 * Issue: #822
 */
const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        subject: { type: String, required: true, trim: true, maxlength: 255 },
        htmlContent: { type: String, required: true },
        variables: [{ type: String, trim: true }], // e.g., ['employeeName', 'month', 'year']
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

emailTemplateSchema.index({ tenantId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
