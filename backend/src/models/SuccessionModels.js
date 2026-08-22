const mongoose = require('mongoose');

const keyRoleSchema = new mongoose.Schema({
    roleId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    department: { type: String, required: true },
    criticalityLevel: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'HIGH' },
    businessImpactScore: { type: Number, min: 1, max: 100, default: 50 },
    currentIncumbent: {
        employeeId: String,
        name: String,
        flightRisk: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] },
        retirementWindow: { type: String, enum: ['< 1 YEAR', '1-3 YEARS', '3-5 YEARS', '5+ YEARS'] }
    },
    skillsRequired: [String],
    status: { type: String, enum: ['STABLE', 'AT_RISK', 'VACANT'], default: 'STABLE' }
}, { timestamps: true });

const successionCandidateSchema = new mongoose.Schema({
    candidateId: { type: String, required: true, unique: true, index: true },
    targetRoleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KeyRole',
        required: true,
        index: true
    },
    employeeName: { type: String, required: true },
    currentRole: { type: String, required: true },
    readinessTimeline: {
        type: String,
        enum: ['READY_NOW', 'READY_IN_1_YEAR', 'READY_IN_3_YEARS'],
        required: true
    },
    nineBoxGrid: {
        potential: { type: String, enum: ['LOW', 'MODERATE', 'HIGH'], required: true },
        performance: { type: String, enum: ['LOW', 'MODERATE', 'HIGH'], required: true },
        gridPlacement: { type: String }
    },
    skillsGap: [String],
    developmentPlan: { type: String, default: 'Pending definition' },
    retentionRisk: { type: String, enum: ['LOW', 'MODERATE', 'HIGH'], default: 'LOW' }
}, { timestamps: true });

successionCandidateSchema.pre('save', function (next) {
    if (this.nineBoxGrid && this.nineBoxGrid.potential && this.nineBoxGrid.performance) {
        const pot = this.nineBoxGrid.potential;
        const perf = this.nineBoxGrid.performance;

        if (pot === 'HIGH' && perf === 'HIGH') this.nineBoxGrid.gridPlacement = 'Future Leader';
        else if (pot === 'HIGH' && perf === 'MODERATE') this.nineBoxGrid.gridPlacement = 'Growth Employee';
        else if (pot === 'MODERATE' && perf === 'HIGH') this.nineBoxGrid.gridPlacement = 'High Professional';
        else if (pot === 'LOW' && perf === 'HIGH') this.nineBoxGrid.gridPlacement = 'Trusted Professional';
        else if (pot === 'MODERATE' && perf === 'MODERATE') this.nineBoxGrid.gridPlacement = 'Core Employee';
        else if (pot === 'HIGH' && perf === 'LOW') this.nineBoxGrid.gridPlacement = 'Enigma';
        else if (pot === 'LOW' && perf === 'MODERATE') this.nineBoxGrid.gridPlacement = 'Effective Employee';
        else if (pot === 'MODERATE' && perf === 'LOW') this.nineBoxGrid.gridPlacement = 'Dilemma';
        else this.nineBoxGrid.gridPlacement = 'Underperformer';
    }
    next();
});

const KeyRole = mongoose.model('KeyRole', keyRoleSchema);
const SuccessionCandidate = mongoose.model('SuccessionCandidate', successionCandidateSchema);

module.exports = {
    KeyRole,
    SuccessionCandidate
};
