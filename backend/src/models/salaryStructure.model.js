const mongoose = require('mongoose');
const {
  COMPONENT_TYPE,
  CALCULATION,
  ALL_REVISION_REASONS,
  REVISION_REASON,
  MAX_COMPONENT_CODE_LENGTH,
  MAX_COMPONENT_LABEL_LENGTH,
} = require('../config/salaryComponents');

/**
 * An effective-dated salary revision (#461).
 *
 * Append-only by design: a correction is a *new* revision with
 * `reason: 'correction'`, never an edit to an existing one. That is what makes
 * the history tamper-evident — the same property `AuditLog` relies on — and it
 * is the whole point, since the previous model overwrote `monthlySalary` in
 * place and left no trace of what it had been.
 */

const componentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: [
        MAX_COMPONENT_CODE_LENGTH,
        `Component code cannot exceed ${MAX_COMPONENT_CODE_LENGTH} characters`,
      ],
    },
    label: {
      type: String,
      default: '',
      maxlength: [
        MAX_COMPONENT_LABEL_LENGTH,
        `Component label cannot exceed ${MAX_COMPONENT_LABEL_LENGTH} characters`,
      ],
    },
    type: {
      type: String,
      enum: Object.values(COMPONENT_TYPE),
      default: COMPONENT_TYPE.EARNING,
    },
    calculation: {
      type: String,
      enum: Object.values(CALCULATION),
      default: CALCULATION.FIXED,
    },
    value: { type: Number, default: 0, min: 0 },
    taxable: { type: Boolean, default: true },
    /** The balancing figure. At most one per structure. */
    isResidual: { type: Boolean, default: false },
  },
  { _id: false },
);

const salaryStructureSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    effectiveFrom: { type: Date, required: true },

    components: [componentSchema],

    /**
     * The denormalised gross, kept in step with `Employee.monthlySalary`.
     *
     * Backwards compatibility is a hard requirement here: every existing
     * consumer (`calculateNetSalary`, the dashboard, analytics, the exports)
     * reads `monthlySalary`, and none of them should have to change.
     */
    grossMonthly: { type: Number, required: true, min: 0 },
    ctcAnnual: { type: Number, default: 0, min: 0 },

    reason: {
      type: String,
      enum: ALL_REVISION_REASONS,
      default: REVISION_REASON.REVISION,
    },
    note: {
      type: String,
      default: '',
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },

    revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /** Set when a later revision takes over. Informational; never deletes. */
    supersededAt: { type: Date },
  },
  { timestamps: true },
);

// One revision per employee per effective date. Two revisions effective the
// same day would make "which rate applied?" ambiguous.
salaryStructureSchema.index(
  { employeeId: 1, effectiveFrom: 1, createdBy: 1 },
  { unique: true },
);

// The timeline read: "this employee's revisions, newest first".
salaryStructureSchema.index({ createdBy: 1, employeeId: 1, effectiveFrom: -1 });

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
