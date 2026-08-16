/**
 * @fileoverview Travel policy, request and settlement schemas.
 * @description Issue: #1077
 *
 * `advanceReleased` on the request is the field this whole feature turns on. It
 * is a company receivable — the same class of asset as a `loan.model.js` balance
 * — and until now nothing in PaySphere recorded one, so recovering the unspent
 * part of an advance depended on somebody remembering.
 *
 * `TravelSettlement` is one document per request rather than an array of
 * adjustments, and the unique index enforces that. A trip settles once; a
 * correction is an amendment to the settlement, not a second one, because two
 * settlements against one advance is the shape a double reimbursement takes.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const {
  CITY_CLASS,
  PART_DAY_RULE,
  TRAVEL_MODE,
  REQUEST_STATUS,
  SETTLEMENT_TYPE,
} = require('../utils/perDiemCalculator');

const travelPolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The employee grade this policy applies to. Free text, because grade
     *  naming is a company decision and this product does not impose one. */
    grade: { type: String, required: true, trim: true, maxlength: 60 },

    /**
     * Daily per-diem by city class. Stored as an explicit object rather than a
     * Map so it survives `lean()` as a plain object — the calculator indexes it
     * directly and a Mongoose Map would arrive as something else.
     */
    perDiemRates: {
      [CITY_CLASS.A]: { type: Number, default: 0, min: 0 },
      [CITY_CLASS.B]: { type: Number, default: 0, min: 0 },
      [CITY_CLASS.C]: { type: Number, default: 0, min: 0 },
      [CITY_CLASS.INTERNATIONAL]: { type: Number, default: 0, min: 0 },
    },

    /** Maximum reimbursable lodging per night, by city class. */
    lodgingCaps: {
      [CITY_CLASS.A]: { type: Number, default: 0, min: 0 },
      [CITY_CLASS.B]: { type: Number, default: 0, min: 0 },
      [CITY_CLASS.C]: { type: Number, default: 0, min: 0 },
      [CITY_CLASS.INTERNATIONAL]: { type: Number, default: 0, min: 0 },
    },

    /** Which cities fall in which class. */
    cityClasses: {
      [CITY_CLASS.A]: { type: [String], default: [] },
      [CITY_CLASS.B]: { type: [String], default: [] },
      [CITY_CLASS.C]: { type: [String], default: [] },
    },

    /**
     * Where an unlisted city lands.
     *
     * Defaults to the cheapest domestic band on purpose: an unrecognised city is
     * usually a spelling that does not match the list, and defaulting upwards
     * would pay a metro rate for a year before anyone noticed.
     */
    defaultCityClass: {
      type: String,
      enum: Object.values(CITY_CLASS),
      default: CITY_CLASS.C,
    },

    /** Highest class this grade may book, per mode. */
    permittedClasses: {
      [TRAVEL_MODE.AIR]: { type: String, default: 'Economy' },
      [TRAVEL_MODE.RAIL]: { type: String, default: 'AC3' },
      [TRAVEL_MODE.ROAD]: { type: String, default: 'Taxi' },
    },

    /**
     * Whether the part-days at each end of a trip are half days or whole ones.
     *
     * A policy field rather than a constant in the calculator, because it is a
     * decision each company makes and burying either answer makes the product
     * wrong for whoever chose the other.
     */
    partDayRule: {
      type: String,
      enum: Object.values(PART_DAY_RULE),
      default: PART_DAY_RULE.HALF,
    },

    advanceCeilingPercent: { type: Number, default: 80, min: 0, max: 100 },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },

    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

travelPolicySchema.index({ tenantId: 1, grade: 1 }, { unique: true });

const travelLegSchema = new mongoose.Schema(
  {
    fromCity: { type: String, required: true, trim: true, maxlength: 100 },
    toCity: { type: String, required: true, trim: true, maxlength: 100 },
    isInternational: { type: Boolean, default: false },

    departureAt: { type: Date, required: true },
    returnAt: { type: Date, required: true },

    mode: {
      type: String,
      enum: Object.values(TRAVEL_MODE),
      default: TRAVEL_MODE.AIR,
    },
    travelClass: {
      type: String,
      default: 'Economy',
      trim: true,
      maxlength: 40,
    },

    lodgingPerNight: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const travelRequestSchema = new mongoose.Schema(
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
    /** Snapshot of the grade at request time. The policy is looked up by grade,
     *  and an employee promoted mid-trip must not retroactively change the
     *  entitlement the trip was approved under. */
    grade: { type: String, required: true, trim: true, maxlength: 60 },

    purpose: { type: String, required: true, trim: true, maxlength: 500 },
    legs: { type: [travelLegSchema], default: [] },

    estimatedCost: { type: Number, required: true, min: 0 },
    advanceRequested: { type: Number, default: 0, min: 0 },
    advanceReleased: { type: Number, default: 0, min: 0 },
    advanceReleasedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.SUBMITTED,
      index: true,
    },

    /**
     * The violations found when the request was approved.
     *
     * Snapshotted rather than recomputed, so amending the policy afterwards
     * cannot make a breach that was approved look compliant in hindsight — the
     * same reasoning as the offer band check in the recruitment module.
     */
    policyViolations: { type: [mongoose.Schema.Types.Mixed], default: [] },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '', maxlength: 500 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

travelRequestSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
// Drives the outstanding-advance ledger.
travelRequestSchema.index({ tenantId: 1, advanceReleased: 1, status: 1 });

const travelSettlementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TravelRequest',
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    /** Receipted expenses by head — airfare, lodging, local conveyance. */
    actualsByHead: { type: [mongoose.Schema.Types.Mixed], default: [] },
    actualsTotal: { type: Number, required: true, min: 0 },

    perDiemEntitlement: { type: Number, required: true, min: 0 },
    /** The per-leg breakdown, kept so an employee disputing a per-diem can be
     *  shown how it was arrived at rather than just the total. */
    perDiemBreakdown: { type: [mongoose.Schema.Types.Mixed], default: [] },

    advanceAdjusted: { type: Number, required: true, min: 0 },

    settlementType: {
      type: String,
      enum: Object.values(SETTLEMENT_TYPE),
      required: true,
    },
    /** Both non-negative by construction. A caller posting `recoveryAmount` as
     *  a payroll deduction must never receive a negative. */
    reimbursementAmount: { type: Number, default: 0, min: 0 },
    recoveryAmount: { type: Number, default: 0, min: 0 },

    payrollComponent: { type: String, default: null },
    payrollMonth: { type: Number, default: null, min: 1, max: 12 },
    payrollYear: { type: Number, default: null, min: 2000, max: 2100 },

    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// A trip settles once. Two settlements against one advance is the shape a
// double reimbursement takes, and an index is a cheaper guard than any amount of
// application logic.
travelSettlementSchema.index({ requestId: 1 }, { unique: true });

travelPolicySchema.plugin(auditTrailPlugin);
travelRequestSchema.plugin(auditTrailPlugin);

const TravelPolicy = mongoose.model('TravelPolicy', travelPolicySchema);
const TravelRequest = mongoose.model('TravelRequest', travelRequestSchema);
const TravelSettlement = mongoose.model(
  'TravelSettlement',
  travelSettlementSchema,
);

module.exports = { TravelPolicy, TravelRequest, TravelSettlement };
