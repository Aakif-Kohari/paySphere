const mongoose = require('mongoose');

const CompensationProfileSchema = new mongoose.Schema({
    employeeId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    roleLevel: { type: Number, required: true, min: 1, max: 10 }, // E.g., L1 to L10
    jobFamily: { type: String, required: true },

    // Demographics (Used strictly for anonymized parity analysis)
    gender: { type: String, enum: ['MALE', 'FEMALE', 'NON_BINARY', 'UNDISCLOSED'], default: 'UNDISCLOSED' },
    ethnicity: { type: String, default: 'UNDISCLOSED' },
    ageGroup: { type: String, enum: ['20-29', '30-39', '40-49', '50-59', '60+'] },

    // Compensation Details
    baseSalary: { type: Number, required: true },
    targetBonusPercentage: { type: Number, required: true },
    actualBonusPaid: { type: Number, default: 0 },
    equityGrantedValue: { type: Number, default: 0 },
    totalCompensation: { type: Number, required: true },

    // Performance and Tenure
    performanceRating: { type: Number, min: 1, max: 5 },
    yearsOfExperience: { type: Number, required: true },
    tenureInCompany: { type: Number, required: true },

    // Geographical factor
    locationTier: { type: String, enum: ['TIER_1', 'TIER_2', 'TIER_3', 'GLOBAL'], default: 'TIER_1' },
    currency: { type: String, default: 'USD' }
}, { timestamps: true });

const PayParityAuditLogSchema = new mongoose.Schema({
    auditId: { type: String, required: true, unique: true },
    auditDate: { type: Date, default: Date.now },
    auditorId: { type: String, required: true },

    // Metrics Snapshot
    overallGenderWageGap: { type: Number }, // percentage difference
    overallEthnicityWageGap: { type: Number },
    unexplainedVariance: { type: Number }, // ML model unexplained variance representing potential bias

    departmentBreakdowns: [{
        department: { type: String },
        genderGap: { type: Number },
        equityRiskFactor: { type: Number }, // 0 to 100
        flaggedEmployees: { type: Number }
    }],

    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ACTION_REQUIRED', 'REMEDIATED'] },
    remediationBudget: { type: Number, default: 0 }
}, { timestamps: true });

// Analytical indexes for fast aggregation
CompensationProfileSchema.index({ department: 1, roleLevel: 1 });
CompensationProfileSchema.index({ jobFamily: 1, gender: 1 });
PayParityAuditLogSchema.index({ status: 1 });

const CompensationProfile = mongoose.model('CompensationProfile', CompensationProfileSchema);
const PayParityAuditLog = mongoose.model('PayParityAuditLog', PayParityAuditLogSchema);

module.exports = {
    CompensationProfile,
    PayParityAuditLog
};
