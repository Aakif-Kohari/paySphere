'use strict';
const mongoose = require('mongoose');

const integrationFieldMapSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    provider: { type: String, required: true },
    mapping: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IntegrationFieldMap', integrationFieldMapSchema);