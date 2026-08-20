/**
 * Actuarial assumptions and committed gratuity valuations (#1344).
 *
 * Two collections, and the split between them is the point.
 *
 * `GratuityAssumption` is current — one row per tenant, edited whenever the
 * discount rate moves. `GratuityValuation` is historic and immutable in
 * practice: it carries its own copy of the assumptions it was run under,
 * because a valuation is a number that gets reported, and a reported number has
 * to stay reconstructable after somebody edits the assumptions for the
 * following year. Storing a reference instead of a snapshot would let a
 * February edit silently rewrite what was disclosed in the prior March.
 */

const mongoose = require('mongoose');

const { DEFAULT_ASSUMPTIONS } = require('../utils/gratuityValuation');

/**
 * The assumption set, embedded rather than referenced for the reason above.
 *
 * `_id: false` — these are values, not entities. A sub-document id here would
 * be noise in every API response and would tempt somebody into treating a
 * snapshot as something that can be updated in place.
 */
const assumptionSetSchema = new mongoose.Schema(
  {
    discountRate: {
      type: Number,
      default: DEFAULT_ASSUMPTIONS.discountRate,
      min: -0.99,
      max: 1,
    },
    salaryEscalationRate: {
      type: Number,
      default: DEFAULT_ASSUMPTIONS.salaryEscalationRate,
      min: -0.5,
      max: 1,
    },
    attritionRate: {
      type: Number,
      default: DEFAULT_ASSUMPTIONS.attritionRate,
      min: 0,
      max: 0.99,
    },
    retirementAge: {
      type: Number,
      default: DEFAULT_ASSUMPTIONS.retirementAge,
      min: 40,
      max: 75,
    },
    expectedReturnOnPlanAssets: {
      type: Number,
      default: DEFAULT_ASSUMPTIONS.expectedReturnOnPlanAssets,
      min: -0.5,
      max: 1,
    },
    gratuityWageRatio: {
      type: Number,
      default: DEFAULT_ASSUMPTIONS.gratuityWageRatio,
      min: 0.01,
      max: 1,
    },
    funded: { type: Boolean, default: DEFAULT_ASSUMPTIONS.funded },
  },
  { _id: false },
);

const gratuityAssumptionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    assumptions: {
      type: assumptionSetSchema,
      default: () => ({}),
    },
    /**
     * Free text, and load-bearing at audit time. Ind AS 19 para 83 ties the
     * discount rate to the market yield on government securities of comparable
     * term, so "why 7.15%" has an answer and it belongs next to the number.
     */
    basisNote: {
      type: String,
      default: '',
      maxlength: [2000, 'Basis note cannot exceed 2000 characters'],
    },
    /** Who last changed the assumptions. An audit fact, not a scoping key. */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

/**
 * One row of the per-employee schedule that produced the total.
 *
 * Stored rather than recomputed on read for the same reason the assumptions
 * are snapshotted: the workforce changes. A valuation whose schedule is
 * regenerated from today's headcount is not the valuation that was reported,
 * and the difference shows up as an unexplained movement in next year's
 * roll-forward.
 */
const valuationLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    department: { type: String, default: '' },
    joiningDate: { type: Date },
    pastServiceYears: { type: Number, default: 0 },
    ageYears: { type: Number, default: null },
    ageAssumed: { type: Boolean, default: false },
    monthlySalary: { type: Number, default: 0 },
    gratuityWage: { type: Number, default: 0 },
    vested: { type: Boolean, default: false },
    definedBenefitObligation: { type: Number, default: 0 },
    currentServiceCost: { type: Number, default: 0 },
    expectedBenefitAtExit: { type: Number, default: 0 },
    ceilingApplied: { type: Boolean, default: false },
  },
  { _id: false },
);

const sensitivityLineSchema = new mongoose.Schema(
  {
    assumption: { type: String, required: true },
    shift: { type: Number, required: true },
    direction: { type: String, enum: ['increase', 'decrease'], required: true },
    definedBenefitObligation: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    changePercent: { type: Number, default: 0 },
  },
  { _id: false },
);

const gratuityValuationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    /**
     * The reporting date the valuation is *as at* — typically 31 March. Not
     * `createdAt`: a valuation is routinely run in May for the March position,
     * and sorting history by when somebody pressed the button would put the
     * years in the wrong order.
     */
    valuationDate: { type: Date, required: true },
    /** Label for the period, e.g. "FY 2025-26". Display only. */
    periodLabel: { type: String, default: '' },

    assumptions: { type: assumptionSetSchema, required: true },
    basisNote: { type: String, default: '' },

    headcountValued: { type: Number, default: 0 },
    headcountSkipped: { type: Number, default: 0 },
    recordsWithAssumedAge: { type: Number, default: 0 },

    definedBenefitObligation: { type: Number, required: true },
    currentServiceCost: { type: Number, default: 0 },
    vestedObligation: { type: Number, default: 0 },
    unvestedObligation: { type: Number, default: 0 },
    expenseForPeriod: { type: Number, default: 0 },

    rollForward: {
      openingDbo: { type: Number, default: 0 },
      currentServiceCost: { type: Number, default: 0 },
      pastServiceCost: { type: Number, default: 0 },
      interestCost: { type: Number, default: 0 },
      benefitsPaid: { type: Number, default: 0 },
      expectedClosingDbo: { type: Number, default: 0 },
      closingDbo: { type: Number, default: 0 },
      actuarialGainLoss: { type: Number, default: 0 },
      experienceAdjustment: { type: Number, default: null },
      assumptionChange: { type: Number, default: null },
      outcome: { type: String, enum: ['gain', 'loss'], default: 'loss' },
    },

    fundedStatus: {
      openingPlanAssets: { type: Number, default: 0 },
      contributions: { type: Number, default: 0 },
      benefitsPaidFromFund: { type: Number, default: 0 },
      expectedReturn: { type: Number, default: 0 },
      actualReturn: { type: Number, default: 0 },
      actuarialGainOnAssets: { type: Number, default: 0 },
      closingPlanAssets: { type: Number, default: 0 },
      netLiability: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['deficit', 'surplus'],
        default: 'deficit',
      },
      funded: { type: Boolean, default: false },
    },

    sensitivities: { type: [sensitivityLineSchema], default: [] },
    schedule: { type: [valuationLineSchema], default: [] },
    skipped: {
      type: [
        new mongoose.Schema(
          {
            employeeId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Employee',
            },
            name: { type: String, default: '' },
            reason: { type: String, default: '' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

/**
 * One committed valuation per tenant per reporting date.
 *
 * Re-running March 2026 should replace March 2026, not sit alongside it —
 * two valuations for one date is two answers to "what did we report", and the
 * controller upserts on this key rather than inserting so the question stays
 * answerable.
 */
gratuityValuationSchema.index(
  { tenantId: 1, valuationDate: 1 },
  { unique: true },
);

/** History is read newest first, which is the only way this is ever listed. */
gratuityValuationSchema.index({ tenantId: 1, valuationDate: -1 });

const GratuityAssumption = mongoose.model(
  'GratuityAssumption',
  gratuityAssumptionSchema,
);
const GratuityValuation = mongoose.model(
  'GratuityValuation',
  gratuityValuationSchema,
);

module.exports = { GratuityAssumption, GratuityValuation };
