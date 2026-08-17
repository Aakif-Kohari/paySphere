/**
 * @fileoverview Leave Policy Schema
 * @description Defines company-wide or department-specific rules for leave accrual.
 * Issue: #646
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const leavePolicySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    leaveType: {
      type: String,
      required: true,
      enum: ['earned', 'sick', 'casual', 'compensatory'],
    },
    accrualRate: {
      type: Number,
      required: true,
      min: 0,
      default: 1.5, // e.g., 1.5 days per month
    },
    maxCarryForward: {
      type: Number,
      default: null, // null means unlimited
      min: 0,
    },
    maxAccumulation: {
      type: Number,
      default: null, // Maximum total balance allowed at any time
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    financialYearEndMonth: {
      type: Number, // 1-12 (e.g., 3 for March in India)
      default: 3,
      min: 1,
      max: 12,
    },

    // --- Year-end closure rules (#1159) -------------------------------------
    //
    // `maxCarryForward` and `maxAccumulation` above have existed since #646 and
    // were enforced nowhere, because nothing ever ran a close. These are the
    // rest of what a close needs in order to decide what happens to the excess.

    /**
     * Whether unused days above the carry cap are paid out.
     *
     * Off by default, and deliberately per-policy rather than global: earned
     * leave is normally encashable and casual or sick leave is normally not, so
     * one setting for the whole company would be wrong for one of them
     * whichever way it was set. Where this is false the excess lapses — the
     * correct outcome, reported explicitly rather than arrived at by
     * subtraction somewhere nobody looks.
     */
    isEncashable: {
      type: Boolean,
      default: false,
    },
    /** Ceiling on days paid out in one close. `null` means no ceiling. */
    maxEncashmentDays: {
      type: Number,
      default: null,
      min: 0,
    },
    /**
     * Days the employee keeps regardless of the carry cap.
     *
     * Raises the carried figure where a cap would have left it lower, so a
     * close cannot leave somebody with no leave at all to take.
     */
    minRetentionDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** What an encashment day is priced from. */
    encashmentRateBasis: {
      type: String,
      enum: ['basic', 'gross'],
      default: 'basic',
    },
    /**
     * The divisor for the per-day rate.
     *
     * Fixed rather than the actual length of the month: encashment is paid
     * against a leave year, not a particular month, and using the calendar
     * would make the same balance worth 3% more if the close happened to be
     * run in February.
     */
    encashmentMonthDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 31,
    },
    /**
     * Basic as a share of gross, for pricing where the employee record carries
     * no basic figure of its own — `employee.model.js` holds `monthlySalary`
     * and nothing else.
     */
    basicPercentOfGross: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

// Ensure unique policy names per tenant
leavePolicySchema.index({ tenantId: 1, name: 1 }, { unique: true });

leavePolicySchema.plugin(softDeletePlugin);
module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
