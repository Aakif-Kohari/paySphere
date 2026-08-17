/**
 * @fileoverview ESOP scheme, grant, exercise, and tender offer schemas.
 * @description Models options schemes, vesting schedules, exercise valuations, and secondary sale tender offers.
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
    authorisedPool: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },

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
    postTerminationExerciseWindowDays: {
      type: Number,
      default: 90,
      min: 0,
      max: 3650,
    },
  },
  { timestamps: true },
);

esopSchemeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const vestingTrancheSchema = new mongoose.Schema(
  {
    trancheIndex: { type: Number, required: true, min: 1 },
    vestDate: { type: Date, required: true },
    optionsVesting: { type: Number, required: true, min: 1 },
    cumulativeVested: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

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

    grantReference: { type: String, required: true, trim: true },
    grantDate: { type: Date, required: true },
    vestingStartDate: { type: Date, required: true },

    optionsGranted: { type: Number, required: true, min: 1 },
    exercisePrice: { type: Number, required: true, min: 0 },

    cliffMonths: { type: Number, required: true, min: 0 },
    vestingDurationMonths: { type: Number, required: true, min: 1 },
    vestingFrequency: {
      type: String,
      enum: Object.keys(VESTING_FREQUENCIES),
      required: true,
    },

    schedule: { type: [vestingTrancheSchema], default: [] },

    status: {
      type: String,
      enum: Object.values(GRANT_STATUS),
      default: GRANT_STATUS.ACTIVE,
      index: true,
    },

    optionsExercised: { type: Number, default: 0, min: 0 },
    optionsForfeited: { type: Number, default: 0, min: 0 },
    forfeitureReason: { type: String, trim: true, default: null },
    forfeitedAt: { type: Date, default: null },

    cancellationReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

esopGrantSchema.index({ tenantId: 1, grantReference: 1 }, { unique: true });
esopGrantSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

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

    fmvPerShare: { type: Number, required: true, min: 0 },
    exercisePrice: { type: Number, required: true, min: 0 },

    perquisiteValue: { type: Number, required: true, min: 0 },
    taxRatePercent: { type: Number, required: true, min: 0, max: 100 },
    tdsWithheld: { type: Number, required: true, min: 0 },
    exerciseCost: { type: Number, required: true, min: 0 },
    capitalGainsCostBasis: { type: Number, required: true, min: 0 },

    payrollMonth: { type: Number, default: null, min: 1, max: 12 },
    payrollYear: { type: Number, default: null, min: 2000, max: 2100 },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

esopExerciseSchema.index({ tenantId: 1, employeeId: 1, exerciseDate: -1 });

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

// Tender Offer Schemas for Secondary Share Buybacks
const esopTenderOfferSchema = new mongoose.Schema(
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
    },
    title: { type: String, required: true, trim: true },
    offerPricePerShare: { type: Number, required: true, min: 0.01 },
    totalPoolShares: { type: Number, required: true, min: 1 },
    totalBudget: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'Settled'],
      default: 'Open',
    },
    settlementDate: { type: Date, default: null },
  },
  { timestamps: true },
);

const esopTenderBidSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    tenderOfferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EsopTenderOffer',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    sharesOffered: { type: Number, required: true, min: 1 },
    sharesAllocated: { type: Number, default: 0, min: 0 },
    grossProceeds: { type: Number, default: 0, min: 0 },
    capitalGainsTax: { type: Number, default: 0, min: 0 },
    netProceeds: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Submitted', 'Allocated', 'Settled', 'Rejected'],
      default: 'Submitted',
    },
  },
  { timestamps: true },
);

esopGrantSchema.plugin(auditTrailPlugin);

const EsopScheme = mongoose.model('EsopScheme', esopSchemeSchema);
const EsopGrant = mongoose.model('EsopGrant', esopGrantSchema);
const EsopExercise = mongoose.model('EsopExercise', esopExerciseSchema);
const EsopTenderOffer = mongoose.model('EsopTenderOffer', esopTenderOfferSchema);
const EsopTenderBid = mongoose.model('EsopTenderBid', esopTenderBidSchema);

module.exports = {
  EsopScheme,
  EsopGrant,
  EsopExercise,
  EsopTenderOffer,
  EsopTenderBid,
};
