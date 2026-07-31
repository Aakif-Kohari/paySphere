/**
 * Canonical attendance vocabulary for PaySphere.
 *
 * `AttendanceCalendarModal.jsx` already defines these five statuses on the
 * client, but they only ever existed there: the grid was collapsed into two
 * display strings ("– 3 days leave", "+ 12 hr overtime") and re-parsed on the
 * server by `parseTagValue`, which strips every non-digit out of a label. Half
 * days had no server-side representation at all and were silently dropped, and
 * paid leave was indistinguishable from unpaid once it reached the payroll
 * controller (#459).
 *
 * This module gives the statuses a single definition that the model, the
 * validator, the balance engine and the payroll integration all share, so the
 * client and the ledger can never disagree about what a day means.
 */

// --- Day statuses ----------------------------------------------------------

const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  HALF_DAY: 'half_day',
  /** Unpaid absence — reduces salary. */
  ABSENT: 'absent',
  /** Paid leave — consumes balance but does not reduce salary. */
  PAID_LEAVE: 'paid_leave',
  /** Present, with overtime hours logged against the day. */
  OVERTIME: 'overtime',
  /** Company holiday or weekly off. Neither worked nor deducted. */
  HOLIDAY: 'holiday',
};

const ALL_ATTENDANCE_STATUSES = Object.values(ATTENDANCE_STATUS);

/**
 * How each status contributes to the month's aggregates.
 *
 * `unpaidWeight` is the crucial column: it is what feeds `leaveDays` into the
 * salary calculator. A half day contributes 0.5, which is the behaviour the UI
 * already implied and the server never implemented.
 *
 * `paidLeaveWeight` drives the leave-balance ledger, and is deliberately
 * independent — a paid leave day costs the employee balance but costs the
 * employer nothing extra, while an unpaid day is the reverse.
 */
const STATUS_WEIGHTS = {
  [ATTENDANCE_STATUS.PRESENT]: {
    workedWeight: 1,
    unpaidWeight: 0,
    paidLeaveWeight: 0,
    allowsOvertime: false,
  },
  [ATTENDANCE_STATUS.HALF_DAY]: {
    workedWeight: 0.5,
    unpaidWeight: 0.5,
    paidLeaveWeight: 0,
    allowsOvertime: false,
  },
  [ATTENDANCE_STATUS.ABSENT]: {
    workedWeight: 0,
    unpaidWeight: 1,
    paidLeaveWeight: 0,
    allowsOvertime: false,
  },
  [ATTENDANCE_STATUS.PAID_LEAVE]: {
    workedWeight: 0,
    unpaidWeight: 0,
    paidLeaveWeight: 1,
    allowsOvertime: false,
  },
  [ATTENDANCE_STATUS.OVERTIME]: {
    workedWeight: 1,
    unpaidWeight: 0,
    paidLeaveWeight: 0,
    allowsOvertime: true,
  },
  [ATTENDANCE_STATUS.HOLIDAY]: {
    workedWeight: 0,
    unpaidWeight: 0,
    paidLeaveWeight: 0,
    // A holiday worked is the most common overtime case in a small business.
    allowsOvertime: true,
  },
};

/**
 * The legacy SCREAMING_SNAKE identifiers used by the existing modal, mapped
 * onto the canonical values so the client can be migrated independently of the
 * server.
 */
const LEGACY_STATUS_ALIASES = {
  PRESENT: ATTENDANCE_STATUS.PRESENT,
  HALF_DAY: ATTENDANCE_STATUS.HALF_DAY,
  ABSENT: ATTENDANCE_STATUS.ABSENT,
  PAID_LEAVE: ATTENDANCE_STATUS.PAID_LEAVE,
  OVERTIME: ATTENDANCE_STATUS.OVERTIME,
  HOLIDAY: ATTENDANCE_STATUS.HOLIDAY,
  // The modal labels ABSENT as "Unpaid Leave"; accept the obvious synonym.
  UNPAID_LEAVE: ATTENDANCE_STATUS.ABSENT,
};

/**
 * Coerce a status from any accepted spelling.
 *
 * @param {*} value
 * @returns {string|null} a canonical status, or null if unrecognised
 */
function normalizeAttendanceStatus(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (ALL_ATTENDANCE_STATUSES.includes(trimmed)) return trimmed;

  const upper = trimmed.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_ALIASES, upper)) {
    return LEGACY_STATUS_ALIASES[upper];
  }

  const lower = trimmed.toLowerCase();
  if (ALL_ATTENDANCE_STATUSES.includes(lower)) return lower;

  return null;
}

/**
 * @param {string} status
 * @returns {{workedWeight: number, unpaidWeight: number, paidLeaveWeight: number, allowsOvertime: boolean}}
 */
function weightsFor(status) {
  const canonical = normalizeAttendanceStatus(status);
  return (
    STATUS_WEIGHTS[canonical] || {
      workedWeight: 0,
      unpaidWeight: 0,
      paidLeaveWeight: 0,
      allowsOvertime: false,
    }
  );
}

// --- Bounds ----------------------------------------------------------------

/** No single day can carry more overtime than there are hours in it. */
const MAX_OVERTIME_HOURS_PER_DAY = 24;

/** Sanity ceiling on a month, catching a client that fans a value across days. */
const MAX_OVERTIME_HOURS_PER_MONTH = 400;

const MAX_DAY_NOTE_LENGTH = 200;

// --- Leave policy ----------------------------------------------------------

const ACCRUAL_MODE = {
  /** 1/12th of the annual entitlement credited each completed month. */
  MONTHLY: 'monthly',
  /** The whole entitlement credited on the first day of the leave year. */
  ANNUAL: 'annual',
};

/**
 * The policy applied when a company has not configured one.
 *
 * Deliberately conservative: 12 days a year accruing monthly, no carry-forward.
 * A company that wants something else sets it; a company that has never thought
 * about it gets a defensible default rather than an unbounded balance.
 */
const DEFAULT_LEAVE_POLICY = {
  annualPaidLeaveDays: 12,
  accrualMode: ACCRUAL_MODE.MONTHLY,
  carryForwardCapDays: 0,
  /** Month (1-12) the leave year starts in. April matches the Indian FY. */
  leaveYearStartMonth: 4,
  /** Whether a balance may go negative (leave taken in advance). */
  allowNegativeBalance: false,
};

module.exports = {
  ATTENDANCE_STATUS,
  ALL_ATTENDANCE_STATUSES,
  STATUS_WEIGHTS,
  LEGACY_STATUS_ALIASES,
  normalizeAttendanceStatus,
  weightsFor,
  MAX_OVERTIME_HOURS_PER_DAY,
  MAX_OVERTIME_HOURS_PER_MONTH,
  MAX_DAY_NOTE_LENGTH,
  ACCRUAL_MODE,
  DEFAULT_LEAVE_POLICY,
};
