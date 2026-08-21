const mongoose = require('mongoose');

const expatWorkerSchema = new mongoose.Schema({
    workerId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true },
    homeCountry: { type: String, required: true },
    hostCountry: { type: String, required: true },
    department: { type: String, required: true },
    jobTitle: { type: String, required: true },
    baseSalary: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    overallComplianceStatus: {
        type: String,
        enum: ['CLEARED', 'WARNING', 'CRITICAL', 'VIOLATION'],
        default: 'CLEARED'
    },
    dependents: [{
        name: String,
        relation: String,
        visaStatus: String
    }]
}, { timestamps: true });

const visaSponsorshipSchema = new mongoose.Schema({
    sponsorshipId: { type: String, required: true, unique: true, index: true },
    workerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExpatWorker',
        required: true,
        index: true
    },
    visaType: { type: String, required: true }, // e.g., H1-B, L-1, T-2
    sponsoringEntity: { type: String, required: true },
    issueDate: { type: Date, required: true },
    expirationDate: { type: Date, required: true },
    renewalFilingDeadline: { type: Date, required: true },
    visaStatus: {
        type: String,
        enum: ['ACTIVE', 'PROCESSING_RENEWAL', 'EXPIRED', 'REVOKED', 'DENIED'],
        default: 'ACTIVE'
    },
    legalFees: {
        billed: { type: Number, default: 0 },
        paid: { type: Number, default: 0 }
    },
    restrictions: [String],
    documents: [{
        docType: String,
        status: { type: String, enum: ['VERIFIED', 'PENDING', 'MISSING'] },
        uploadedAt: Date
    }],
    riskLevel: {
        type: String,
        enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'],
        default: 'LOW'
    }
}, { timestamps: true });

visaSponsorshipSchema.pre('save', function (next) {
    if (this.expirationDate) {
        const daysUntilExp = (this.expirationDate - Date.now()) / (1000 * 60 * 60 * 24);
        if (this.visaStatus === 'ACTIVE') {
            if (daysUntilExp < 0) {
                this.visaStatus = 'EXPIRED';
                this.riskLevel = 'SEVERE';
            } else if (daysUntilExp <= 90) {
                this.riskLevel = 'HIGH';
            } else if (daysUntilExp <= 180) {
                this.riskLevel = 'MODERATE';
            } else {
                this.riskLevel = 'LOW';
            }
        }
    }
    next();
});

const ExpatWorker = mongoose.model('ExpatWorker', expatWorkerSchema);
const VisaSponsorship = mongoose.model('VisaSponsorship', visaSponsorshipSchema);

module.exports = {
    ExpatWorker,
    VisaSponsorship
};
