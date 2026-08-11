/**
 * IntegrationConfig Model
 *
 * Stores per-tenant HRMS integration settings.  Credentials (`apiKey`,
 * `password`) must be encrypted at the application layer (EncryptionService)
 * before being written here.
 */
'use strict';

const mongoose = require('mongoose');

const integrationConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    provider: { type: String, enum: ['bamboohr', 'workday', 'adp', 'sap'], required: true },
    /** Encrypted credentials blob — shape is adapter-specific. */
    credentials:     { type: Object, required: true },
    isActive:        { type: Boolean, default: true },
    syncSchedule:    { type: String, default: '0 2 * * *' }, // daily 02:00
    lastSyncAt:      { type: Date,   default: null },
    lastSyncStatus:  { type: String, enum: ['success', 'partial', 'failed', null], default: null },
    lastSyncError:   { type: String, default: null },
  },
  { timestamps: true },
);

// One active config per tenant per provider
integrationConfigSchema.index({ tenantId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationConfig', integrationConfigSchema);
