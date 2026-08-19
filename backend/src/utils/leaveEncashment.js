/**
 * Leave year-end closure: carry-forward, lapse and encashment.
 *
 * Pure functions — no database access — for the same reason `leaveAccrual.js`
 * and `leaveBalance.js` are pure: this decides how many days an employee keeps
 * and how much money they are paid for the rest, and that has to be testable
 * against its boundaries in isolation (#1159).
 *
 * The leave module has shipped models and two engines since #646 and has never
 * had a controller or a router, so none of it is reachable over HTTP. The
 * year-end close is the part of that gap with a cost attached:
 *
 *   - `calculateCarryForward()` in `leaveAccrual.js` splits a balance into
 *     carried and lapsed, and is called from nowhere. Balances therefore roll
 *     forward in full for ever: `carriedForwardFromLastYear` is written by no
 *     code path and `maxCarryForward` on the policy has no effect.
 *   - There is no encashment at all. Earned leave above the carry cap is
 *     normally paid out rather than lapsed, and that payment has to reach
 *     payroll.
 *   - `maxAccumulation` is declared on the policy and enforced nowhere.
 *
 * The invariant everything here is built around is that a closing balance is
 * conserved:
 *
 *     carriedForward + encashedDays + lapsedDays === closingBalance
 *
 * A day that is neither kept, nor paid for, nor explicitly written off is a
 * day an employee earned and silently lost.
 */

'use strict';

/** What an encashment day is priced from. */
const RATE_BASIS = {
  /** Basic pay only — the conventional Indian basis for leave encashment. */
  BASIC: 'basic',
  /** Full gross. */
  GROSS: 'gross',
};

/**
 * Days in a month for the per-day rate.
 *
 * A fixed divisor rather than the actual length of the month: encashment is
 * paid against a leave year, not against a particular month, so using the
 * calendar would make the same balance worth 3% more if the close happened to
 * be run in February.
 */
const DEFAULT_MONTH_DAYS = 30;

/**
 * Basic as a share of gross, where the employee record does not carry a basic
 * figure of its own.
 *
 * `employee.model.js` holds `monthlySalary` and nothing else, so for a policy
 * priced on basic there is otherwise nothing to price from. 50% is the usual
 * structure and the number is a policy field, so a company whose split differs
 * sets it rather than being silently mispaid.
 */
const DEFAULT_BASIC_PERCENT_OF_GROSS = 50;

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * A finite number, or a fallback.
 *
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * A cap that may legitimately be absent.
 *
 * `null` on `maxCarryForward` means "no limit", which is not the same as zero —
 * reading an absent cap as 0 would lapse an employee's whole balance.
 *
 * @param {*} value
 * @returns {number} the cap, or Infinity when unset
 */
function capOrInfinity(value) {
  if (value === null || value === undefined || value === '') return Infinity;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Infinity;
  return parsed;
}

/**
 * The per-day rate an encashment is paid at.
 *
 * @param {object} employee
 * @param {object} policy
 * @returns {object}
 */
function resolveEncashmentRate(employee, policy = {}) {
  const gross = Math.max(0, num(employee?.monthlySalary));

  const basicPercent = num(
    policy.basicPercentOfGross,
    DEFAULT_BASIC_PERCENT_OF_GROSS,
  );

  // An explicit basic on the employee record wins; otherwise it is derived from
  // gross using the policy's split.
  const basic = Number.isFinite(Number(employee?.basicSalary))
    ? Math.max(0, Number(employee.basicSalary))
    : round2((gross * Math.min(Math.max(basicPercent, 0), 100)) / 100);

  const basis =
    policy.encashmentRateBasis === RATE_BASIS.GROSS
      ? RATE_BASIS.GROSS
      : RATE_BASIS.BASIC;

  const monthlyAmount = basis === RATE_BASIS.GROSS ? gross : basic;

  const monthDays = (() => {
    const configured = num(policy.encashmentMonthDays, DEFAULT_MONTH_DAYS);
    // A zero or negative divisor would make the rate infinite. Fall back rather
    // than propagate it into a payroll line.
    return configured > 0 ? configured : DEFAULT_MONTH_DAYS;
  })();

  return {
    basis,
    gross: round2(gross),
    basic: round2(basic),
    monthlyAmount: round2(monthlyAmount),
    monthDays,
    perDayRate: round2(monthlyAmount / monthDays),
  };
}

/**
 * Split a closing leave balance into carried, encashed and lapsed.
 *
 * The order the rules are applied in is the whole of the design, so it is
 * spelled out:
 *
 *   1. **Carry** as much as the caps allow. `maxCarryForward` and
 *      `maxAccumulation` are both ceilings on the carried figure and the
 *      tighter of the two wins — `maxAccumulation` is a ceiling on the total
 *      balance an employee may ever hold, so a higher `maxCarryForward` cannot
 *      lift it.
 *   2. **Retain** a minimum. Where the policy sets a retention floor, the
 *      carried figure is raised to meet it even if a cap would have kept it
 *      lower — the floor exists so an employee is not left with nothing after
 *      a close, and a cap that overrode it would defeat that.
 *   3. **Encash** the excess, if the leave type is encashable, up to the
 *      encashment ceiling.
 *   4. **Lapse** whatever is left. Explicitly, and reported, rather than by
 *      subtraction happening somewhere nobody looks.
 *
 * @param {object} balance a LeaveBalance document
 * @param {object} policy the LeavePolicy governing it
 * @param {object} employee the employee, for the encashment rate
 * @returns {object}
 */
function computeYearEndClosure(balance, policy = {}, employee = {}) {
  const closingBalance = round2(Math.max(0, num(balance?.currentBalance)));

  const carryCap = capOrInfinity(policy.maxCarryForward);
  const accumulationCap = capOrInfinity(policy.maxAccumulation);
  const effectiveCarryCap = Math.min(carryCap, accumulationCap);

  let carriedForward = round2(Math.min(closingBalance, effectiveCarryCap));

  // The retention floor cannot conjure days that were never earned, so it is
  // bounded by the closing balance before it is applied.
  const retentionFloor = round2(
    Math.min(Math.max(0, num(policy.minRetentionDays)), closingBalance),
  );

  const retentionRaisedCarry = retentionFloor > carriedForward;
  if (retentionRaisedCarry) carriedForward = retentionFloor;

  const excess = round2(Math.max(0, closingBalance - carriedForward));

  const isEncashable = policy.isEncashable === true;
  const encashmentCap = capOrInfinity(policy.maxEncashmentDays);

  const encashedDays = isEncashable
    ? round2(Math.min(excess, encashmentCap))
    : 0;

  // Whatever is neither kept nor paid for. On a non-encashable leave type this
  // is the whole excess, which is the correct and deliberately visible outcome
  // for casual or sick leave.
  const lapsedDays = round2(excess - encashedDays);

  const rate = resolveEncashmentRate(employee, policy);
  const encashedAmount = round2(encashedDays * rate.perDayRate);

  return {
    employeeId: balance?.employeeId ? String(balance.employeeId) : null,
    policyId: balance?.policyId ? String(balance.policyId) : null,
    leaveType: balance?.leaveType || policy.leaveType || null,
    year: num(balance?.year, null),

    closingBalance,
    carriedForward,
    encashedDays,
    encashedAmount,
    lapsedDays,

    rate,
    isEncashable,
    // Reported so a close can explain itself rather than just producing
    // numbers. HR fields the question "why did I lose eight days?" and needs
    // to be able to answer it from the record.
    appliedCaps: {
      carryForwardCap: Number.isFinite(carryCap) ? carryCap : null,
      accumulationCap: Number.isFinite(accumulationCap)
        ? accumulationCap
        : null,
      encashmentCap: Number.isFinite(encashmentCap) ? encashmentCap : null,
      retentionFloor,
      accumulationCapBound: accumulationCap < carryCap,
      retentionRaisedCarry,
    },
  };
}

/**
 * Whether a leave year has already been closed for a balance.
 *
 * With no record of this the close is not idempotent: a second run carries
 * forward and encashes again, and the employee is paid twice for days they
 * only earned once (#1159).
 *
 * @param {object} balance
 * @param {number} year
 * @returns {boolean}
 */
function isAlreadyClosed(balance, year) {
  return num(balance?.closedForYear, null) === Number(year);
}

/**
 * Run the close across a tenant, with the rollup payroll needs.
 *
 * Balances whose year has already been closed are skipped and reported rather
 * than silently reprocessed, and balances with no matching policy are reported
 * as blocked rather than closed against a default nobody chose.
 *
 * @param {object[]} balances
 * @param {object[]} policies
 * @param {object[]} employees
 * @param {object} [options]
 * @param {number} [options.year] the leave year being closed
 * @returns {object}
 */
function computeClosureBatch(balances, policies, employees, options = {}) {
  const list = Array.isArray(balances) ? balances : [];

  const policyById = new Map(
    (Array.isArray(policies) ? policies : []).map((policy) => [
      String(policy._id ?? policy.id ?? ''),
      policy,
    ]),
  );

  const employeeById = new Map(
    (Array.isArray(employees) ? employees : []).map((employee) => [
      String(employee._id ?? employee.id ?? ''),
      employee,
    ]),
  );

  const closures = [];
  const skipped = [];
  const blocked = [];

  for (const balance of list) {
    const year =
      options.year !== undefined ? Number(options.year) : num(balance?.year);

    if (isAlreadyClosed(balance, year)) {
      skipped.push({
        balanceId: balance._id ? String(balance._id) : null,
        employeeId: balance.employeeId ? String(balance.employeeId) : null,
        reason: `Leave year ${year} is already closed for this balance`,
      });
      continue;
    }

    const policy = policyById.get(String(balance?.policyId));

    if (!policy) {
      // Closing against a default would apply carry and encashment rules
      // nobody configured, to money.
      blocked.push({
        balanceId: balance._id ? String(balance._id) : null,
        employeeId: balance.employeeId ? String(balance.employeeId) : null,
        reason: 'No leave policy found for this balance',
      });
      continue;
    }

    const employee = employeeById.get(String(balance?.employeeId));

    const closure = computeYearEndClosure(balance, policy, employee || {});

    closures.push({
      ...closure,
      balanceId: balance._id ? String(balance._id) : null,
      employeeName: employee?.fullName || null,
      policyName: policy.name || null,
      year,
    });
  }

  const sum = (key) =>
    round2(closures.reduce((total, closure) => total + closure[key], 0));

  return {
    year: options.year !== undefined ? Number(options.year) : null,
    processedCount: closures.length,
    skippedCount: skipped.length,
    blockedCount: blocked.length,
    closures,
    skipped,
    blocked,
    totals: {
      closingBalance: sum('closingBalance'),
      carriedForward: sum('carriedForward'),
      encashedDays: sum('encashedDays'),
      encashedAmount: sum('encashedAmount'),
      lapsedDays: sum('lapsedDays'),
    },
    // A close that cannot price every balance is one finance should look at
    // before it is committed.
    isComplete: blocked.length === 0,
  };
}

/**
 * Turn encashments into payroll-ready earning lines.
 *
 * One line per employee rather than per leave type: an employee holding earned
 * and compensatory balances is paid once, and a payslip carrying two
 * "Leave Encashment" rows invites a query every single time.
 *
 * @param {object[]} closures
 * @returns {object[]}
 */
function buildEncashmentPayrollLines(closures) {
  const list = Array.isArray(closures) ? closures : [];

  const byEmployee = new Map();

  for (const closure of list) {
    if (!closure || closure.encashedDays <= 0) continue;

    const key = String(closure.employeeId ?? '');
    if (!key) continue;

    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: key,
        employeeName: closure.employeeName || null,
        component: 'Leave Encashment',
        // Encashment is taxable earnings for a serving employee, so it is
        // flagged rather than left for the payroll step to guess.
        isTaxable: true,
        days: 0,
        amount: 0,
        breakdown: [],
      });
    }

    const line = byEmployee.get(key);

    line.days = round2(line.days + closure.encashedDays);
    line.amount = round2(line.amount + closure.encashedAmount);
    line.breakdown.push({
      leaveType: closure.leaveType,
      days: closure.encashedDays,
      perDayRate: closure.rate?.perDayRate ?? 0,
      amount: closure.encashedAmount,
    });
  }

  return [...byEmployee.values()].sort((a, b) =>
    String(a.employeeId).localeCompare(String(b.employeeId)),
  );
}

/**
 * Computes statutory daily rate restricted strictly to Basic + DA for encashment (Section 79 Factories Act).
 *
 * @param {object} employee
 * @param {object} [policy={}]
 * @returns {number}
 */
function computeStatutoryDailyRate(employee = {}, policy = {}) {
  const basicSalary = Number(employee.basicSalary);
  const monthlySalary = Number(employee.monthlySalary);
  const basicPercent = Number(policy.basicPercentOfGross) || DEFAULT_BASIC_PERCENT_OF_GROSS;

  const basic = Number.isFinite(basicSalary) && basicSalary > 0
    ? basicSalary
    : Number.isFinite(monthlySalary) && monthlySalary > 0
      ? (monthlySalary * basicPercent) / 100
      : 0;

  return round2(basic / DEFAULT_MONTH_DAYS);
}

/**
 * Transforms closed year balances with carried-forward days into opening balances for next year.
 *
 * @param {object[]} closures
 * @param {number} nextYear
 * @returns {object[]}
 */
function generateNextYearOpeningBalances(closures = [], nextYear) {
  const operations = [];

  for (const c of closures) {
    if (!c || c.carriedForward <= 0) continue;

    operations.push({
      tenantId: c.tenantId,
      employeeId: c.employeeId,
      policyId: c.policyId,
      leaveType: c.leaveType,
      year: nextYear,
      carriedForwardFromLastYear: c.carriedForward,
      openingBalance: c.carriedForward,
      accruedLeaves: 0,
      usedLeaves: 0,
      closingBalance: c.carriedForward,
    });
  }

  return operations;
}

module.exports = {
  RATE_BASIS,
  DEFAULT_MONTH_DAYS,
  DEFAULT_BASIC_PERCENT_OF_GROSS,
  round2,
  capOrInfinity,
  resolveEncashmentRate,
  computeYearEndClosure,
  isAlreadyClosed,
  computeClosureBatch,
  buildEncashmentPayrollLines,
  computeStatutoryDailyRate,
  generateNextYearOpeningBalances,
};

