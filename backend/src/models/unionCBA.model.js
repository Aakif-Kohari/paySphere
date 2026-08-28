/**
 * @fileoverview Union CBA & Grievance Schemas
 * @description Tracks Collective Bargaining Agreements, union dues tiers, and grievance arbitrations.
 * Issue: #1475
 */
const mongoose = require('mongoose');

/**
 * CollectiveBargainingAgreement Schema
 * Master document for a union contract, including effective dates and dues rules.
 */
const collectiveBargainingAgreementSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    unionName: { type: String, required: true },
    agreementName: { type: String, required: true }, // e.g., "CBA 2024-2027"

    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, required: true },

    // Dues Calculation Configuration
    duesCalculationType: { type: String, enum: ['FlatFee', 'Percentage', 'Tiered'], required: true },
    flatFeeAmount: { type: Number, default: 0 },
    percentageRate: { type: Number, default: 0, min: 0, max: 1 }, // e.g., 0.015 for 1.5%

    // Statutory Guardrails
    maxMonthlyDeduction: { type: Number, default: Infinity }, // Legal cap on dues deduction

    status: { type: String, enum: ['Draft', 'Active', 'Expired'], default: 'Active' }
}, { timestamps: true });

const CollectiveBargainingAgreement = mongoose.model('CollectiveBargainingAgreement', collectiveBargainingAgreementSchema);

/**
 * UnionDuesTier Schema
 * Defines tiered dues structures (e.g., based on job classification or base pay).
 */
const unionDuesTierSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    cbaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectiveBargainingAgreement', required: true },

    tierName: { type: String, required: true }, // e.g., "Junior Mechanic", "Senior Engineer"
    minBasePay: { type: Number, default: 0 },
    maxBasePay: { type: Number, default: Infinity },

    duesAmount: { type: Number, required: true } // Flat amount for this tier
}, { timestamps: true });

const UnionDuesTier = mongoose.model('UnionDuesTier', unionDuesTierSchema);

/**
 * GrievanceArbitration Schema
 * Tracks formal grievances and their arbitration lifecycle with SLA deadlines.
 */
const grievanceArbitrationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    cbaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectiveBargainingAgreement', required: true },

    title: { type: String, required: true },
    description: { type: String, required: true },
    filedDate: { type: Date, required: true },

    // Arbitration Steps (e.g., Step 1: Supervisor, Step 2: HR, Step 3: External Arbitrator)
    currentStep: { type: Number, default: 1 },
    maxSteps: { type: Number, default: 3 },

    // SLA Tracking
    stepDeadline: { type: Date, required: true }, // When the current step must be resolved/escalated
    isSLABreached: { type: Boolean, default: false },

    status: {
        type: String,
        enum: ['Open', 'Escalated', 'Resolved', 'Dismissed'],
        default: 'Open',
        index: true
    },

    resolutionNotes: { type: String, default: '' }
}, { timestamps: true });

const GrievanceArbitration = mongoose.model('GrievanceArbitration', grievanceArbitrationSchema);

module.exports = { CollectiveBargainingAgreement, UnionDuesTier, GrievanceArbitration };
