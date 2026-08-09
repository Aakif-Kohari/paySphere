const mongoose = require("mongoose");

const topicTrendSchema = new mongoose.Schema({
  chapter: {
    type: String,
    required: true,
  },
  probability: {
    type: Number,
    min: 0,
    max: 1,
    required: true,
  },
  trend: {
    type: String,
    enum: ["rising", "falling", "stable"],
    required: true,
  },
  weightageClass: {
    type: String,
    enum: ["high", "medium", "low"],
    required: true,
  },
  badge: {
    type: String,
    required: true,
  },
}, { _id: false });

const pyqTrendSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  exam: {
    type: String,
    required: true,
    trim: true,
  },
  forecastYear: {
    type: Number,
    required: true,
  },
  predictedDifficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    required: true,
  },
  difficultyConfidence: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },
  topics: {
    type: [topicTrendSchema],
    default: [],
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

pyqTrendSchema.index({ tenantId: 1, subject: 1, exam: 1, forecastYear: -1 });

module.exports = mongoose.model("PYQTrend", pyqTrendSchema);
