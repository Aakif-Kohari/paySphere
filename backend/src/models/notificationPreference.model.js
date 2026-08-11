'use strict';
const mongoose = require('mongoose');
const KNOWN = ['PAYROLL_COMPLETED','SALARY_CHANGED','EMPLOYEE_ONBOARDED','LOAN_DEDUCTED','EXPENSE_APPROVED','EXPENSE_REJECTED','APPROVAL_REQUIRED'];
const schema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  eventType: { type: String, enum: KNOWN, required: true },
  channels:  { type: [String], default: ['in_app'] },
  enabled:   { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ userId: 1, eventType: 1 }, { unique: true });
const M = mongoose.model('NotificationPreference', schema);
M.KNOWN_EVENT_TYPES = KNOWN;
module.exports = M;