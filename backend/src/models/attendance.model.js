const mongoose = require('mongoose');
const {
  ALL_ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS,
  normalizeAttendanceStatus,
  MAX_OVERTIME_HOURS_PER_DAY,
  MAX_DAY_NOTE_LENGTH,
} = require('../config/attendance');

/**
 * One document per employee per month.
 *
 * Per-month rather than per-day deliberately: the read pattern is always "show
 * me this employee's March", so a month document answers it in a single fetch
 * instead of thirty-one. A month of days is a few hundred bytes, nowhere near
 * the 16MB document ceiling, and the alternative would put ~360 documents per
 * employee per year into a collection that is otherwise only ever read a month
 * at a time.
 *
 * Introduced by #459: `AttendanceCalendarModal.jsx` held this grid in React
 * state and discarded it on close, collapsing a month of decisions into two
 * display strings that the payroll controller then re-parsed with a regex.
 */
const attendanceDaySchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
      min: [1, 'Day must be at least 1'],
      max: [31, 'Day cannot exceed 31'],
    },
    status: {
      type: String,
      required: true,
      enum: ALL_ATTENDANCE_STATUSES,
      default: ATTENDANCE_STATUS.PRESENT,
      set: (value) => normalizeAttendanceStatus(value) || value,
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: [0, 'Overtime hours cannot be negative'],
      max: [
        MAX_OVERTIME_HOURS_PER_DAY,
        `Overtime hours cannot exceed ${MAX_OVERTIME_HOURS_PER_DAY} in a day`,
      ],
    },
    note: {
      type: String,
      default: '',
      maxlength: [
        MAX_DAY_NOTE_LENGTH,
        `Note cannot exceed ${MAX_DAY_NOTE_LENGTH} characters`,
      ],
    },
  },
  { _id: false },
);

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
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
    year: {
      type: Number,
      required: true,
      min: [2000, 'Year must be 2000 or later'],
      max: [2100, 'Year cannot exceed 2100'],
    },
    month: {
      type: Number,
      required: true,
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12'],
    },

    days: [attendanceDaySchema],

    /**
     * Recomputed server-side on every write from `days`, never accepted from
     * the client. A client that could post its own totals could post a month
     * of absences summing to zero unpaid days.
     */
    totals: {
      present: { type: Number, default: 0 },
      halfDay: { type: Number, default: 0 },
      paidLeave: { type: Number, default: 0 },
      unpaidLeave: { type: Number, default: 0 },
      holiday: { type: Number, default: 0 },
      overtimeHours: { type: Number, default: 0 },
      daysRecorded: { type: Number, default: 0 },
    },

    /**
     * Set once the month's payroll reaches `paid`. A settled month must not be
     * silently rewritten underneath a payslip that has already gone out.
     */
    lockedAt: {
      type: Date,
    },
    lockedByPayrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollUpdate',
    },

    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// One ledger per employee per month, per company. Scoped to the tenant rather
// than the creator: a second admin marking attendance must land on the same
// ledger row, not a duplicate one (#613).
attendanceSchema.index(
  { employeeId: 1, year: 1, month: 1, tenantId: 1 },
  { unique: true },
);

// The payroll screen reads "every employee's totals for this month".
attendanceSchema.index({ tenantId: 1, year: -1, month: -1 });

/**
 * @returns {boolean} whether the month is settled and immutable
 */
attendanceSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockedAt);
};

module.exports = mongoose.model('Attendance', attendanceSchema);
