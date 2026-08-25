/**
 * @fileoverview Global Mobility & Shadow Payroll Schemas
 * @description Tracks international assignments, shadow payroll runs, 
 * tax equalization baselines, and COLA adjustments.
 * Issue: #1471
 */
const mongoose = require('mongoose');

/**
 * InternationalAssignment Schema
 * Tracks the duration, host/home jurisdictions, and cost of living adjustments for an expat.
 */
const internationalAssignmentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    homeCountry: { type: String, required: true },
    homeCurrency: { type: String, required: true },
    hostCountry: { type: String, required: true },
    hostCurrency: { type: String, required: true },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Tax Equalization Baseline
    hypotheticalTaxRate: { type: Number, required: true, min: 0, max: 1 }, // e.g., 0.30 for 30%
    baseSalaryHome: { type: Number, required: true }, // Base salary in home currency

    // Cost of Living Adjustment (COLA)
    colaIndex: { type: Number, default: 1.0, min: 0 }, // e.g., 1.25 for 25% higher cost of living
    colaAllowance: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Active', 'Completed', 'Cancelled', 'Extended'],
        default: 'Active',
        index: true
    }
}, { timestamps: true });

const InternationalAssignment = mongoose.model('InternationalAssignment', internationalAssignmentSchema);

/**
 * ShadowPayrollRun Schema
 * Represents the payroll processed in the host country to comply with local tax laws.
 */
const shadowPayrollRunSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternationalAssignment', required: true, index: true },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Host Country Financials
    hostGrossPay: { type: Number, required: true },
    hostTaxDeducted: { type: Number, required: true },
    hostSocialSecurity: { type: Number, required: true },
    hostNetPay: { type: Number, required: true },

    // Exchange Rate used for reconciliation
    exchangeRate: { type: Number, required: true }, // Host to Home

    status: {
        type: String,
        enum: ['Draft', 'Finalized', 'Reconciled'],
        default: 'Draft'
    }
}, { timestamps: true });

shadowPayrollRunSchema.index({ assignmentId: 1, year: 1, month: 1 }, { unique: true });
const ShadowPayrollRun = mongoose.model('ShadowPayrollRun', shadowPayrollRunSchema);

/**
 * TaxEqualization Schema
 * Tracks the hypothetical tax deducted from the home payroll to equalize the tax burden.
 */
const taxEqualizationSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternationalAssignment', required: true, index: true },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    hypotheticalTaxAmount: { type: Number, required: true }, // Deducted from home payroll
    actualHostTaxPaid: { type: Number, required: true }, // Paid by company in host country (converted to home currency)

    // The difference is borne by the company (Tax Equalization Cost)
    companyTaxCost: { type: Number, required: true },

    isInjectedToPayroll: { type: Boolean, default: false },
    payrollRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollUpdate', default: null }
}, { timestamps: true });

taxEqualizationSchema.index({ assignmentId: 1, year: 1, month: 1 }, { unique: true });
const TaxEqualization = mongoose.model('TaxEqualization', taxEqualizationSchema);

module.exports = { InternationalAssignment, ShadowPayrollRun, TaxEqualization };
