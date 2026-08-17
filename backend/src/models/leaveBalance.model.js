/**
 * @fileoverview Leave Balance Schema
 * @description Tracks the current and historical leave balances for each employee.
 * Issue: #646
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

const leaveBalanceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicy',
      required: true,
    },
    leaveType: {
      type: String,
      required: true,
      enum: ['earned', 'sick', 'casual', 'compensatory'],
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    usedThisYear: {
      type: Number,
      default: 0,
      min: 0,
    },
    carriedForwardFromLastYear: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAccrualDate: {
      type: Date,
      default: null,
    },
    year: {
      type: Number,
      required: true,
    },

    // --- Year-end closure record (#1159) ------------------------------------
    //
    // The close has to be idempotent. With no record of which leave year has
    // already been closed for this balance, a second run carries forward and
    // encashes a second time, and the employee is paid twice for days they
    // earned once.
    closedForYear: {
      type: Number,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    /**
     * What the close paid out and wrote off.
     *
     * Kept on the balance rather than only in the response, so HR can answer
     * "why did I lose eight days?" from the record months later.
     */
    encashedDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    encashedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lapsedDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// Unique constraint: One balance record per employee, per policy, per year
leaveBalanceSchema.index(
  { tenantId: 1, employeeId: 1, policyId: 1, year: 1 },
  { unique: true },
);

leaveBalanceSchema.plugin(softDeletePlugin);
module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
