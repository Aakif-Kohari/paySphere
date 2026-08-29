const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const componentCapSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    maxPercentageOfBasic: {
      type: Number,
      min: 0,
      max: 100,
    },
    maxMonetaryLimit: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
);

const fbpConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    windowStartDate: {
      type: Date,
      required: true,
    },
    windowEndDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'CLOSED',
    },
    componentCaps: [componentCapSchema],
  },
  { timestamps: true },
);

fbpConfigSchema.index({ tenantId: 1, status: 1 });

fbpConfigSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('FbpConfig', fbpConfigSchema);
