/**
 * Leave Travel Allowance journeys and their assessed exemption (#1345).
 *
 * The unit stored here is a *journey*, not a receipt, and that is the whole
 * reason this is not a row in `taxProof.model.js`. The two-per-block
 * entitlement counts journeys; a journey has co-travellers, a mode, an origin
 * and a destination; and none of that is expressible in
 * `{ category, amount, financialYear }`.
 *
 * The assessed figures are stored alongside the claim rather than recomputed on
 * read. An exemption feeds monthly TDS and then Form 16 Part B, and both have
 * to keep saying the same thing after the fare table, the salary structure or
 * the statute changes underneath them.
 */

const mongoose = require('mongoose');

const { TRAVEL_MODE, RELATIONSHIP } = require('../utils/ltaExemption');

const CLAIM_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * One person on the journey.
 *
 * `birthGroupId` exists for the multiple-birth carve-out: twins born as the
 * second and third children occupy one slot against the two-child restriction,
 * and the only way to know two children are a multiple birth is to be told.
 * Sharing a date of birth is not sufficient evidence and inferring it would
 * silently widen the restriction for anyone who genuinely has two children born
 * on the same day of different years.
 */
const travellerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    relationship: {
      type: String,
      enum: Object.values(RELATIONSHIP),
      required: true,
    },
    dateOfBirth: { type: Date, default: null },
    /** Required for a parent or sibling; ignored for anyone else. */
    dependent: { type: Boolean, default: false },
    birthGroupId: { type: String, default: null, trim: true },
  },
  { _id: false },
);

/**
 * The statutory ceiling fares for the route, as supplied by whoever files the
 * claim.
 *
 * Deliberately not derived here. A fare table would be stale within a quarter
 * and absent for most routes, and a wrong ceiling silently changes an
 * employee's taxable income — better to record what was used and let the
 * verification step see it.
 */
const fareCeilingSchema = new mongoose.Schema(
  {
    economyAirFare: { type: Number, default: null, min: 0 },
    acFirstClassRailFare: { type: Number, default: null, min: 0 },
    deluxeBusFare: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const ltaClaimSchema = new mongoose.Schema(
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

    // --- The journey ------------------------------------------------------

    /**
     * The date travel started. Everything about the entitlement hangs off this
     * one field: it decides the block, and therefore whether the journey is the
     * employee's first, second, or one they are not entitled to at all.
     */
    journeyDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },
    origin: { type: String, required: true, trim: true, maxlength: 120 },
    destination: { type: String, required: true, trim: true, maxlength: 120 },
    mode: {
      type: String,
      enum: Object.values(TRAVEL_MODE),
      required: true,
    },
    travelClass: { type: String, default: '', trim: true, maxlength: 60 },
    /**
     * A journey with any foreign leg is outside section 10(5) entirely — not
     * partially exempt for the domestic portion.
     */
    international: { type: Boolean, default: false },

    claimedFare: { type: Number, required: true, min: 0 },
    fareCeilings: { type: fareCeilingSchema, default: () => ({}) },
    travellers: { type: [travellerSchema], default: [] },
    documentUrls: { type: [String], default: [] },

    // --- The assessment ---------------------------------------------------

    /** The block label the journey fell in, e.g. "2026-2029". Denormalised for querying. */
    blockLabel: { type: String, required: true, index: true },
    blockStartYear: { type: Number, required: true },
    blockEndYear: { type: Number, required: true },

    /** True when the journey was allowed only because of the carried-forward entitlement. */
    usesCarryForward: { type: Boolean, default: false },

    exemptAmount: { type: Number, default: 0, min: 0 },
    taxableBalance: { type: Number, default: null },
    ltaComponentPaid: { type: Number, default: null },

    /** Why the engine refused, if it did. Empty on an allowable claim. */
    refusals: {
      type: [
        new mongoose.Schema(
          {
            code: { type: String, required: true },
            message: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    /** Everything the engine wants the employee to be told — caps applied, apportionment, carry-forward. */
    notes: { type: [String], default: [] },

    // --- Workflow ---------------------------------------------------------

    status: {
      type: String,
      enum: Object.values(CLAIM_STATUS),
      default: CLAIM_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 1000 },

    /** Who filed it. An audit fact, not a scoping key — `tenantId` above is that. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

/**
 * The entitlement query: "how many journeys has this employee approved in this
 * block". Run on every claim submission, so it gets an index rather than a
 * collection scan across every claim the tenant has ever filed.
 */
ltaClaimSchema.index({
  tenantId: 1,
  employeeId: 1,
  blockStartYear: 1,
  status: 1,
});

/** The verification queue, oldest first. */
ltaClaimSchema.index({ tenantId: 1, status: 1, createdAt: 1 });

const LtaClaim = mongoose.model('LtaClaim', ltaClaimSchema);

module.exports = { LtaClaim, CLAIM_STATUS };
