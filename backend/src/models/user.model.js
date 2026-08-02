const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  companyLogoData: { type: String, default: "" },
  companyName: {
    type: String,
    required: true,
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role"
  },
  password: {
    type: String,
    required: false,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  avatar: {
    type: String,
  },
  defaultOvertimeRate: {
    type: Number,
    default: 0,
    min: [0, "Default overtime rate cannot be negative"],
    max: [1000000, "Default overtime rate cannot exceed 1000000"],
  },
  defaultDailyRate: {
    type: Number,
    default: 0,
    min: [0, "Default daily rate cannot be negative"],
    max: [10000000, "Default daily rate cannot exceed 10000000"],
  },
  settings: {
    preferences: {
      language: { type: String, default: 'English' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' }
    },
    companyInfo: {
      payrollCycle: { type: String, enum: ['weekly', 'bi-weekly', 'monthly'], default: 'monthly' },
      companyLogo: { type: String },
    },
    payrollConfig: {
      currency: { type: String, default: 'INR' },
      leaveDeductionPolicy: { type: String, enum: ['basic_only', 'full_salary'], default: 'basic_only' }
    },
    // Paid-leave entitlement, consumed by the attendance ledger's balance
    // engine. Defaults mirror utils/leaveBalance.js so an account that has
    // never configured a policy still gets a defensible one (#459).
    leavePolicy: {
      annualPaidLeaveDays: { type: Number, default: 12, min: 0, max: 365 },
      accrualMode: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
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
      prorationBasis: { type: String, enum: ['calendar', 'working'], default: 'calendar' },
      leaveEncashmentCapDays: { type: Number, default: 15, min: 0, max: 365 },
      defaultNoticePeriodDays: { type: Number, default: 30, min: 0, max: 365 },
      gratuityEnabled: { type: Boolean, default: true },
    },
    notifications: {
      emailReminders: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true },
      payrollCompletion: { type: Boolean, default: true }
    }
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
  role: {
    type: String,
    enum: ["ADMIN", "EMPLOYEE"],
    default: "ADMIN",
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
