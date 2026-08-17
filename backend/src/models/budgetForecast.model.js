/**
 * @fileoverview Budget Forecast & Scenario Schemas
 * @description Stores "What-If" scenario models for payroll cash flow projections.
 * Includes assumptions for increments, statutory hikes, and future headcount planning.
 * Issue: #985
 */
const mongoose = require('mongoose');

/**
 * Hiring Plan Sub-schema
 * Defines projected future hires ("Ghost Employees") by department and month.
 */
const hiringPlanSchema = new mongoose.Schema({
    department: { type: String, required: true },
    estimatedMonthlySalary: { type: Number, required: true, min: 0 },
    hireMonth: { type: Number, required: true, min: 1, max: 12 }, // 1-12 relative to forecast start
    headcount: { type: Number, required: true, min: 1 },
}, { _id: false });

const budgetForecastSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g., "Aggressive Growth 2026"
    description: { type: String, default: '' },

    // Scenario Assumptions
    companyWideIncrementPercent: { type: Number, default: 0, min: 0, max: 100 },
    incrementEffectiveMonth: { type: Number, default: 4, min: 1, max: 12 }, // Month number when increment applies (e.g., April = 4)

    // Statutory Assumptions
    includeEmployerPF: { type: Boolean, default: true }, // 12% of Basic
    includeEmployerESI: { type: Boolean, default: true }, // 3.25% of Gross (if eligible)

    // Headcount Planning
    hiringPlan: [hiringPlanSchema],

    // Projected Results (Cached after calculation)
    projectedMonthlyCashflow: [{
        month: { type: Number, required: true },
        year: { type: Number, required: true },
        totalPayrollCost: { type: Number, required: true },
        employeeCount: { type: Number, required: true },
        employerStatutoryCost: { type: Number, required: true }
    }],

    totalAnnualProjectedCost: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isBaseline: { type: Boolean, default: false } // Is this the current approved budget?
}, { timestamps: true });

budgetForecastSchema.index({ tenantId: 1, isBaseline: 1 });

module.exports = mongoose.model('BudgetForecast', budgetForecastSchema);
