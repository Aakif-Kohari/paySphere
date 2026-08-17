/**
 * @fileoverview Asset & Asset Assignment Schemas
 * @description Tracks the lifecycle, depreciation, and assignment history of company assets.
 * Issue: #955
 */
const mongoose = require('mongoose');

const assetCategorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true }, // e.g., 'IT Equipment', 'Furniture'
    depreciationMethod: { type: String, enum: ['SLM', 'WDV'], default: 'SLM' },
    usefulLifeYears: { type: Number, required: true, min: 1, max: 50 },
    salvageValuePercentage: { type: Number, default: 5, min: 0, max: 100 }, // % of purchase price
  },
  { timestamps: true },
);

assetCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });
const AssetCategory = mongoose.model('AssetCategory', assetCategorySchema);

const assetSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssetCategory',
      required: true,
    },
    name: { type: String, required: true, trim: true }, // e.g., 'MacBook Pro 16"'
    serialNumber: { type: String, required: true, trim: true, unique: true },
    purchaseDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    currentBookValue: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['Available', 'Assigned', 'Maintenance', 'Retired', 'Lost'],
      default: 'Available',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    conditionNotes: { type: String, default: 'New' },
    photos: [{ url: String, uploadedAt: Date }],

    // --- Register fields (#1156) --------------------------------------------

    /**
     * Impairment written off to date, as a positive number.
     *
     * Held separately from `currentBookValue` even though impairment reduces
     * it, because the register has to report the two apart: accumulated
     * depreciation is derived as `purchasePrice - currentBookValue -
     * accumulatedImpairment`, and without this field a write-down is
     * indistinguishable from depreciation that never happened.
     *
     * It is also the ceiling on a reversal — an impairment may be written back
     * only up to what it took away.
     */
    accumulatedImpairment: { type: Number, default: 0, min: 0 },
    lastImpairmentDate: { type: Date, default: null },
    lastRecoverableAmount: { type: Number, default: null },

    /**
     * The period the last depreciation charge was for, as `YYYY-MM`.
     *
     * `runMonthlyDepreciation` subtracted a month of depreciation on every
     * call with nothing recording which month it had just run, so a retried
     * cron or a second press of the button depreciated twice and the register
     * understated net block for the rest of the asset's life.
     */
    lastDepreciationPeriod: { type: String, default: null },

    /**
     * When the asset left the register.
     *
     * `disposeAsset` set the status to `Retired` and nothing else, so a
     * disposal could not be placed in a reporting period and the register's
     * disposals column had no source.
     */
    disposedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

assetSchema.index({ tenantId: 1, status: 1 });
assetSchema.index({ tenantId: 1, assignedTo: 1 });
const Asset = mongoose.model('Asset', assetSchema);

const assetAssignmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    checkoutDate: { type: Date, required: true, default: Date.now },
    /**
     * When the asset is due back (#1156).
     *
     * `assignAsset` has written this field since the module shipped and the
     * schema never declared it, so Mongoose stripped it on every save. Every
     * assignment lost its return date silently, and nothing could report
     * overdue custody because there was never a date to be late against.
     *
     * Optional: an assignment with no expected return is open-ended, which is
     * a policy question rather than a late return, and `detectOverdueReturns`
     * counts the two separately.
     */
    expectedReturnDate: { type: Date, default: null },
    checkinDate: { type: Date, default: null },
    checkoutCondition: { type: String, default: 'Good' },
    checkinCondition: { type: String, default: null },
    damageReported: { type: Boolean, default: false },
    recoveryAmount: { type: Number, default: 0 }, // Deducted from payroll if damaged
    isActive: { type: Boolean, default: true }, // True if currently holding the asset
  },
  { timestamps: true },
);

assetAssignmentSchema.index({ assetId: 1, isActive: 1 });
// The overdue report asks "which assignments in this company are still open?",
// which had no index behind it because there was no overdue report (#1156).
assetAssignmentSchema.index({
  tenantId: 1,
  isActive: 1,
  expectedReturnDate: 1,
});
const AssetAssignment = mongoose.model(
  'AssetAssignment',
  assetAssignmentSchema,
);

module.exports = { AssetCategory, Asset, AssetAssignment };
