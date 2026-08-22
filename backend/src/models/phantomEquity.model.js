/**
 * @fileoverview Phantom Equity & SAR Schemas
 * @description Tracks phantom unit grants, company valuation events, and cash settlements.
 * Issue: #1474
 */
const mongoose = require('mongoose');

/**
 * PhantomGrant Schema
 * Tracks unit allocations, strike prices, and vesting cliffs for an employee.
 */
const phantomGrantSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    grantDate: { type: Date, required: true },
    totalUnits: { type: Number, required: true, min: 0 },
    strikePrice: { type: Number, required: true, min: 0 }, // Valuation per unit at grant date

    // Vesting Configuration
    vestingCliffMonths: { type: Number, default: 12 }, // e.g., 1 year cliff
    vestingDurationMonths: { type: Number, default: 48 }, // e.g., 4 years total
    vestedUnits: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Unvested', 'Vesting', 'Fully Vested', 'Settled', 'Cancelled'],
        default: 'Unvested',
        index: true
    }
}, { timestamps: true });

const PhantomGrant = mongoose.model('PhantomGrant', phantomGrantSchema);

/**
 * ValuationEvent Schema
 * Tracks historical company valuations (e.g., funding rounds, 409A valuations).
 */
const valuationEventSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    eventDate: { type: Date, required: true, unique: true },
    valuationType: { type: String, enum: ['409A', 'Funding Round', 'Board Approved', 'Acquisition'], required: true },
    pricePerUnit: { type: Number, required: true, min: 0 },
    notes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const ValuationEvent = mongoose.model('ValuationEvent', valuationEventSchema);

/**
 * CashSettlement Schema
 * Tracks the payout of vested phantom units during a liquidity event.
 */
const cashSettlementSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: 'PhantomGrant', required: true, index: true },
    valuationEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'ValuationEvent', required: true },

    unitsSettled: { type: Number, required: true },
    appreciationPerUnit: { type: Number, required: true }, // Current Price - Strike Price

    grossPayout: { type: Number, required: true },
    grossUpAmount: { type: Number, default: 0 }, // Additional gross to cover tax burden
    totalPayrollInjection: { type: Number, required: true }, // Gross + Gross-Up

    taxWithheld: { type: Number, required: true },
    netPayout: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Calculated', 'Approved', 'Paid via Payroll'],
        default: 'Calculated',
        index: true
    }
}, { timestamps: true });

const CashSettlement = mongoose.model('CashSettlement', cashSettlementSchema);

module.exports = { PhantomGrant, ValuationEvent, CashSettlement };
