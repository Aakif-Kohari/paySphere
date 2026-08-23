const mongoose = require('mongoose');

const anomalyConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    netPayDropThresholdPercent: {
      type: Number,
      default: 30, // Default to 30% drop threshold
      min: 0,
      max: 100,
    },
    netPaySpikeThresholdPercent: {
      type: Number,
      default: 50, // Default to 50% spike threshold
      min: 0,
    },
    flagNewHires: {
      type: Boolean,
      default: true,
    },
    flagTerminations: {
      type: Boolean,
      default: true,
    },
    flagSalaryRevisions: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

const AnomalyConfig = mongoose.model('AnomalyConfig', anomalyConfigSchema);
module.exports = AnomalyConfig;
