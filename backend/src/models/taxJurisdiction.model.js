/**
 * @fileoverview Tax Jurisdiction Schema
 * @description Maps regional states/provinces to the company's tax nexus registration status.
 * Issue: #1086
 */
const mongoose = require('mongoose');

const taxJurisdictionSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stateCode: { type: String, required: true, uppercase: true, trim: true }, // e.g., 'CA', 'NY', 'KA'
    stateName: { type: String, required: true, trim: true },
    country: { type: String, default: 'US' },

    // Nexus tracking: Does the company have a legal tax obligation here?
    hasNexus: { type: Boolean, default: false },
    nexusEstablishedDate: { type: Date, default: null },
    registrationNumber: { type: String, default: '' }, // State tax ID

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

taxJurisdictionSchema.index({ tenantId: 1, stateCode: 1 }, { unique: true });
module.exports = mongoose.model('TaxJurisdiction', taxJurisdictionSchema);
