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
