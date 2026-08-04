const mongoose = require("mongoose");

const reportScheduleSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      required: true,
      enum: ["analytics", "payroll", "turnover", "custom"],
    },
    frequency: {
      type: String,
      required: true,
      enum: ["daily", "weekly", "monthly"],
    },
    recipients: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0 && v.every(email => /^\\S+@\\S+\\.\\S+$/.test(email));
        },
        message: "Must provide at least one valid email address.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Optional configuration for custom reports
    config: {
      dataset: { type: String, enum: ["employees", "payroll"] },
      columns: [String],
      filters: [
        {
          field: String,
          operator: String,
          value: mongoose.Schema.Types.Mixed,
        }
      ]
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportSchedule", reportScheduleSchema);
