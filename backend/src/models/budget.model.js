'use strict';
const mongoose = require('mongoose');
const budgetSchema = new mongoose.Schema({
  tenantId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  department:      { type: String, required: true },
  year:            { type: Number, required: true },
  month:           { type: Number, required: true, min: 1, max: 12 },
  budgetedGross:   { type: Number, required: true, min: 0 },
  actualGross:     { type: Number, default: null },
  variance:        { type: Number, default: null },
  variancePercent: { type: Number, default: null },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
budgetSchema.index({ tenantId: 1, department: 1, year: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('Budget', budgetSchema);