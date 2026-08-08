const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');
const { isValidEmail } = require('../utils/validators');

/** The report kinds a schedule can ask for. */
const REPORT_TYPES = ['analytics', 'payroll', 'turnover', 'custom'];

/** How often a schedule can fire. */
const FREQUENCIES = ['daily', 'weekly', 'monthly'];

/**
 * The most addresses one schedule may mail.
 *
 * There was no bound at all, so a single schedule could hold a ten-thousand
 * address list and the cron would try to deliver a payroll register to all of
 * them, every month.
 */
const MAX_RECIPIENTS = 25;

const reportScheduleSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      required: true,
      enum: REPORT_TYPES,
    },
    frequency: {
      type: String,
      required: true,
      enum: FREQUENCIES,
    },

    /**
     * Where the generated report is mailed.
     *
     * The validator used to be:
     *
     *     v.every(email => /^\\S+@\\S+\\.\\S+$/.test(email))
     *
     * Inside a regex literal, `\\S` is an escaped backslash followed by the
     * letter S — not the non-whitespace class. The pattern matched the literal
     * string `\S@\S.\S` and nothing else, so every real address failed, every
     * save threw a ValidationError, and POST /api/schedules has never once
     * succeeded (#666). It reads like a string-to-regex conversion where
     * `"\\S"` would have been right.
     *
     * It defers to `isValidEmail` from utils/validators.js now, which is the
     * same check the employee directory uses — one definition of "a valid
     * address" rather than a second one that can be wrong on its own.
     */
    recipients: {
      type: [String],
      required: true,
      validate: [
        {
          validator: (v) => Array.isArray(v) && v.length > 0,
          message: 'Must provide at least one recipient email address.',
        },
        {
          validator: (v) => v.length <= MAX_RECIPIENTS,
          message: `A schedule cannot have more than ${MAX_RECIPIENTS} recipients.`,
        },
        {
          validator: (v) => v.every((email) => isValidEmail(email)),
          message: (props) => {
            const bad = (props.value || []).filter((e) => !isValidEmail(e));
            return `Invalid recipient email address: ${bad.join(', ')}`;
          },
        },
      ],
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
      dataset: { type: String, enum: ['employees', 'payroll'] },
      columns: [String],
      filters: [
        {
          field: String,
          operator: String,
          value: mongoose.Schema.Types.Mixed,
        },
      ],
    },
  },
  { timestamps: true },
);

// The cron walks "every active schedule", and the read endpoint walks "this
// company's schedules". Both want an index.
reportScheduleSchema.index({ tenantId: 1, createdAt: -1 });
reportScheduleSchema.index({ isActive: 1, frequency: 1 });

reportScheduleSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('ReportSchedule', reportScheduleSchema);
module.exports.REPORT_TYPES = REPORT_TYPES;
module.exports.FREQUENCIES = FREQUENCIES;
module.exports.MAX_RECIPIENTS = MAX_RECIPIENTS;
