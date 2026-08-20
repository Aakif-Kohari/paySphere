/**
 * International assignments (#1348).
 *
 * The record the product did not have. `corporateEntity.model.js` holds the
 * legal entities and nothing linked an employee to *two* of them, which is what
 * an assignment is: home entity, host entity, and a set of arrangements between
 * them that outlive any single trip.
 *
 * Two things are stored rather than derived, and both for the same reason as
 * the gratuity and bonus modules: the figures here are reported and settled
 * against, so a later change to a tax table must not restate what was agreed.
 * The tax tables used for a settlement are snapshotted onto the settlement, and
 * the cost projection is stored as it was approved.
 */

const mongoose = require('mongoose');

const {
  TAX_APPROACH,
  ASSIGNMENT_TYPE,
  MEASUREMENT_PERIOD,
  ASSIGNMENT_ALLOWANCES,
} = require('../utils/taxEqualization');

/**
 * The allowance stack.
 *
 * Explicit fields rather than a free map, because each of these is treated
 * differently by the tax rules and by the cost projection, and a map invites a
 * typo to become a silently-ignored ₹18 lakh housing line.
 */
const allowanceSchema = new mongoose.Schema(
  ASSIGNMENT_ALLOWANCES.reduce((schema, key) => {
    schema[key] = { type: Number, default: 0, min: 0 };
    return schema;
  }, {}),
  { _id: false },
);

/**
 * One period of physical presence in the host country.
 *
 * Arrival and departure rather than a duration, because the treaty counts
 * *days present* and both endpoint days count. A duration in nights would lose
 * exactly the two days per trip that the count turns on.
 */
const presencePeriodSchema = new mongoose.Schema(
  {
    arrival: { type: Date, required: true },
    departure: { type: Date, default: null },
    purpose: { type: String, default: '', maxlength: 200 },
  },
  { _id: false },
);

const assignmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    assignmentType: {
      type: String,
      enum: Object.values(ASSIGNMENT_TYPE),
      required: true,
    },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'active', 'completed', 'cancelled'],
      default: 'proposed',
      index: true,
    },

    // --- Where -------------------------------------------------------------

    homeEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CorporateEntity',
      default: null,
    },
    hostEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CorporateEntity',
      default: null,
    },
    homeCountry: { type: String, required: true, trim: true, maxlength: 60 },
    hostCountry: { type: String, required: true, trim: true, maxlength: 60 },
    homeCurrency: { type: String, default: 'INR', trim: true, maxlength: 8 },
    hostCurrency: { type: String, default: 'USD', trim: true, maxlength: 8 },

    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },

    // --- The arrangement ---------------------------------------------------

    taxApproach: {
      type: String,
      enum: Object.values(TAX_APPROACH),
      default: TAX_APPROACH.EQUALIZATION,
    },
    /**
     * The percentage of pay delivered on the host payroll. The remainder stays
     * on the home payroll, which is the usual arrangement and the reason the
     * employee is still in this product at all.
     */
    hostPayrollPercent: { type: Number, default: 0, min: 0, max: 100 },

    homeBaseSalary: { type: Number, required: true, min: 0 },
    homeBonus: { type: Number, default: 0, min: 0 },
    otherHomeCompensation: { type: Number, default: 0, min: 0 },
    allowances: { type: allowanceSchema, default: () => ({}) },

    /**
     * Which measurement period the treaty's 183-day test runs over, and the
     * threshold itself. Both are treaty-specific — the article is not identical
     * across treaties and assuming a calendar year is wrong more often than it
     * is right.
     */
    measurementPeriod: {
      type: String,
      enum: Object.values(MEASUREMENT_PERIOD),
      default: MEASUREMENT_PERIOD.ROLLING_12_MONTHS,
    },
    treatyDayThreshold: { type: Number, default: 183, min: 1, max: 366 },

    presencePeriods: { type: [presencePeriodSchema], default: [] },

    // --- The approved cost -------------------------------------------------

    /**
     * The projection as it was approved, kept so "what did we say this would
     * cost" survives a later edit to the allowance stack.
     */
    approvedCost: {
      totalCost: { type: Number, default: 0 },
      costMultiple: { type: Number, default: 0 },
      hypotheticalTaxCredit: { type: Number, default: 0 },
      employerBorneTax: { type: Number, default: 0 },
      approvedAt: { type: Date, default: null },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },

    notes: { type: String, default: '', maxlength: 2000 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

/**
 * An assignment that ends before it starts is a data entry error, and one that
 * gets past validation produces a negative day-count window that reads as
 * "never present" rather than as a mistake.
 */
assignmentSchema.pre('validate', function validateDates(next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    return next(new Error('endDate cannot be before startDate'));
  }
  return next();
});

assignmentSchema.index({ tenantId: 1, employeeId: 1, startDate: -1 });
assignmentSchema.index({ tenantId: 1, status: 1, startDate: -1 });

/**
 * A year-end tax equalization settlement.
 *
 * Separate from the assignment because there is one per tax year and an
 * assignment routinely spans three. The tax tables are snapshotted here for the
 * reason given at the top of the file.
 */
const equalizationSettlementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    taxYear: { type: Number, required: true },

    stayAtHomeCompensation: { type: Number, default: 0 },
    hypoTaxableIncome: { type: Number, default: 0 },
    hypotheticalTax: { type: Number, default: 0 },
    hypoTaxWithheld: { type: Number, default: 0 },

    actualHomeTax: { type: Number, default: 0 },
    actualHostTax: { type: Number, default: 0 },
    actualTotalTax: { type: Number, default: 0 },

    employeeBears: { type: Number, default: 0 },
    employerBears: { type: Number, default: 0 },

    /** Positive: the employee owes the company. Negative: the reverse. */
    settlement: { type: Number, default: 0 },
    settlementDirection: {
      type: String,
      enum: ['employee_owes_company', 'company_owes_employee', 'settled'],
      default: 'settled',
    },
    approach: {
      type: String,
      enum: Object.values(TAX_APPROACH),
      default: TAX_APPROACH.EQUALIZATION,
    },
    note: { type: String, default: '' },

    /** The tables the figures above were computed on. */
    homeTaxTable: { type: mongoose.Schema.Types.Mixed, default: [] },
    hostTaxTable: { type: mongoose.Schema.Types.Mixed, default: [] },

    presenceDays: { type: Number, default: 0 },
    treatyStatus: {
      type: String,
      enum: ['within', 'approaching', 'exceeded'],
      default: 'within',
    },

    settledOn: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

/** One settlement per assignment per tax year; re-running a year corrects it. */
equalizationSettlementSchema.index(
  { tenantId: 1, assignmentId: 1, taxYear: 1 },
  { unique: true },
);

const Assignment = mongoose.model('Assignment', assignmentSchema);
const EqualizationSettlement = mongoose.model(
  'EqualizationSettlement',
  equalizationSettlementSchema,
);

module.exports = { Assignment, EqualizationSettlement };
