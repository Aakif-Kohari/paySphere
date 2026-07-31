const mongoose = require('mongoose');
const {
  ALL_SETTLEMENT_STATUSES,
  SETTLEMENT_STATUS,
  EXIT_TYPE,
  MAX_SETTLEMENT_NOTE_LENGTH,
} = require('../config/employment');

/**
 * A Full & Final settlement statement (#462).
 *
 * The status ladder deliberately mirrors the payroll approval workflow from
 * #438, so an F&F goes through the same maker–checker path as a payroll run
 * rather than inventing a second, inconsistent one.
 */
const settlementSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeName: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    lastWorkingDay: { type: Date, required: true },
    joiningDate: { type: Date },
    exitType: {
      type: String,
      enum: Object.values(EXIT_TYPE),
      default: EXIT_TYPE.RESIGNATION,
    },

    /** The month the settlement is booked into, for reporting. */
    settlementMonth: { type: Number, min: 1, max: 12 },
    settlementYear: { type: Number, min: 2000, max: 2100 },

    earnings: {
      proratedSalary: { type: Number, default: 0 },
      daysWorked: { type: Number, default: 0 },
      daysInMonth: { type: Number, default: 0 },
      leaveEncashment: { type: Number, default: 0 },
      encashableDays: { type: Number, default: 0 },
      gratuity: { type: Number, default: 0 },
      gratuityYears: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },

    deductions: {
      noticeShortfall: { type: Number, default: 0 },
      noticeShortfallDays: { type: Number, default: 0 },
      advanceRecovery: { type: Number, default: 0 },
      assetRecovery: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },

    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSettlement: { type: Number, default: 0 },

    /**
     * Per-line reasoning, snapshotted at calculation time.
     *
     * An F&F is handed to a departing employee, so the statement has to survive
     * a later change to the policy or the salary and still explain itself.
     */
    explanations: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /** The policy in force when this was computed, frozen for reproducibility. */
    policySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ALL_SETTLEMENT_STATUSES,
      default: SETTLEMENT_STATUS.DRAFT,
    },

    /** Set when an owner deliberately commits a negative settlement. */
    negativeOverride: { type: Boolean, default: false },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectionReason: {
      type: String,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
    paidAt: { type: Date },
    cancelledAt: { type: Date },

    notes: {
      type: String,
      default: '',
      maxlength: [
        MAX_SETTLEMENT_NOTE_LENGTH,
        `Notes cannot exceed ${MAX_SETTLEMENT_NOTE_LENGTH} characters`,
      ],
    },
  },
  { timestamps: true },
);

// One live settlement per employee. A cancelled one does not block a new
// attempt, so the partial index excludes it.
settlementSchema.index(
  { employeeId: 1, createdBy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['draft', 'pending_approval', 'approved', 'paid'] },
    },
  },
);

settlementSchema.index({ createdBy: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
