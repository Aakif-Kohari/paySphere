/**
 * @fileoverview Corporate Entity & Hierarchy Schemas
 * @description Maps Parent-Child tenant relationships for multi-entity corporations.
 * Issue: #999
 */
const mongoose = require('mongoose');

const corporateEntitySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporateEntity', default: null }, // Null means it's a root/parent entity
    entityName: { type: String, required: true, trim: true },
    entityCode: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g., "HOLDING", "SUBSIDIARY_A"
    ownershipPercentage: { type: Number, default: 100, min: 0, max: 100 }, // Parent's ownership % in this entity
    isConsolidated: { type: Boolean, default: true }, // Include in parent's financial rollups
    level: { type: Number, default: 0 }, // 0 = Root, 1 = Child, 2 = Grandchild
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

corporateEntitySchema.index({ parentId: 1 });
module.exports = mongoose.model('CorporateEntity', corporateEntitySchema);
