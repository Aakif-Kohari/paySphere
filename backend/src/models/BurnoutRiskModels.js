const mongoose = require('mongoose');

const BurnoutTelemetrySchema = new mongoose.Schema({
    employeeId: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },

    // Workload Metrics
    averageWeeklyHours: { type: Number, required: true },
    weekendHoursLogged: { type: Number, default: 0 },
    afterHoursCommunications: { type: Number, default: 0 }, // E.g., emails/slacks after 6 PM
    daysSinceLastPto: { type: Number, required: true },

    // Sentiments (From surveys/NLP analysis)
    sentimentScore: { type: Number, min: -1.0, max: 1.0, required: true }, // -1 = highly negative, 1 = positive
    engagementIndex: { type: Number, min: 0, max: 100 },

    // Peer/Manager data
    manager1on1Frequency: { type: Number }, // Days between 1on1s
    peerRecognitionCount: { type: Number, default: 0 },

    // Health
    sickDaysTaken: { type: Number, default: 0 },

    // AI Derived Risk Score
    burnoutRiskScore: { type: Number, min: 0, max: 100 },
    riskCategory: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'], default: 'LOW' }

}, { timestamps: true });

const WellnessInterventionLogSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    interventionType: { type: String, enum: ['MANDATORY_PTO', 'WORKLOAD_REBALANCING', 'COACHING', 'WELLNESS_STIPEND'] },
    triggeredBy: { type: String }, // 'SYSTEM_AI' or manager ID
    status: { type: String, enum: ['PROPOSED', 'ACTIVE', 'COMPLETED', 'DECLINED'] },
    followUpDate: { type: Date }
}, { timestamps: true });

BurnoutTelemetrySchema.index({ department: 1, burnoutRiskScore: -1 });
BurnoutTelemetrySchema.index({ riskCategory: 1 });

module.exports = {
    BurnoutTelemetry: mongoose.model('BurnoutTelemetry', BurnoutTelemetrySchema),
    WellnessInterventionLog: mongoose.model('WellnessInterventionLog', WellnessInterventionLogSchema)
};
