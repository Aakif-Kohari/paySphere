const mongoose = require('mongoose');

const EquityGrantSchema = new mongoose.Schema({
    grantId: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true, index: true },
    department: { type: String, required: true },
    grantType: { type: String, enum: ['RSU', 'STOCK_OPTIONS', 'PERFORMANCE_SHARES'], required: true },

    // Financials
    totalShares: { type: Number, required: true },
    strikePrice: { type: Number, default: 0 }, // For options
    grantPrice: { type: Number, required: true }, // FMV at time of grant
    currency: { type: String, default: 'USD' },

    // Vesting Rules
    vestingStartDate: { type: Date, required: true },
    cliffPeriodMonths: { type: Number, default: 12 },
    vestingPeriodMonths: { type: Number, default: 48 }, // e.g. 4 year vest
    vestingFrequency: { type: String, enum: ['MONTHLY', 'QUARTERLY', 'ANNUALLY'], default: 'MONTHLY' },
    status: { type: String, enum: ['ACTIVE', 'FULLY_VESTED', 'CANCELLED'], default: 'ACTIVE' },

    // Tracking
    vestedShares: { type: Number, default: 0 },
    exercisedShares: { type: Number, default: 0 },
    cancelledShares: { type: Number, default: 0 }
}, { timestamps: true });

const CompanyStockValuationSchema = new mongoose.Schema({
    valuationDate: { type: Date, required: true, unique: true },
    fairMarketValue: { type: Number, required: true }, // The 409A valuation or public stock price
    currency: { type: String, default: 'USD' }
});

EquityGrantSchema.index({ employeeId: 1, status: 1 });
EquityGrantSchema.index({ department: 1 });

module.exports = {
    EquityGrant: mongoose.model('EquityGrant', EquityGrantSchema),
    CompanyStockValuation: mongoose.model('CompanyStockValuation', CompanyStockValuationSchema)
};
