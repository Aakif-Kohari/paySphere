const mongoose = require('mongoose');
const {
  MONTHLY_SALARY_MAX,
  OVERTIME_RATE_MAX,
} = require('../utils/validators');
const { EMPLOYMENT_STATUS, EXIT_TYPE } = require('../config/employment');

const employeeSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      default: '',
      maxlength: [100, 'Role cannot exceed 100 characters'],
    },
    department: {
      type: String,
      default: '',
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
    },
    /**
     * Derived mirror of `employmentStatus`, kept so every existing query that
     * filters on it keeps working untouched (#462).
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Explicit employment state.
     */
    employmentStatus: {
      type: String,
      enum: Object.values(EMPLOYMENT_STATUS),
      default: EMPLOYMENT_STATUS.ACTIVE,
    },

    exitDetails: {
      lastWorkingDay: { type: Date },
      resignationDate: { type: Date },
      exitType: {
        type: String,
        enum: Object.values(EXIT_TYPE),
      },
      reason: {
        type: String,
        default: '',
        maxlength: [500, 'Exit reason cannot exceed 500 characters'],
      },
      noticePeriodDays: { type: Number, min: 0, max: 365 },
      noticeServedDays: { type: Number, min: 0, max: 365 },
      exitInterviewDone: { type: Boolean, default: false },
    },
    monthlySalary: {
      type: Number,
      required: true,
      min: [1, 'Monthly salary must be positive'],
      max: [
        MONTHLY_SALARY_MAX,
        `Monthly salary cannot exceed ${MONTHLY_SALARY_MAX}`,
      ],
    },
    overtimeRate: {
      type: Number,
      default: 0,
      min: [0, 'Overtime rate cannot be negative'],
      max: [
        OVERTIME_RATE_MAX,
        `Overtime rate cannot exceed ${OVERTIME_RATE_MAX}`,
      ],
    },
    companyName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    joiningDate: {
      type: Date,
    },
    currency: {
      type: String,
      default: "INR",
    },
    deletedAt: {
      type: Date,
      default: null,
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
    bankDetails: {
      bankName: {
        type: String,
        default: '',
        maxlength: [100, 'Bank name cannot exceed 100 characters'],
      },
      accountNumber: {
        type: String,
        default: '',
        maxlength: [30, 'Account number cannot exceed 30 characters'],
      },
      routingCode: {
        type: String,
        default: '',
        maxlength: [20, 'Routing/IFSC code cannot exceed 20 characters'],
      },
    },
  },
  { timestamps: true },
);

employeeSchema.index({ tenantId: 1, fullName: 1, role: 1 }, { unique: true });
// Note: the index above is a prefix of this one and is also unique, so it is
// the one that decides. Adding `department` here cannot loosen a constraint the
// shorter index already enforces — two people with the same name and role in
// different departments are still rejected. Left as-is because relaxing it
// changes who can be hired, which is a product decision, not a scoping fix.
employeeSchema.index({ tenantId: 1, fullName: 1, role: 1, department: 1 }, { unique: true });

/**
 * Email is unique within a company, for the employees that have one.
 *
 * Scoped by `tenantId` rather than `createdBy`: an address must not be usable
 * twice inside one company, and it must be usable in a different one. Scoping
 * it to the creator would let two admins at the same company each add the same
 * person.
 *
 * The invariants from #414 still hold and are what the model test checks:
 *
 *   - `partialFilterExpression`, not `sparse`. `sparse` on a compound index
 *     only skips a document when *every* indexed key is missing, and the second
 *     key is required — so every email-less employee was indexed with
 *     `email: null` and the second one hit E11000.
 *   - The filter is `$type: 'string'`, so a document with no email is outside
 *     the index entirely rather than sharing a null slot.
 */
employeeSchema.index(
  { email: 1, tenantId: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

module.exports = mongoose.model('Employee', employeeSchema);
