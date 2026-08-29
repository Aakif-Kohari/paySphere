const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const {
  ALL_ACCOUNT_TYPES,
  DEFAULT_ACCOUNT_TYPE,
} = require('../config/accountTypes');
const { EMAIL_REGEX } = require('../utils/validators');
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
    },    companyLogoData: { type: String, default: '' },
    companyName: {
      type: String,
      required: true,
    },
    /**
     * The RBAC role — a reference to a `Role` document, which carries the
     * `Permission` set that `requirePermission` checks against.
     *
     * #443 declared a *second* field called `role` further down this schema (a
     * String enum of ADMIN/EMPLOYEE). Mongoose keeps the last declaration, so
     * this reference was silently replaced by a String: `populate("role")` could
     * never hydrate a Role, and `signup` assigning `defaultRole._id` failed enum
     * validation, so registration returned 400 on any seeded database (#558).
     *
     * The account-type discriminator now lives on `accountType` below. Nothing
     * should ever declare `role` twice here again.
     */
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    /**
     * What kind of login this is: the owner's console or an employee's
     * self-service portal (#443). Orthogonal to `role` — an account has a type
     * *and* a permission set, and conflating the two is what broke #558.
     */
    accountType: {
      type: String,
      enum: ALL_ACCOUNT_TYPES,
      default: DEFAULT_ACCOUNT_TYPE,
      index: true,
    },
password: {
      type: String,
      required: false,
      validate: {
        // Only checked when a password is actually being set — accounts
        // created via Google sign-in (googleId) have no password at all.
        validator: (value) => !value || value.length >= 8,
        message: 'Password must be at least 8 characters long',
      },
    },    passwordHistory: {
      type: [String],
      default: [],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    avatar: {
      type: String,
    },
    twoFactorSecret: {
      type: String,
      default: '',
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      default: null,
    },
    mfaPendingSecret: {
      type: String,
      default: null,
    },
    isMfaEnabled: {
      type: Boolean,
      default: false,
    },
    defaultOvertimeRate: {
      type: Number,
      default: 0,
      min: [0, 'Default overtime rate cannot be negative'],
      max: [1000000, 'Default overtime rate cannot exceed 1000000'],
    },
    defaultDailyRate: {
      type: Number,
      default: 0,
      min: [0, 'Default daily rate cannot be negative'],
      max: [10000000, 'Default daily rate cannot exceed 10000000'],
    },
    settings: {
      preferences: {
        language: { type: String, default: 'English' },
        theme: {
          type: String,
          enum: ['light', 'dark', 'system'],
          default: 'system',
        },
      },
      companyInfo: {
        payrollCycle: {
          type: String,
          enum: ['weekly', 'bi-weekly', 'monthly'],
          default: 'monthly',
        },
        companyLogo: { type: String },
      },
      payrollConfig: {
        currency: { type: String, default: 'INR' },
        leaveDeductionPolicy: {
          type: String,
          enum: ['basic_only', 'full_salary'],
          default: 'basic_only',
        },
      },
      // Paid-leave entitlement, consumed by the attendance ledger's balance
      // engine. Defaults mirror utils/leaveBalance.js so an account that has
      // never configured a policy still gets a defensible one (#459).
      leavePolicy: {
        annualPaidLeaveDays: { type: Number, default: 12, min: 0, max: 365 },
        accrualMode: {
          type: String,
          enum: ['monthly', 'annual'],
          default: 'monthly',
        },
        carryForwardCapDays: { type: Number, default: 0, min: 0, max: 365 },
        leaveYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
        allowNegativeBalance: { type: Boolean, default: false },
      },
      // JS weekday indices (0 = Sunday) treated as weekly offs when a month's
      // grid is generated for the first time. Also the basis for working-day
      // proration in a settlement (#462).
      weeklyOffDays: {
        type: [Number],
        default: [0],
      },
      // Full & Final settlement policy (#462). Defaults mirror
      // config/employment.js so an account that has never configured one still
      // gets a defensible policy.
      settlementPolicy: {
        prorationBasis: {
          type: String,
          enum: ['calendar', 'working'],
          default: 'calendar',
        },
        leaveEncashmentCapDays: { type: Number, default: 15, min: 0, max: 365 },
        defaultNoticePeriodDays: {
          type: Number,
          default: 30,
          min: 0,
          max: 365,
        },
        gratuityEnabled: { type: Boolean, default: true },
      },
      notifications: {
        emailReminders: { type: Boolean, default: true },
        systemAlerts: { type: Boolean, default: true },
        payrollCompletion: { type: Boolean, default: true },
      },
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('User', userSchema);
