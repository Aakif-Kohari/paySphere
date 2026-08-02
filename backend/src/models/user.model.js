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
  companyName: {
    type: String,
    required: true,
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
  },
  defaultDailyRate: {
    type: Number,
    default: 0,
  },
  settings: {
    preferences: {
      language: { type: String, default: 'English' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' }
    },
    companyInfo: {
      payrollCycle: { type: String, enum: ['weekly', 'bi-weekly', 'monthly'], default: 'monthly' },
    },
    payrollConfig: {
      currency: { type: String, default: 'INR' },
      leaveDeductionPolicy: { type: String, enum: ['basic_only', 'full_salary'], default: 'basic_only' }
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
