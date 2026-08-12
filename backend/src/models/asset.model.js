/**
 * @fileoverview Asset & Asset Assignment Schemas
 * @description Tracks the lifecycle, depreciation, and assignment history of company assets.
 * Issue: #955
 */
const mongoose = require('mongoose');

const assetCategorySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., 'IT Equipment', 'Furniture'
    depreciationMethod: { type: String, enum: ['SLM', 'WDV'], default: 'SLM' },
    usefulLifeYears: { type: Number, required: true, min: 1, max: 50 },
    salvageValuePercentage: { type: Number, default: 5, min: 0, max: 100 }, // % of purchase price
}, { timestamps: true });

assetCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
const AssetCategory = mongoose.model('AssetCategory', assetCategorySchema);

const assetSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetCategory', required: true },
    name: { type: String, required: true, trim: true }, // e.g., 'MacBook Pro 16"'
    serialNumber: { type: String, required: true, trim: true, unique: true },
    purchaseDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    currentBookValue: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['Available', 'Assigned', 'Maintenance', 'Retired', 'Lost'],
        default: 'Available'
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    conditionNotes: { type: String, default: 'New' },
    photos: [{ url: String, uploadedAt: Date }],
}, { timestamps: true });

assetSchema.index({ tenantId: 1, status: 1 });
assetSchema.index({ tenantId: 1, assignedTo: 1 });
const Asset = mongoose.model('Asset', assetSchema);

const assetAssignmentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    checkoutDate: { type: Date, required: true, default: Date.now },
    checkinDate: { type: Date, default: null },
    checkoutCondition: { type: String, default: 'Good' },
    checkinCondition: { type: String, default: null },
    damageReported: { type: Boolean, default: false },
    recoveryAmount: { type: Number, default: 0 }, // Deducted from payroll if damaged
    isActive: { type: Boolean, default: true }, // True if currently holding the asset
}, { timestamps: true });

assetAssignmentSchema.index({ assetId: 1, isActive: 1 });
const AssetAssignment = mongoose.model('AssetAssignment', assetAssignmentSchema);

module.exports = { AssetCategory, Asset, AssetAssignment };
