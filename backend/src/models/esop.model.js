/**
 * @fileoverview ESOP scheme, grant and exercise schemas.
 * @description Equity was the one component of total compensation PaySphere did
 * not model. Base pay, arrears, loans, reimbursements, increments and the full &
 * final settlement all had schemas; options had none.
 *
 * Issue: #1073
 *
 * `EsopExercise` is append-only by design. An exercise is a taxable event with a
 * perquisite value and a TDS figure that were reported to the tax authority for
 * a particular assessment year; correcting one by editing the row would leave
 * the filing and the record disagreeing with each other and no trace of which
 * came first. A mistaken exercise is reversed by recording a reversal, the same
 * way `journalEntry.model.js` handles a bad posting.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const {
  VESTING_FREQUENCIES,
  GRANT_STATUS,
} = require('../utils/vestingCalculator');

const esopSchemeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /**
     * Options the board authorised the scheme to issue.
     *
     * Not a running balance. `summarisePool` derives what is left from the
     * grants, because forfeited options return to the pool and a counter
     * maintained by hand goes wrong the first time a grant is cancelled.
     */
    authorisedPool: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },

    // Defaults a grant inherits when it does not state its own terms. Held on
    // the scheme so a company changing its standard vesting affects new grants
    // and leaves existing ones alone.
    defaultCliffMonths: { type: Number, default: 12, min: 0, max: 120 },
    defaultVestingDurationMonths: {
      type: Number,
      default: 48,
      min: 1,
      max: 240,
    },
    defaultVestingFrequency: {
      type: String,
      enum: Object.keys(VESTING_FREQUENCIES),
      default: 'monthly',
    },

    /**
     * How long a leaver has to exercise vested options before they lapse.
     *
     * Zero is legal and means "vested options lapse on the exit date". It is a
     * real policy some schemes run, so it is not treated as unset.
     */
    postTerminationExerciseWindowDays: {
      type: Number,
      default: 90,
      min: 0,
      max: 3650,
    },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

esopSchemeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const esopGrantSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    schemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EsopScheme',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    /** Board-resolution or letter reference. Unique per tenant. */
    grantReference: { type: String, required: true, trim: true, maxlength: 60 },

    optionsGranted: { type: Number, required: true, min: 1 },

    /**
     * Strike price per share.
     *
     * Zero is permitted: RSU-style grants at nil consideration exist, and under
     * s.17(2)(vi) they simply make the whole FMV the perquisite. Rejecting zero
     * here would force those grants to be recorded as something they are not.
     */
    exercisePrice: { type: Number, required: true, min: 0 },

    grantDate: { type: Date, required: true },
    /** Vesting usually starts at the grant date, but not always — a joiner's
     *  grant is often backdated to their start date. Defaults are applied in the
     *  controller so the two dates stay independently recorded. */
    vestingStartDate: { type: Date, required: true },

    cliffMonths: { type: Number, default: 12, min: 0, max: 120 },
    vestingDurationMonths: { type: Number, default: 48, min: 1, max: 240 },
    vestingFrequency: {
      type: String,
      enum: Object.keys(VESTING_FREQUENCIES),
      default: 'monthly',
    },

    // Derived counters, maintained by the controller as exercises and
    // forfeitures are recorded. The authoritative vested figure is always
    // recomputed from the schedule; these two are the facts that cannot be
    // derived from dates alone.
    optionsExercised: { type: Number, default: 0, min: 0 },
    optionsForfeited: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(GRANT_STATUS),
      default: GRANT_STATUS.ACTIVE,
      index: true,
    },

    forfeitedOn: { type: Date, default: null },
    exerciseWindowClosesOn: { type: Date, default: null },

    notes: { type: String, default: '', maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

esopGrantSchema.index({ tenantId: 1, grantReference: 1 }, { unique: true });
esopGrantSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

/**
 * Options still outstanding under this grant.
 *
 * A virtual rather than a stored field so it cannot drift from the two counters
 * it is derived from.
 */
esopGrantSchema.virtual('optionsOutstanding').get(function outstanding() {
  return Math.max(
    0,
    (this.optionsGranted || 0) -
      (this.optionsExercised || 0) -
      (this.optionsForfeited || 0),
  );
});

esopGrantSchema.set('toJSON', { virtuals: true });
esopGrantSchema.set('toObject', { virtuals: true });

const esopExerciseSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    grantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EsopGrant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    exerciseDate: { type: Date, required: true },
    optionsExercised: { type: Number, required: true, min: 1 },

    /**
     * Fair market value per share on the exercise date.
     *
     * Stored on the exercise rather than looked up later, because the valuation
     * used at the time is what the perquisite was computed from and what was
     * filed. A subsequent revaluation must not retroactively change a return
     * that has already been submitted.
     */
    fmvPerShare: { type: Number, required: true, min: 0 },
    exercisePrice: { type: Number, required: true, min: 0 },

    perquisiteValue: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, required: true, min: 0, max: 100 },
    tdsWithheld: { type: Number, required: true, min: 0 },
    exerciseCost: { type: Number, required: true, min: 0 },
    capitalGainsCostBasis: { type: Number, required: true, min: 0 },

    /** The payroll run the perquisite and TDS were pushed into, once it is
     *  known. Null until the month is processed. */
    payrollMonth: { type: Number, default: null, min: 1, max: 12 },
    payrollYear: { type: Number, default: null, min: 2000, max: 2100 },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

esopExerciseSchema.index({ tenantId: 1, employeeId: 1, exerciseDate: -1 });

/**
 * Append-only.
 *
 * `findOneAndUpdate` and friends bypass document middleware, so the guard is
 * registered on both hook families. Without the query hook the block is
 * decorative: `EsopExercise.updateOne(...)` would sail straight past it.
 */
function refuseMutation(next) {
  next(
    new Error(
      'EsopExercise records are immutable. Record a reversing entry instead of editing a filed exercise.',
    ),
  );
}

esopExerciseSchema.pre('save', function guardUpdate(next) {
  if (this.isNew) return next();
  return refuseMutation(next);
});

for (const hook of ['updateOne', 'findOneAndUpdate', 'updateMany']) {
  esopExerciseSchema.pre(hook, function guardQueryUpdate(next) {
    refuseMutation(next);
  });
}

esopGrantSchema.plugin(auditTrailPlugin);

const EsopScheme = mongoose.model('EsopScheme', esopSchemeSchema);
const EsopGrant = mongoose.model('EsopGrant', esopGrantSchema);
const EsopExercise = mongoose.model('EsopExercise', esopExerciseSchema);

module.exports = { EsopScheme, EsopGrant, EsopExercise };
