/**
 * @fileoverview Recognition & Kudos Ledger Schemas
 * @description Manages peer-to-peer recognition points, monthly allowances, 
 * carry-over limits, and redemption history for payroll bonuses.
 * Issue: #1084
 */
const mongoose = require('mongoose');

const recognitionConfigSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
    monthlyAllowance: { type: Number, default: 100, min: 0 }, // Points given to each employee monthly
    maxCarryOver: { type: Number, default: 50, min: 0 }, // Max points that roll over to next month
    redemptionRate: { type: Number, default: 10, min: 1 }, // 1 Currency Unit = X Points
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const RecognitionConfig = mongoose.model('RecognitionConfig', recognitionConfigSchema);

const kudosLedgerSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    points: { type: Number, required: true, min: 1 },
    message: { type: String, required: true, maxlength: 500 },
    isPublic: { type: Boolean, default: true },
    transactionType: {
        type: String,
        enum: ['Allowance', 'PeerAward', 'Redemption', 'AdminAdjustment'],
        required: true
    }
}, { timestamps: true });

kudosLedgerSchema.index({ tenantId: 1, createdAt: -1 });
const KudosLedger = mongoose.model('KudosLedger', kudosLedgerSchema);

const kudosBalanceSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    availablePoints: { type: Number, default: 0, min: 0 },
    lifetimeEarned: { type: Number, default: 0, min: 0 },
    lifetimeRedeemed: { type: Number, default: 0, min: 0 },
    lastRefreshDate: { type: Date, default: Date.now }
}, { timestamps: true });

const KudosBalance = mongoose.model('KudosBalance', kudosBalanceSchema);

module.exports = { RecognitionConfig, KudosLedger, KudosBalance };
