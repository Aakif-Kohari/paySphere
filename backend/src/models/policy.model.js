'use strict';
const mongoose = require('mongoose');
const policySchema = new mongoose.Schema({
  tenantId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  resource:    { type: String, required: true },
  action:      { type: String, enum: ['read','write','delete','*'], required: true },
  roles:       { type: [String], default: [] },
  condition: {
    field: { type: String, required: true },
    op:    { type: String, enum: ['eq','ne','in','startsWith','createdBy'], required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  effect:    { type: String, enum: ['allow','deny'], default: 'allow' },
  isActive:  { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
policySchema.index({ tenantId: 1, resource: 1, action: 1, isActive: 1 });
module.exports = mongoose.model('Policy', policySchema);