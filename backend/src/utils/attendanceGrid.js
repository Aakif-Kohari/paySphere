/**
 * Attendance grid validation and aggregation.
 *
 * Pure functions only — no database access — so the arithmetic that decides how
 * much of someone's salary is deducted can be unit-tested in isolation, the
 * same way `salaryCalculator.js` is (#459).
 *
 * The totals here are always recomputed server-side. The client sends the grid;
 * it does not send the summary. A client that could post its own totals could
 * post a month of absences with a total of zero unpaid days.
 */

const {
  ATTENDANCE_STATUS,
  normalizeAttendanceStatus,
  weightsFor,
  MAX_OVERTIME_HOURS_PER_DAY,
  MAX_OVERTIME_HOURS_PER_MONTH,
  MAX_DAY_NOTE_LENGTH,
} = require('../config/attendance');

/**
 * Days in a given month.
 *
 * #310 fixed a bug where the salary calculator divided by a hard-coded 30. The
 * attendance ledger must not reintroduce the same assumption: February has 28
 * or 29 days and a grid that accepts a 30th of February is a grid that can
 * deduct a day that does not exist.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isValidMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isValidYear(value) {
  return Number.isInteger(value) && value >= 2000 && value <= 2100;
}

/**
 * Coerce and bound a per-day overtime figure.
 *
 * @param {*} value
 * @returns {number} a finite value in [0, MAX_OVERTIME_HOURS_PER_DAY]
 */
function normalizeOvertimeHours(value) {
  const hours = Number(value);

  if (!Number.isFinite(hours) || hours <= 0) return 0;

  // Quarter-hour granularity: enough for a payroll product, and it stops
  // floating-point noise from accumulating across 31 days.
  const rounded = Math.round(hours * 4) / 4;

  return Math.min(rounded, MAX_OVERTIME_HOURS_PER_DAY);
}

/**
 * Validate and normalise a submitted grid.
 *
 * Returns the cleaned day list rather than mutating the input, plus a list of
 * per-row errors so the client can point at the offending day instead of
 * showing a generic "invalid request".
 *
 * @param {*} days raw `days` array from the request body
 * @param {number} year
 * @param {number} month 1-12
 * @returns {{ok: boolean, days: object[], errors: Array<{day: *, reason: string}>}}
 */
function validateGrid(days, year, month) {
  const errors = [];

  if (!Array.isArray(days)) {
    return {
      ok: false,
      days: [],
      errors: [{ day: null, reason: 'days must be an array' }],
    };
  }

  const total = daysInMonth(year, month);
  const seen = new Set();
  const cleaned = [];

  days.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push({ day: null, reason: `Entry at index ${index} is not an object` });
      return;
    }

    const day = Number(entry.day);

    if (!Number.isInteger(day) || day < 1 || day > total) {
      errors.push({
        day: entry.day,
        reason: `Day must be an integer between 1 and ${total} for ${month}/${year}`,
      });
      return;
    }

    if (seen.has(day)) {
      // Two rows for the same date would make the totals depend on iteration
      // order, which is not a property a payroll ledger may have.
      errors.push({ day, reason: 'Duplicate entry for this day' });
      return;
    }

    const status = normalizeAttendanceStatus(entry.status);
    if (!status) {
      errors.push({ day, reason: `Unknown attendance status: "${entry.status}"` });
      return;
    }

    const weights = weightsFor(status);
    const requestedOvertime = normalizeOvertimeHours(entry.overtimeHours);

    if (requestedOvertime > 0 && !weights.allowsOvertime) {
      errors.push({
        day,
        reason: `Overtime hours cannot be logged against a "${status}" day`,
      });
      return;
    }

    let note = '';
    if (entry.note !== undefined && entry.note !== null) {
      if (typeof entry.note !== 'string') {
        errors.push({ day, reason: 'Note must be a string' });
        return;
      }
      note = entry.note.trim().slice(0, MAX_DAY_NOTE_LENGTH);
    }

    seen.add(day);
    cleaned.push({
      day,
      status,
      overtimeHours: weights.allowsOvertime ? requestedOvertime : 0,
      note,
    });
  });

  // A single day cannot exceed 24 hours, but 31 days at 20 hours each is a
  // client bug rather than a real month of work.
  const monthOvertime = cleaned.reduce((sum, d) => sum + d.overtimeHours, 0);
  if (monthOvertime > MAX_OVERTIME_HOURS_PER_MONTH) {
    errors.push({
      day: null,
      reason: `Total overtime for the month (${monthOvertime}h) exceeds the maximum of ${MAX_OVERTIME_HOURS_PER_MONTH}h`,
    });
  }

  cleaned.sort((a, b) => a.day - b.day);

  return { ok: errors.length === 0, days: cleaned, errors };
}

/**
 * Round to two decimals without accumulating binary floating-point drift.
 *
 * Half days mean the aggregates are not integers, and #347 already showed what
 * unrounded sums do to a payroll total.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Recompute the month's aggregates from the grid.
 *
 * Always derived, never trusted from the client.
 *
 * @param {object[]} days a validated grid
 * @returns {{present: number, halfDay: number, paidLeave: number, unpaidLeave: number, holiday: number, overtimeHours: number, daysRecorded: number}}
 */
function computeTotals(days) {
  const list = Array.isArray(days) ? days : [];

  let present = 0;
  let halfDay = 0;
  let paidLeave = 0;
  let unpaidLeave = 0;
  let holiday = 0;
  let overtimeHours = 0;

  for (const entry of list) {
    const status = normalizeAttendanceStatus(entry?.status);
    if (!status) continue;

    const weights = weightsFor(status);

    present += weights.workedWeight;
    unpaidLeave += weights.unpaidWeight;
    paidLeave += weights.paidLeaveWeight;
    overtimeHours += normalizeOvertimeHours(entry.overtimeHours);

    if (status === ATTENDANCE_STATUS.HALF_DAY) halfDay += 1;
    if (status === ATTENDANCE_STATUS.HOLIDAY) holiday += 1;
  }

  return {
    present: round2(present),
    halfDay: round2(halfDay),
    paidLeave: round2(paidLeave),
    unpaidLeave: round2(unpaidLeave),
    holiday: round2(holiday),
    overtimeHours: round2(overtimeHours),
    daysRecorded: list.length,
  };
}

/**
 * Derive the two figures the salary calculator actually consumes.
 *
 * This is the whole point of the ledger: instead of `parseTagValue` scraping
 * digits out of the string "– 3 days leave", payroll reads structured totals
 * that were validated at write time.
 *
 * Only *unpaid* absence reduces salary. Paid leave is deliberately excluded —
 * the pre-#459 flow could not tell the two apart, so a company that granted
 * paid leave still docked the employee for it.
 *
 * @param {object} totals output of computeTotals
 * @returns {{leaveDays: number, overtimeHours: number}}
 */
function derivePayrollInputs(totals) {
  if (!totals || typeof totals !== 'object') {
    return { leaveDays: 0, overtimeHours: 0 };
  }

  const leaveDays = Number(totals.unpaidLeave);
  const overtimeHours = Number(totals.overtimeHours);

  return {
    leaveDays: Number.isFinite(leaveDays) && leaveDays > 0 ? round2(leaveDays) : 0,
    overtimeHours:
      Number.isFinite(overtimeHours) && overtimeHours > 0 ? round2(overtimeHours) : 0,
  };
}

/**
 * Build a default grid for a month that has never been recorded.
 *
 * Sundays default to `holiday` rather than `paid_leave`. The existing modal
 * defaults them to PAID_LEAVE, which quietly consumes a day of the employee's
 * leave entitlement for every Sunday in the month — 52 days a year against a
 * 12-day allowance. A weekly off is not leave.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {number[]} weeklyOffDays JS day indices (0 = Sunday)
 * @returns {object[]}
 */
function buildDefaultGrid(year, month, weeklyOffDays = [0]) {
  const total = daysInMonth(year, month);
  const offSet = new Set(Array.isArray(weeklyOffDays) ? weeklyOffDays : [0]);
  const grid = [];

  for (let day = 1; day <= total; day += 1) {
    const weekday = new Date(year, month - 1, day).getDay();
    grid.push({
      day,
      status: offSet.has(weekday)
        ? ATTENDANCE_STATUS.HOLIDAY
        : ATTENDANCE_STATUS.PRESENT,
      overtimeHours: 0,
      note: '',
    });
  }

  return grid;
}

module.exports = {
  daysInMonth,
  isValidMonth,
  isValidYear,
  normalizeOvertimeHours,
  validateGrid,
  computeTotals,
  derivePayrollInputs,
  buildDefaultGrid,
  round2,
};
