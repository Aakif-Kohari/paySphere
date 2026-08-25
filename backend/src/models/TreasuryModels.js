import mongoose from 'mongoose';

const currencyWalletSchema = new mongoose.Schema({
    walletId: {
        type: String,
        required: true,
        unique: true
    },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'GBP', 'INR', 'SGD', 'AUD', 'AED', 'JPY', 'CAD', 'CHF'],
        required: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0
    },
    reservedBalance: {
        type: Number,
        required: true,
        default: 0,
        description: 'Funds locked for upcoming payroll execution'
    },
    organizationId: {
        type: String,
        required: true
    },
    lastReconciledAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const forexTradeSchema = new mongoose.Schema({
    tradeId: {
        type: String,
        required: true,
        unique: true
    },
    organizationId: {
        type: String,
        required: true
    },
    sourceCurrency: {
        type: String,
        required: true
    },
    targetCurrency: {
        type: String,
        required: true
    },
    amountSold: {
        type: Number,
        required: true
    },
    amountBought: {
        type: Number,
        required: true
    },
    exchangeRate: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'EXECUTED', 'SETTLED', 'FAILED'],
        default: 'PENDING'
    },
    executedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    settlementDate: {
        type: Date
    },
    complianceNotes: {
        type: String
    }
}, {
    timestamps: true
});

const liquidityForecastSchema = new mongoose.Schema({
    forecastId: {
        type: String,
        required: true,
        unique: true
    },
    organizationId: {
        type: String,
        required: true
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    horizonDays: {
        type: Number,
        default: 90
    },
    currencyProjections: [{
        currency: String,
        currentBalance: Number,
        projectedInflow: Number,
        projectedPayrollOutflow: Number,
        netPosition: Number,
        riskLevel: {
            type: String,
            enum: ['SURPLUS', 'STABLE', 'DEFICIT_WARNING', 'CRITICAL_SHORTFALL']
        }
    }]
}, {
    timestamps: true
});

export const CurrencyWallet = mongoose.model('CurrencyWallet', currencyWalletSchema);
export const ForexTrade = mongoose.model('ForexTrade', forexTradeSchema);
export const LiquidityForecast = mongoose.model('LiquidityForecast', liquidityForecastSchema);
