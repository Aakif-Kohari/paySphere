const mongoose = require('mongoose');

const taxJurisdictionSchema = new mongoose.Schema({
    jurisdictionCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    country: { type: String, required: true },
    region: { type: String },
    regulatoryBody: { type: String, required: true },
    taxRates: {
        corporateTax: { type: Number, required: true }, // e.g., 0.21 for 21%
        payrollTaxEmployer: { type: Number, required: true },
        payrollTaxEmployee: { type: Number, required: true },
        valueAddedTax: { type: Number, default: 0 },
        capitalGainsTax: { type: Number, default: 0 }
    },
    complianceStatus: {
        type: String,
        enum: ['HARMONIZED', 'AT_RISK', 'NON_COMPLIANT', 'AUDIT_PENDING'],
        default: 'HARMONIZED'
    },
    lastAuditDate: { type: Date, default: Date.now },
    nextAuditDate: { type: Date },
    treaties: [{
        partnerCountry: String,
        treatyType: String,
        effectiveDate: Date
    }],
    metadata: {
        complexityScore: { type: Number, min: 1, max: 100, default: 50 },
        filingFrequency: {
            type: String,
            enum: ['MONTHLY', 'QUARTERLY', 'ANNUALLY'],
            default: 'QUARTERLY'
        }
    }
}, { timestamps: true });

const corporateObligationSchema = new mongoose.Schema({
    obligationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    jurisdictionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TaxJurisdiction',
        required: true,
        index: true
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    financialMetrics: {
        grossRevenue: { type: Number, required: true },
        deductibleExpenses: { type: Number, required: true },
        netTaxableIncome: { type: Number, required: true },
        payrollTotal: { type: Number, required: true }
    },
    taxLiabilities: {
        calculatedCorporateTax: { type: Number, required: true },
        calculatedPayrollTax: { type: Number, required: true },
        totalLiability: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        outstandingBalance: { type: Number, required: true }
    },
    currency: { type: String, default: 'USD' },
    status: {
        type: String,
        enum: ['DRAFT', 'FILED', 'PAID', 'OVERDUE', 'DISPUTED'],
        default: 'DRAFT'
    },
    riskFlags: [{
        flagType: String,
        severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        description: String,
        detectedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

corporateObligationSchema.pre('save', function (next) {
    if (this.financialMetrics && this.taxLiabilities) {
        this.taxLiabilities.totalLiability = this.taxLiabilities.calculatedCorporateTax + this.taxLiabilities.calculatedPayrollTax;
        this.taxLiabilities.outstandingBalance = this.taxLiabilities.totalLiability - this.taxLiabilities.paidAmount;
    }
    next();
});

const TaxJurisdiction = mongoose.model('TaxJurisdiction', taxJurisdictionSchema);
const CorporateObligation = mongoose.model('CorporateObligation', corporateObligationSchema);

module.exports = {
    TaxJurisdiction,
    CorporateObligation
};
