const mongoose = require('mongoose');
const {
  MONTHLY_SALARY_MAX,
  OVERTIME_RATE_MAX,
  PHONE_REGEX,
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
    /**
     * Employee contact number, validated as an international phone number
     * with an optional leading "+" and a national number of 7-15 digits.
     * Optional on creation, same as `email`.
     */
    phone: {
      type: String,
      required: false,
      trim: true,
      match: [
        PHONE_REGEX,
        'Phone number must be a valid international phone number',
      ],
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

employeeSchema.index({ createdBy: 1, fullName: 1, role: 1 }, { unique: true });
employeeSchema.index({ createdBy: 1, fullName: 1, role: 1, department: 1 }, { unique: true });

employeeSchema.index(
  { email: 1, createdBy: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

module.exports = mongoose.model('Employee', employeeSchema);