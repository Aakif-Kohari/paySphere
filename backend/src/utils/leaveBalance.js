/**
 * Leave entitlement and balance engine.
 *
 * Pure functions: entitlement, accrual and consumption are computed from a
 * policy, a joining date and a list of month totals. No database access, so the
 * rules can be unit-tested against their boundaries in isolation (#459).
 *
 * Before this existed there was no notion of a leave balance at all. The
 * attendance modal distinguished paid from unpaid leave, but only unpaid days
 * survived into the payroll payload — so paid leave was granted without limit
 * and without record, and an employee could not be told how much they had left.
 */

const { ACCRUAL_MODE, DEFAULT_LEAVE_POLICY } = require('../config/attendance');

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Merge a partial company policy over the defaults, rejecting nonsense values
 * rather than letting them propagate into an entitlement figure.
 *
 * @param {object} policy
 * @returns {object} a complete, valid policy
 */
function resolvePolicy(policy) {
  const source = policy && typeof policy === 'object' ? policy : {};

  const annual = Number(source.annualPaidLeaveDays);
  const carryCap = Number(source.carryForwardCapDays);
  const startMonth = Number(source.leaveYearStartMonth);

  return {
    annualPaidLeaveDays:
      Number.isFinite(annual) && annual >= 0 && annual <= 365
        ? annual
        : DEFAULT_LEAVE_POLICY.annualPaidLeaveDays,
    accrualMode: Object.values(ACCRUAL_MODE).includes(source.accrualMode)
      ? source.accrualMode
      : DEFAULT_LEAVE_POLICY.accrualMode,
    carryForwardCapDays:
      Number.isFinite(carryCap) && carryCap >= 0 && carryCap <= 365
        ? carryCap
        : DEFAULT_LEAVE_POLICY.carryForwardCapDays,
    leaveYearStartMonth:
      Number.isInteger(startMonth) && startMonth >= 1 && startMonth <= 12
        ? startMonth
        : DEFAULT_LEAVE_POLICY.leaveYearStartMonth,
    allowNegativeBalance:
      typeof source.allowNegativeBalance === 'boolean'
        ? source.allowNegativeBalance
        : DEFAULT_LEAVE_POLICY.allowNegativeBalance,
  };
}

/**
 * The leave year containing a given month.
 *
 * With an April start, March 2027 belongs to leave year 2026 — the year is
 * named for the calendar year it *starts* in, which is how an Indian financial
 * year is conventionally labelled.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} leaveYearStartMonth
 * @returns {{startYear: number, startMonth: number, endYear: number, endMonth: number}}
 */
function resolveLeaveYear(year, month, leaveYearStartMonth) {
  const startYear = month >= leaveYearStartMonth ? year : year - 1;
  const endMonth = leaveYearStartMonth === 1 ? 12 : leaveYearStartMonth - 1;
  const endYear = leaveYearStartMonth === 1 ? startYear : startYear + 1;

  return {
    startYear,
    startMonth: leaveYearStartMonth,
    endYear,
    endMonth,
  };
}

/**
 * Whether a {year, month} falls inside a leave year, inclusive at both ends.
 *
 * @param {number} year
 * @param {number} month
 * @param {object} leaveYear output of resolveLeaveYear
 * @returns {boolean}
 */
function isWithinLeaveYear(year, month, leaveYear) {
  const point = year * 12 + month;
  const start = leaveYear.startYear * 12 + leaveYear.startMonth;
  const end = leaveYear.endYear * 12 + leaveYear.endMonth;
  return point >= start && point <= end;
}

/**
 * Count the months an employee has been employed within a leave year, up to and
 * including the month being asked about.
 *
 * A mid-year joiner accrues from their joining month, not from the start of the
 * leave year — crediting a full year's entitlement to someone who joined in
 * February would hand them eleven months of leave they have not earned.
 *
 * @param {object} params
 * @param {Date|string|null} params.joiningDate
 * @param {number} params.year
 * @param {number} params.month
 * @param {object} params.leaveYear
 * @returns {number} completed months, 0-12
 */
function monthsAccrued({ joiningDate, year, month, leaveYear }) {
  const upTo = year * 12 + month;
  const yearStart = leaveYear.startYear * 12 + leaveYear.startMonth;
  const yearEnd = leaveYear.endYear * 12 + leaveYear.endMonth;

  let from = yearStart;

  if (joiningDate) {
    const joined = new Date(joiningDate);
    if (!Number.isNaN(joined.getTime())) {
      const joinPoint = joined.getFullYear() * 12 + (joined.getMonth() + 1);
      from = Math.max(from, joinPoint);
    }
  }

  const to = Math.min(upTo, yearEnd);

  if (to < from) return 0;

  return to - from + 1;
}

/**
 * Entitlement accrued as at a given month.
 *
 * @param {object} params
 * @param {object} params.policy resolved policy
 * @param {Date|string|null} params.joiningDate
 * @param {number} params.year
 * @param {number} params.month
 * @returns {{entitlement: number, accrued: number, monthsAccrued: number, leaveYear: object}}
 */
function computeEntitlement({ policy, joiningDate, year, month }) {
  const resolved = resolvePolicy(policy);
  const leaveYear = resolveLeaveYear(year, month, resolved.leaveYearStartMonth);

  const months = monthsAccrued({ joiningDate, year, month, leaveYear });

  let accrued;

  if (resolved.accrualMode === ACCRUAL_MODE.ANNUAL) {
    // The whole entitlement lands at the start of the leave year — but a
    // mid-year joiner still gets nothing for months before they joined.
    accrued = months > 0 ? resolved.annualPaidLeaveDays : 0;
  } else {
    accrued = (resolved.annualPaidLeaveDays / 12) * months;
  }

  return {
    entitlement: resolved.annualPaidLeaveDays,
    accrued: round2(Math.min(accrued, resolved.annualPaidLeaveDays)),
    monthsAccrued: months,
    leaveYear,
  };
}

/**
 * Paid leave consumed within a leave year.
 *
 * @param {Array<{year: number, month: number, totals: object}>} monthlyTotals
 * @param {object} leaveYear
 * @returns {number}
 */
function computeConsumed(monthlyTotals, leaveYear) {
  const list = Array.isArray(monthlyTotals) ? monthlyTotals : [];

  const consumed = list.reduce((sum, record) => {
    if (!record || typeof record !== 'object') return sum;

    const year = Number(record.year);
    const month = Number(record.month);

    if (!Number.isInteger(year) || !Number.isInteger(month)) return sum;
    if (!isWithinLeaveYear(year, month, leaveYear)) return sum;

    const paid = Number(record.totals?.paidLeave);
    return Number.isFinite(paid) && paid > 0 ? sum + paid : sum;
  }, 0);

  return round2(consumed);
}

/**
 * The full balance snapshot for an employee as at a month.
 *
 * @param {object} params
 * @param {object} params.policy
 * @param {Date|string|null} params.joiningDate
 * @param {number} params.year
 * @param {number} params.month
 * @param {Array} params.monthlyTotals every recorded month for the employee
 * @param {number} [params.carriedForward] days brought in from the prior year
 * @returns {object}
 */
function computeLeaveBalance({
  policy,
  joiningDate,
  year,
  month,
  monthlyTotals = [],
  carriedForward = 0,
}) {
  const resolved = resolvePolicy(policy);
  const { entitlement, accrued, monthsAccrued: months, leaveYear } =
    computeEntitlement({ policy: resolved, joiningDate, year, month });

  const carried = Math.min(
    Math.max(Number(carriedForward) || 0, 0),
    resolved.carryForwardCapDays,
  );

  const consumed = computeConsumed(monthlyTotals, leaveYear);
  const available = round2(accrued + carried - consumed);

  return {
    policy: resolved,
    leaveYear,
    entitlement,
    monthsAccrued: months,
    accrued,
    carriedForward: round2(carried),
    consumed,
    available,
    // Surfaced rather than clamped: a negative balance is a real state the
    // employer needs to see, even when the policy forbids creating more of it.
    isOverdrawn: available < 0,
  };
}

/**
 * Whether a requested number of paid-leave days can be granted.
 *
 * @param {object} balance output of computeLeaveBalance
 * @param {number} requestedDays
 * @returns {{allowed: boolean, reason?: string, shortfall: number}}
 */
function canTakePaidLeave(balance, requestedDays) {
  const requested = Number(requestedDays);

  if (!Number.isFinite(requested) || requested <= 0) {
    return { allowed: true, shortfall: 0 };
  }

  const shortfall = round2(Math.max(0, requested - balance.available));

  if (shortfall === 0) return { allowed: true, shortfall: 0 };

  if (balance.policy.allowNegativeBalance) {
    return { allowed: true, shortfall };
  }

  return {
    allowed: false,
    shortfall,
    reason: `Only ${balance.available} paid leave day(s) available; ${requested} requested`,
  };
}

/**
 * Days eligible to carry into the next leave year.
 *
 * @param {object} balance
 * @returns {number}
 */
function computeCarryForward(balance) {
  const cap = balance?.policy?.carryForwardCapDays ?? 0;
  const available = Number(balance?.available) || 0;
  return round2(Math.min(Math.max(available, 0), cap));
}

module.exports = {
  resolvePolicy,
  resolveLeaveYear,
  isWithinLeaveYear,
  monthsAccrued,
  computeEntitlement,
  computeConsumed,
  computeLeaveBalance,
  canTakePaidLeave,
  computeCarryForward,
  round2,
};
