/**
 * Plan Model - Issue #1113
 *
 * Defines available subscription tiers.
 * Seeded once with plan.seed.js. Read-only at runtime.
 */
'use strict';

const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, unique: true },
    slug:     { type: String, required: true, unique: true, lowercase: true },
    // Feature slugs included in this plan (e.g. 'VARIANCE_REPORT', 'BULK_IMPORT').
    features: { type: [String], default: [] },
    limits: {
      employeeCount:   { type: Number, default: 9999 },
      reportSchedules: { type: Number, default: 5 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);