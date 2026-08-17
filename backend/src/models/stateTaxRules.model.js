/**
 * @fileoverview State Tax Rules Schema
 * @description Stores regional tax brackets, standard deductions, and surcharges 
 * for calculating multi-jurisdiction withholding.
 * Issue: #1086
 */
const mongoose = require('mongoose');

const taxBracketSchema = new mongoose.Schema({
    minIncome: { type: Number, required: true, min: 0 },
    maxIncome: { type: Number, default: Infinity }, // Infinity for the top bracket
    rate: { type: Number, required: true, min: 0, max: 100 } // Percentage
}, { _id: false });

const stateTaxRulesSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    jurisdictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxJurisdiction', required: true, index: true },

    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date, default: null },

    // Tax Configuration
    standardDeduction: { type: Number, default: 0, min: 0 },
    brackets: [taxBracketSchema],

    // Flat taxes or surcharges
    flatTaxRate: { type: Number, default: 0, min: 0, max: 100 }, // Used if brackets are empty (e.g., flat 5%)
    surchargeRate: { type: Number, default: 0, min: 0, max: 100 }, // Applied on top of calculated tax
    professionalTax: { type: Number, default: 0, min: 0 } // Fixed monthly/annual amount (e.g., India PT)
}, { timestamps: true });

stateTaxRulesSchema.index({ jurisdictionId: 1, effectiveFrom: -1 });
module.exports = mongoose.model('StateTaxRules', stateTaxRulesSchema);
