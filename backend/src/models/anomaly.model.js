const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const anomalySchema = new mongoose.Schema(
  {
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun' },
    flaggedEmployees: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    ],
    severity: { type: String, enum: ['LOW', 'HIGH', 'CRITICAL'] },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true },
);

anomalySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('Anomaly', anomalySchema);
