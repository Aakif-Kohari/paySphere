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
    /**
     * Who created this row. An audit fact, not a scoping key.
     *
     * #585's codemod rewrote every `createdBy: req.userId` in the controllers
     * to `tenantId: req.tenantId` while leaving this field `required: true`, so
     * every insert omitted a field the schema demanded and `create()` threw
     * before reaching Mongo (#613). Both fields are written now: this one
     * records the actor, `tenantId` below decides who can see the row.
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /**
     * Which company this row belongs to — the field every read filters on.
     *
     * Separate from `createdBy` because a company can have more than one admin,
     * and a row created by one of them has to stay visible to the others.
     */
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
// same day would make "which rate applied?" ambiguous. Scoped to the company,
// not the admin who filed it — otherwise two admins could each file a revision
// for the same employee on the same day (#613).
salaryStructureSchema.index(
  { employeeId: 1, effectiveFrom: 1, tenantId: 1 },
  { unique: true },
);

// The timeline read: "this employee's revisions, newest first".
salaryStructureSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: -1 });

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
