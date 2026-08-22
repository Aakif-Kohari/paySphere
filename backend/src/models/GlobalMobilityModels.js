const mongoose = require('mongoose');

const ExpatAssignmentSchema = new mongoose.Schema({
    assignmentId: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    department: { type: String, required: true },

    homeCountry: { type: String, required: true },
    hostCountry: { type: String, required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }, // Expected end date
    status: { type: String, enum: ['PROPOSED', 'ACTIVE', 'REPATRIATED', 'TERMINATED'], default: 'ACTIVE' },

    // Tax Equalization Policy
    taxPolicyType: { type: String, enum: ['EQUALIZATION', 'PROTECTION', 'LOCALIZED'], default: 'EQUALIZATION' },
    homeTaxRate: { type: Number, required: true },     // Expected stay-at-home tax %
    hostTaxRate: { type: Number, required: true },     // Actual host country tax %
    taxDifferentialExpected: { type: Number, default: 0 }, // Expected cost to company

    // Allowances & Relocation
    relocationBudget: { type: Number, required: true },
    housingAllowance: { type: Number, default: 0 },
    COLAAllowance: { type: Number, default: 0 }, // Cost of living adjustment
    hardshipPremium: { type: Number, default: 0 },

    // Analytics
    baseSalary: { type: Number, required: true },
    currency: { type: String, default: 'USD' }
}, { timestamps: true });


const GlobalMobilityStatsSchema = new mongoose.Schema({
    metricDate: { type: Date, required: true },
    totalActiveExpats: { type: Number, default: 0 },
    totalEqualizationLiability: { type: Number, default: 0 },
    topHostCountry: { type: String }
}, { timestamps: true });

ExpatAssignmentSchema.index({ status: 1 });
ExpatAssignmentSchema.index({ hostCountry: 1 });

module.exports = {
    ExpatAssignment: mongoose.model('ExpatAssignment', ExpatAssignmentSchema),
    GlobalMobilityStats: mongoose.model('GlobalMobilityStats', GlobalMobilityStatsSchema)
};
