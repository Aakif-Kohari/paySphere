/**
 * Tenant Subscription Model - Issue #1113
 *
 * One document per tenant. Records the active plan and metered usage counters.
 */
'use strict';

const mongoose = require('mongoose');

const tenantSubscriptionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    planSlug: { type: String, required: true, default: 'basic' },
    status:   { type: String, enum: ['trialing', 'active', 'past_due', 'cancelled'], default: 'trialing' },
    currentPeriodEnd: { type: Date, default: null },
    // Metered counters updated by usageCounter.service.js
    usage: {
      employees:       { type: Number, default: 0 },
      reportSchedules: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TenantSubscription', tenantSubscriptionSchema);