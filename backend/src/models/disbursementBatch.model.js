/**
 * @fileoverview Salary disbursement batch and line schemas.
 * @description Issue: #1075
 *
 * The line is a separate collection rather than a subdocument array. A batch for
 * a mid-size company is several hundred credits, each of which gets its own
 * status, its own bank reason code on return, and its own re-issue decision —
 * and a subdocument array means every one of those updates rewrites the whole
 * document. Separating them also means a line can be indexed and queried
 * directly, which is what "find every returned credit this quarter" needs.
 *
 * `accountNumber` is stored alongside `maskedAccountNumber` deliberately. The
 * full number is needed to generate the file and must never leave in an API
 * response, so the mask is materialised rather than computed at the boundary and
 * hoped for — `dataMask.middleware.js` exists because that hope has failed
 * before.
 */

const mongoose = require('mongoose');
const auditTrailPlugin = require('../middlewares/auditTrail.middleware');
const {
  BATCH_STATUS,
  LINE_STATUS,
  PAYMENT_MODES,
} = require('../utils/bankFileGenerator');

const disbursementBatchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    batchReference: { type: String, required: true, trim: true, maxlength: 20 },

    /** The payroll period this batch pays out. */
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },

    /** The company account the debit lands on. */
    debitAccountNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 18,
    },
    debitIfsc: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 11,
    },
    debitAccountName: { type: String, default: '', trim: true, maxlength: 120 },

    valueDate: { type: Date, required: true },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },

    status: {
      type: String,
      enum: Object.values(BATCH_STATUS),
      default: BATCH_STATUS.DRAFT,
      index: true,
    },

    /**
     * Control totals as computed at validation.
     *
     * Stored rather than recomputed on read, because their whole purpose is to
     * be compared against a later recomputation. Totals that are always derived
     * from the current lines can never disagree with them, which makes them
     * decorative.
     */
    controlTotals: {
      recordCount: { type: Number, default: 0 },
      totalAmountPaise: { type: Number, default: 0 },
      bodyHash: { type: String, default: '' },
    },

    /** Lines that failed validation, with their reasons. Kept on the batch so
     *  the failures survive a page refresh and can be worked through. */
    rejectedLines: { type: [mongoose.Schema.Types.Mixed], default: [] },

    validatedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reconciledAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

disbursementBatchSchema.index(
  { tenantId: 1, batchReference: 1 },
  { unique: true },
);

// One batch per payroll period, per tenant. Two batches for the same month is
// the shape a double payment takes, and the index is a cheaper guard than any
// amount of application logic.
disbursementBatchSchema.index(
  { tenantId: 1, year: 1, month: 1 },
  { unique: true },
);

const disbursementLineSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DisbursementBatch',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    payrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollUpdate',
      default: null,
    },

    serial: { type: Number, required: true, min: 1 },

    beneficiaryName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    /**
     * Stored as a string, never a number: a leading zero is part of an account
     * number and `Number('0012345678')` silently discards it.
     */
    accountNumber: { type: String, required: true, trim: true, maxlength: 18 },
    maskedAccountNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 18,
    },
    ifsc: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 11,
    },

    /** Integer paise. Floats do not belong in a document that causes an
     *  irreversible transfer. */
    amountPaise: { type: Number, required: true, min: 1 },

    paymentMode: {
      type: String,
      enum: Object.values(PAYMENT_MODES),
      required: true,
    },
    /** Why that rail. "Why did this one go RTGS" gets asked months later. */
    paymentModeReason: { type: String, default: '', maxlength: 200 },

    status: {
      type: String,
      enum: Object.values(LINE_STATUS),
      default: LINE_STATUS.PENDING,
      index: true,
    },

    returnReasonCode: { type: String, default: null, maxlength: 10 },
    returnReasonText: { type: String, default: null, maxlength: 200 },
    retryable: { type: Boolean, default: false },
    returnedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

disbursementLineSchema.index({ batchId: 1, serial: 1 }, { unique: true });
disbursementLineSchema.index({ tenantId: 1, status: 1 });

/**
 * Never serialise the full account number.
 *
 * The mask is what every JSON response carries; the full number is read
 * explicitly by the file generators, which are the only callers that need it.
 * Doing this on the schema rather than in each controller means a new endpoint
 * cannot leak it by forgetting.
 */
disbursementLineSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.accountNumber;
    return ret;
  },
});

disbursementBatchSchema.plugin(auditTrailPlugin);

const DisbursementBatch = mongoose.model(
  'DisbursementBatch',
  disbursementBatchSchema,
);
const DisbursementLine = mongoose.model(
  'DisbursementLine',
  disbursementLineSchema,
);

module.exports = { DisbursementBatch, DisbursementLine };
