/**
 * A month's ad-hoc activity for one employee: unpaid leave, overtime, and any
 * one-off bonus or deduction that is not part of the standing package.
 *
 * `controllers/monthlyUpdates.controller.js` (#509) has required this file
 * since it was written:
 *
 *     const MonthlyUpdate = require('../models/monthlyUpdate.model'); // Assumed schema
 *
 * The model was never written, so requiring the controller threw
 * MODULE_NOT_FOUND — which is why `routes/monthlyUpdates.routes.js` could not
 * be mounted, and why mounting it while reconciling the duplicated route tables
 * in #792 took the boot down until this landed.
 *
 * Every field below is one the controller reads or writes; nothing is invented.
 * The shape deliberately mirrors the equivalent columns on `payroll.model.js`,
 * because these numbers are the inputs the payroll run consumes.
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const monthlyUpdateSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    /**
     * Denormalised from the employee at write time, the same way
     * `payroll.model.js` carries `employeeName`: a record of what the figures
     * were filed against, which stays correct after a rename.
     */
    employeeName: {
      type: String,
      required: true,
    },

    /**
     * Which company this row belongs to — the field every read filters on.
     * The controller scopes all four of its queries by it (#585/#613).
     */
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },

    month: {
      type: Number, // 1-12
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },

    // The controller already clamps these with `Math.max(0, Number(x) || 0)`.
    // Repeated here because the clamp only guards the HTTP path, and a record
    // can also be written by a migration or by anything holding the model.
    leaveDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    overtimeHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    bonus: {
      type: Number,
      default: 0,
      min: 0,
    },

    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
      default: '',
      // The controller slices to 500 before sanitising; the same ceiling here
      // so a direct write cannot exceed it.
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },

    /**
     * Who filed it. An audit fact, not a scoping key — `tenantId` above decides
     * visibility. Same split as `payroll.model.js` (#613).
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

// One record per employee per month, per company. This is the exact filter the
// controller's `findOneAndUpdate(..., { upsert: true })` uses, so without the
// unique index two concurrent submissions both insert and the month ends up
// with two contradictory activity records.
monthlyUpdateSchema.index(
  { tenantId: 1, employeeId: 1, month: 1, year: 1 },
  { unique: true },
);

// "Everything filed for this employee, newest first" — `getEmployeeMonthlyUpdates`.
monthlyUpdateSchema.index({ tenantId: 1, employeeId: 1, year: -1, month: -1 });

monthlyUpdateSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('MonthlyUpdate', monthlyUpdateSchema);
