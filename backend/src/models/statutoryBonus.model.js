/**
 * Statutory bonus computations and the set-on / set-off ledger (#1346).
 *
 * One collection rather than two, and the ledger lives on the computation
 * rather than in a table of its own.
 *
 * The reasoning is the same as `gratuityValuation.model.js`: a committed
 * computation is a figure that gets filed, and it has to stay reconstructable.
 * A free-standing ledger table would be mutable state that every computation
 * reads and writes, so re-running 2026 would consume set-on twice and no
 * subsequent year would agree with what was filed. Storing `ledgerAfter` on
 * each committed year makes the ledger a *derived* value — the live balance for
 * year N is simply the `ledgerAfter` of the last committed year before it —
 * and a re-run of one year cannot corrupt another.
 */

const mongoose = require('mongoose');

const { DISQUALIFICATION, EXCLUSION } = require('../utils/statutoryBonus');

/**
 * One set-on or set-off amount, tagged with the year it arose in.
 *
 * The year is what makes the four-year expiry work; without it an entry is just
 * a number and there is no way to know when it lapses.
 */
const ledgerEntrySchema = new mongoose.Schema(
  {
    accountingYear: { type: Number, required: true },
    type: { type: String, enum: ['set_on', 'set_off'], required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/** One line of Form C — the register of bonus paid to each employee. */
const registerLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },
    monthlyWage: { type: Number, default: 0 },
    daysWorked: { type: Number, default: 0 },
    monthsWorked: { type: Number, default: 0 },
    /** Wages after the section 12 cap — not what the employee was paid. */
    qualifyingWages: { type: Number, default: 0 },
    bonusPayable: { type: Number, default: 0 },
    /**
     * The rounding remainder, placed on one line so the register adds up to the
     * total it is supposed to. An inspector reading Form C adds the column.
     */
    roundingAdjustment: { type: Number, default: undefined },
  },
  { _id: false },
);

/** An employee left out of the register, and the section that leaves them out. */
const exclusionLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    name: { type: String, default: '' },
    designation: { type: String, default: '' },
    monthlyWage: { type: Number, default: 0 },
    daysWorked: { type: Number, default: 0 },
    code: { type: String, enum: Object.values(EXCLUSION), required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const statutoryBonusSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    /** The accounting year, by the calendar year it ends in. */
    accountingYear: { type: Number, required: true },
    accountingYearStart: { type: Date, required: true },
    accountingYearEnd: { type: Date, required: true },
    /** Section 19 — eight months after the close of the year. */
    paymentDueBy: { type: Date, default: null },

    // --- Applicability ----------------------------------------------------

    applicable: { type: Boolean, default: false },
    coverageReason: { type: String, default: '' },
    /**
     * Section 1(5): once the Act has applied it keeps applying, whatever the
     * headcount does afterwards. Carried forward on every subsequent
     * computation rather than re-derived from this year's headcount alone.
     */
    previouslyCovered: { type: Boolean, default: false },

    // --- The accounts -----------------------------------------------------

    grossProfit: { type: Number, default: 0 },
    priorCharges: { type: Number, default: 0 },
    availableSurplus: { type: Number, default: 0 },
    allocableSurplusShare: { type: Number, default: 0.67 },
    allocableSurplus: { type: Number, default: 0 },
    employerType: {
      type: String,
      enum: ['COMPANY', 'OTHER'],
      default: 'COMPANY',
    },
    /**
     * The scheduled minimum wage used for the section 12 cap. Recorded because
     * it varies by state and by category of employment, and a later change must
     * not silently restate a filed year.
     */
    minimumWage: { type: Number, default: 0 },

    // --- The allocation ---------------------------------------------------

    totalQualifyingWages: { type: Number, default: 0 },
    minimumBonus: { type: Number, default: 0 },
    maximumBonus: { type: Number, default: 0 },
    payableBonus: { type: Number, default: 0 },
    bonusRate: { type: Number, default: 0 },
    bonusPercent: { type: Number, default: 0 },
    setOn: { type: Number, default: 0 },
    setOff: { type: Number, default: 0 },
    drawnFromSetOn: { type: Number, default: 0 },
    allocationBasis: { type: String, default: '' },

    /** The ledger as it stands after this year has been allocated. */
    ledgerAfter: { type: [ledgerEntrySchema], default: [] },

    // --- The registers ----------------------------------------------------

    eligibleCount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },
    register: { type: [registerLineSchema], default: [] },
    excluded: { type: [exclusionLineSchema], default: [] },

    // --- Payment ----------------------------------------------------------

    paidOn: { type: Date, default: null },
    paymentReference: { type: String, default: '', maxlength: 200 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

/**
 * One computation per tenant per accounting year.
 *
 * Re-running 2026 replaces 2026. Two computations for one year is two answers
 * to "what did we file", and with the ledger derived from the latest committed
 * year it would also be two different opening balances for 2027.
 */
statutoryBonusSchema.index(
  { tenantId: 1, accountingYear: 1 },
  { unique: true },
);

/** History and "the year before this one" are both this query. */
statutoryBonusSchema.index({ tenantId: 1, accountingYear: -1 });

const StatutoryBonus = mongoose.model('StatutoryBonus', statutoryBonusSchema);

module.exports = { StatutoryBonus, DISQUALIFICATION };
