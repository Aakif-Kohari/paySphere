const mongoose = require("mongoose");

const cronLockSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., 'monthly_payslip'
  lockedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true }, // TTL index
});

// Automatically delete locks after they expire
cronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CronLock", cronLockSchema);
