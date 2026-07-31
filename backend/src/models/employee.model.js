const mongoose = require('mongoose');
const {
  MONTHLY_SALARY_MAX,
  OVERTIME_RATE_MAX,
} = require('../utils/validators');

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
    isActive: {
      type: Boolean,
      default: true,
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

// One email per company — but only for employees that actually have one.
//
// `sparse: true` does not work on a compound index here. Per the MongoDB docs a
// compound sparse index indexes a document that has *at least one* of the keys,
// and `createdBy` is `required: true`, so every employee got an index entry with
// `email` recorded as null. Every email-less employee therefore collided on the
// same { email: null, createdBy } key and the second one failed with E11000.
//
// `partialFilterExpression` is the correct construct: documents without a string
// `email` are left out of the index entirely (#414, #374).
employeeSchema.index(
  { email: 1, createdBy: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);

module.exports = mongoose.model('Employee', employeeSchema);
