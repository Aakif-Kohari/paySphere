const mongoose = require("mongoose");

const pyqSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, "Subject is required"],
    trim: true,
  },
  exam: {
    type: String,
    required: [true, "Exam is required"],
    trim: true,
  },
  year: {
    type: Number,
    required: [true, "Year is required"],
  },
  question: {
    type: String,
    required: [true, "Question text is required"],
    trim: true,
  },
  chapter: {
    type: String,
    required: [true, "Chapter name is required"],
    trim: true,
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    required: [true, "Difficulty rating is required"],
  },
  tags: {
    type: [String],
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

// Scoped index
pyqSchema.index({ tenantId: 1, subject: 1, exam: 1 });

module.exports = mongoose.model("PYQ", pyqSchema);
