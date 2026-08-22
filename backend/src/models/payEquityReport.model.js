/**
 * Committed pay equity reports (#1347).
 *
 * A gap report is only useful as a series. The single most-asked question about
 * one is "is it getting better", and that needs last year's figure measured on
 * last year's headcount — so a report is stored with its options and its
 * results rather than regenerated on demand from a workforce that has since
 * changed.
 *
 * It is also, in several jurisdictions, a published figure. A published figure
 * has to stay reconstructable, which is the same reason
 * `gratuityValuation.model.js` snapshots its assumptions.
 *
 * What is deliberately *not* stored: any per-employee demographic row. The
 * cohort tables hold counts and medians, the compa-ratio outliers hold pay and
 * no protected characteristic, and nothing here reconstructs an individual's
 * declared gender. A pay gap report that becomes a second copy of the sensitive
 * data it was computed from is a liability rather than an asset.
 */

const mongoose = require('mongoose');

const { SUPPRESSION } = require('../utils/payEquity');

/** One pay quartile and its composition. */
const quartileSchema = new mongoose.Schema(
  {
    quartile: { type: Number, required: true },
    label: { type: String, default: '' },
    headcount: { type: Number, default: 0 },
    lowestPay: { type: Number, default: 0 },
    highestPay: { type: Number, default: 0 },
    /** Group name to headcount. A Map so a tenant is not limited to two groups. */
    composition: { type: Map, of: Number, default: () => new Map() },
    proportions: { type: Map, of: Number, default: () => new Map() },
  },
  { _id: false },
);

/** One group's gap against the reference group, within a cohort or overall. */
const gapSchema = new mongoose.Schema(
  {
    group: { type: String, required: true },
    headcount: { type: Number, default: 0 },
    referenceHeadcount: { type: Number, default: 0 },
    suppressed: { type: Boolean, default: false },
    suppressionReason: {
      type: String,
      enum: [...Object.values(SUPPRESSION), null],
      default: null,
    },
    suppressionMessage: { type: String, default: '' },
    referenceMean: { type: Number, default: 0 },
    referenceMedian: { type: Number, default: 0 },
    comparisonMean: { type: Number, default: 0 },
    comparisonMedian: { type: Number, default: 0 },
    meanGap: { type: Number, default: 0 },
    medianGap: { type: Number, default: 0 },
    material: { type: Boolean, default: false },
  },
  { _id: false },
);

const cohortSchema = new mongoose.Schema(
  {
    cohortKey: { type: String, required: true },
    jobLevel: { type: String, default: '' },
    department: { type: String, default: '' },
    tenureBand: { type: String, default: '' },
    tenureBandLabel: { type: String, default: '' },
    headcount: { type: Number, default: 0 },
    medianPay: { type: Number, default: 0 },
    referenceHeadcount: { type: Number, default: 0 },
    suppressed: { type: Boolean, default: false },
    suppressionReason: {
      type: String,
      enum: [...Object.values(SUPPRESSION), null],
      default: null,
    },
    suppressionMessage: { type: String, default: '' },
    material: { type: Boolean, default: false },
    comparisons: { type: [gapSchema], default: [] },
  },
  { _id: false },
);

const remediationActionSchema = new mongoose.Schema(
  {
    cohortKey: { type: String, required: true },
    jobLevel: { type: String, default: '' },
    department: { type: String, default: '' },
    tenureBandLabel: { type: String, default: '' },
    group: { type: String, required: true },
    currentMedianGap: { type: Number, default: 0 },
    targetMedianGap: { type: Number, default: 0 },
    employeesAffected: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    annualCost: { type: Number, default: 0 },
  },
  { _id: false },
);

const payEquityReportSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The snapshot date the report is as at — the headcount it measured. */
    asOf: { type: Date, required: true },
    periodLabel: { type: String, default: '' },

    /**
     * The options the report was run under, snapshotted for the same reason the
     * gratuity assumptions are: raising the suppression floor next year must not
     * silently restate what was published this year.
     */
    options: {
      minimumCohortSize: { type: Number, default: 5 },
      materialGapThreshold: { type: Number, default: 0.05 },
      referenceGroup: { type: String, default: 'male' },
      quartileCount: { type: Number, default: 4 },
    },

    headcount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },

    /** Group name to headcount, including `undisclosed`. */
    groupCounts: { type: Map, of: Number, default: () => new Map() },

    demographics: {
      usable: { type: Boolean, default: false },
      disclosed: { type: Number, default: 0 },
      undisclosed: { type: Number, default: 0 },
      message: { type: String, default: '' },
    },

    /** The whole-workforce gap per group. */
    headline: { type: [gapSchema], default: [] },
    quartiles: { type: [quartileSchema], default: [] },
    cohorts: { type: [cohortSchema], default: [] },
    materialCohorts: { type: Number, default: 0 },
    suppressedCohorts: { type: Number, default: 0 },

    compaSummary: {
      covered: { type: Number, default: 0 },
      uncovered: { type: Number, default: 0 },
      medianCompaRatio: { type: Number, default: 0 },
      belowBand: { type: Number, default: 0 },
      aboveBand: { type: Number, default: 0 },
      underMidpointBy20Percent: { type: Number, default: 0 },
    },

    remediation: {
      actions: { type: [remediationActionSchema], default: [] },
      employeesAffected: { type: Number, default: 0 },
      monthlyCost: { type: Number, default: 0 },
      annualCost: { type: Number, default: 0 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

/** One report per tenant per snapshot date; re-running a date corrects it. */
payEquityReportSchema.index({ tenantId: 1, asOf: 1 }, { unique: true });

/** The trend query, which is the only way this is ever listed. */
payEquityReportSchema.index({ tenantId: 1, asOf: -1 });

/**
 * A salary band for a job level.
 *
 * Introduced here because compa-ratio needs one and the product did not have
 * one. `salaryStructure.model.js` is per *employee* — it records what a given
 * person's package is made of and what it was revised from — which is a
 * different thing from "what the range for an L4 engineer is". There was no
 * model anywhere in the tree holding the second, and `CompensationBandCard.tsx`
 * on the frontend has been rendering a band it had no source for.
 *
 * Kept small on purpose. This is the minimum a compa-ratio needs, not an
 * attempt at a compensation planning module.
 */
const payBandSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    /** Matches `employee.jobLevel`. The join key for the whole analysis. */
    jobLevel: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, default: '', trim: true, maxlength: 120 },
    minSalary: { type: Number, required: true, min: 0 },
    maxSalary: { type: Number, required: true, min: 0 },
    /**
     * Optional. Most bands are symmetric and the midpoint is `(min + max) / 2`,
     * but a deliberately skewed band is a real thing — a wide senior band with
     * the midpoint set low so that reaching it is not automatic — and deriving
     * it would silently overwrite that decision.
     */
    midpoint: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'INR', trim: true, maxlength: 8 },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

/**
 * A band with `max` below `min` is not a band, and the compa-ratio it produces
 * is a negative range penetration that reads as a compensation finding rather
 * than as the data entry error it is.
 */
payBandSchema.pre('validate', function validateBandWidth(next) {
  if (
    Number.isFinite(this.minSalary) &&
    Number.isFinite(this.maxSalary) &&
    this.maxSalary < this.minSalary
  ) {
    return next(
      new Error('maxSalary must be greater than or equal to minSalary'),
    );
  }

  return next();
});

payBandSchema.index({ tenantId: 1, jobLevel: 1 }, { unique: true });

const PayEquityReport = mongoose.model(
  'PayEquityReport',
  payEquityReportSchema,
);
const PayBand = mongoose.model('PayBand', payBandSchema);

module.exports = { PayEquityReport, PayBand };
