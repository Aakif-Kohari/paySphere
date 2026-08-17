/**
 * Full & Final settlement engine (#462).
 *
 * Pure functions — no database access — so every statutory boundary can be
 * tested in isolation, matching how `salaryCalculator.js` is written.
 *
 * Each computed figure is returned with an `explanation`, because an F&F is a
 * document handed to a departing employee and "why is this number what it is?"
 * is the first question they ask.
 */

const {
  GRATUITY,
  PRORATION_BASIS,
  DEFAULT_SETTLEMENT_POLICY,
} = require('../config/employment');

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Days in a month — the real number.
 *
 * #310 fixed a hard-coded `/30` divisor in the salary calculator. A settlement
 * that reintroduced it would overpay every February leaver and underpay every
 * 31-day-month leaver.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Parse a date defensively.
 *
 * @param {*} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Working days in a month, excluding the configured weekly offs.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} upToDay
 * @param {number[]} weeklyOffDays JS day indices (0 = Sunday)
 * @returns {number}
 */
function workingDaysUpTo(year, month, upToDay, weeklyOffDays = [0]) {
  const offs = new Set(Array.isArray(weeklyOffDays) ? weeklyOffDays : [0]);
  let count = 0;

  for (let day = 1; day <= upToDay; day += 1) {
    if (!offs.has(new Date(year, month - 1, day).getDay())) count += 1;
  }

  return count;
}

/**
 * Prorate the final month up to the last working day.
 *
 * This is the figure the `isActive` toggle could not produce at all: flipping
 * the flag before the run excluded the employee entirely (they got nothing),
 * flipping it after paid the full month (they were overpaid).
 *
 * @param {number} monthlySalary
 * @param {Date|string} lastWorkingDay
 * @param {object} [options]
 * @returns {{amount: number, daysWorked: number, daysInMonth: number, basis: string, explanation: string}}
 */
function computeProratedSalary(monthlySalary, lastWorkingDay, options = {}) {
  const salary = Number(monthlySalary);
  const lwd = parseDate(lastWorkingDay);

  if (!Number.isFinite(salary) || salary <= 0 || !lwd) {
    return {
      amount: 0,
      daysWorked: 0,
      daysInMonth: 0,
      basis: options.basis || PRORATION_BASIS.CALENDAR,
      explanation: 'No prorated salary — the salary or last working day is missing',
    };
  }

  const year = lwd.getFullYear();
  const month = lwd.getMonth() + 1;
  const dayOfMonth = lwd.getDate();
  const totalCalendarDays = daysInMonth(year, month);
  const basis = options.basis === PRORATION_BASIS.WORKING
    ? PRORATION_BASIS.WORKING
    : PRORATION_BASIS.CALENDAR;

  let daysWorked;
  let totalDays;

  if (basis === PRORATION_BASIS.WORKING) {
    const weeklyOffDays = options.weeklyOffDays || [0];
    daysWorked = workingDaysUpTo(year, month, dayOfMonth, weeklyOffDays);
    totalDays = workingDaysUpTo(year, month, totalCalendarDays, weeklyOffDays);
  } else {
    daysWorked = dayOfMonth;
    totalDays = totalCalendarDays;
  }

  if (totalDays <= 0) {
    return {
      amount: 0,
      daysWorked: 0,
      daysInMonth: totalCalendarDays,
      basis,
      explanation: 'No payable days in the final month',
    };
  }

  const amount = round2((salary * daysWorked) / totalDays);

  return {
    amount,
    daysWorked,
    daysInMonth: totalDays,
    basis,
    explanation: `${daysWorked} of ${totalDays} ${basis} days worked in the final month (${round2(salary)} × ${daysWorked}/${totalDays})`,
  };
}

/**
 * Encashment for unused paid leave.
 *
 * @param {object} params
 * @returns {{amount: number, encashableDays: number, dailyRate: number, capApplied: boolean, explanation: string}}
 */
function computeLeaveEncashment({
  unusedLeaveDays,
  monthlySalary,
  capDays = DEFAULT_SETTLEMENT_POLICY.leaveEncashmentCapDays,
  dailyRate,
}) {
  const unused = Number(unusedLeaveDays);
  const salary = Number(monthlySalary);

  if (!Number.isFinite(unused) || unused <= 0) {
    return {
      amount: 0,
      encashableDays: 0,
      dailyRate: 0,
      capApplied: false,
      explanation: 'No unused leave to encash',
    };
  }

  const cap = Number.isFinite(Number(capDays)) ? Math.max(Number(capDays), 0) : 0;

  if (cap === 0) {
    return {
      amount: 0,
      encashableDays: 0,
      dailyRate: 0,
      capApplied: true,
      explanation: 'Leave encashment is disabled by policy',
    };
  }

  const encashableDays = Math.min(unused, cap);
  const capApplied = unused > cap;

  // The 26-day divisor matches the gratuity convention: a paid day is a
  // *working* day, not a calendar day.
  const rate = Number.isFinite(Number(dailyRate)) && Number(dailyRate) > 0
    ? Number(dailyRate)
    : Number.isFinite(salary) && salary > 0
      ? salary / GRATUITY.MONTH_DAYS
      : 0;

  const amount = round2(rate * encashableDays);

  return {
    amount,
    encashableDays: round2(encashableDays),
    dailyRate: round2(rate),
    capApplied,
    explanation: capApplied
      ? `${round2(unused)} unused day(s) capped at the policy limit of ${cap}, encashed at ${round2(rate)}/day`
      : `${round2(encashableDays)} unused day(s) encashed at ${round2(rate)}/day`,
  };
}

/**
 * Completed years of service, applying the ≥6-month rounding rule.
 *
 * @param {Date|string} joiningDate
 * @param {Date|string} lastWorkingDay
 * @returns {{years: number, rawMonths: number, roundedUp: boolean}}
 */
function computeServiceYears(joiningDate, lastWorkingDay) {
  const start = parseDate(joiningDate);
  const end = parseDate(lastWorkingDay);

  if (!start || !end || end < start) {
    return { years: 0, rawMonths: 0, roundedUp: false };
  }

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  // Only count the final month if the day-of-month has been reached.
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(months, 0);

  const wholeYears = Math.floor(months / 12);
  const remainderMonths = months % 12;
  const roundedUp = remainderMonths >= GRATUITY.ROUND_UP_MONTHS;

  return {
    years: wholeYears + (roundedUp ? 1 : 0),
    rawMonths: months,
    roundedUp,
  };
}

/**
 * Statutory gratuity: (last drawn wages × 15 × completed years) / 26.
 *
 * @param {object} params
 * @returns {{amount: number, eligible: boolean, years: number, ceilingApplied: boolean, explanation: string}}
 */
function computeGratuity({
  joiningDate,
  lastWorkingDay,
  lastDrawnBasic,
  enabled = true,
}) {
  if (!enabled) {
    return {
      amount: 0,
      eligible: false,
      years: 0,
      ceilingApplied: false,
      explanation: 'Gratuity is disabled by policy',
    };
  }

  const service = computeServiceYears(joiningDate, lastWorkingDay);
  const wages = Number(lastDrawnBasic);

  if (service.rawMonths === 0 || !Number.isFinite(wages) || wages <= 0) {
    return {
      amount: 0,
      eligible: false,
      years: service.years,
      ceilingApplied: false,
      explanation: 'Not eligible — service or last drawn wages could not be determined',
    };
  }

  // The five-year gate is applied to *actual* completed service, before the
  // ≥6-month rounding: someone at 4 years 7 months has not completed five
  // years, even though the gratuity formula would round their service to 5.
  const actualCompletedYears = Math.floor(service.rawMonths / 12);

  if (actualCompletedYears < GRATUITY.ELIGIBILITY_YEARS) {
    return {
      amount: 0,
      eligible: false,
      years: service.years,
      ceilingApplied: false,
      explanation: `Not eligible — ${actualCompletedYears} completed year(s) of service, ${GRATUITY.ELIGIBILITY_YEARS} required`,
    };
  }

  const raw = (wages * GRATUITY.DAYS_PER_YEAR * service.years) / GRATUITY.MONTH_DAYS;
  const ceilingApplied = raw > GRATUITY.CEILING;
  const amount = round2(Math.min(raw, GRATUITY.CEILING));

  return {
    amount,
    eligible: true,
    years: service.years,
    ceilingApplied,
    explanation: ceilingApplied
      ? `Capped at the statutory ceiling of ${GRATUITY.CEILING}`
      : `${round2(wages)} × ${GRATUITY.DAYS_PER_YEAR} × ${service.years} year(s) / ${GRATUITY.MONTH_DAYS}${service.roundedUp ? ' (part-year of 6+ months rounded up)' : ''}`,
  };
}

/**
 * Recovery for an unserved notice period.
 *
 * @param {object} params
 * @returns {{amount: number, shortfallDays: number, dailyRate: number, explanation: string}}
 */
function computeNoticeShortfall({
  noticePeriodDays,
  noticeServedDays,
  monthlySalary,
  dailyRate,
}) {
  const required = Number(noticePeriodDays);
  const served = Number(noticeServedDays);

  if (!Number.isFinite(required) || required <= 0) {
    return {
      amount: 0,
      shortfallDays: 0,
      dailyRate: 0,
      explanation: 'No notice period required',
    };
  }

  const servedDays = Number.isFinite(served) && served > 0 ? served : 0;
  const shortfallDays = Math.max(required - servedDays, 0);

  if (shortfallDays === 0) {
    return {
      amount: 0,
      shortfallDays: 0,
      dailyRate: 0,
      explanation: `Full notice period of ${required} day(s) served`,
    };
  }

  const salary = Number(monthlySalary);
  const rate = Number.isFinite(Number(dailyRate)) && Number(dailyRate) > 0
    ? Number(dailyRate)
    : Number.isFinite(salary) && salary > 0
      ? salary / GRATUITY.MONTH_DAYS
      : 0;

  return {
    amount: round2(rate * shortfallDays),
    shortfallDays,
    dailyRate: round2(rate),
    explanation: `${shortfallDays} of ${required} notice day(s) unserved, recovered at ${round2(rate)}/day`,
  };
}

/**
 * Build the full settlement statement.
 *
 * @param {object} input
 * @returns {object}
 */
function buildSettlement(input = {}) {
  const policy = { ...DEFAULT_SETTLEMENT_POLICY, ...(input.policy || {}) };

  const monthlySalary = Number(input.monthlySalary) || 0;
  const lastWorkingDay = parseDate(input.lastWorkingDay);

  const prorated = computeProratedSalary(monthlySalary, lastWorkingDay, {
    basis: policy.prorationBasis,
    weeklyOffDays: input.weeklyOffDays,
  });

  const encashment = computeLeaveEncashment({
    unusedLeaveDays: input.unusedLeaveDays,
    monthlySalary,
    capDays: policy.leaveEncashmentCapDays,
  });

  const gratuity = computeGratuity({
    joiningDate: input.joiningDate,
    lastWorkingDay,
    // Falls back to the full salary when no Basic is known, which is the
    // conservative direction — it never *under*-pays the employee.
    lastDrawnBasic: input.lastDrawnBasic || monthlySalary,
    enabled: policy.gratuityEnabled,
  });

  // Notice recovery only applies when the caller has actually said something
  // about notice. Falling back to the policy default with zero days served
  // would silently deduct a month's salary from anyone whose settlement was
  // computed without notice information — a surprise recovery, not a policy.
  const noticeSpecified =
    input.noticePeriodDays !== undefined || input.noticeServedDays !== undefined;

  const notice = noticeSpecified
    ? computeNoticeShortfall({
        noticePeriodDays:
          input.noticePeriodDays !== undefined
            ? input.noticePeriodDays
            : policy.defaultNoticePeriodDays,
        noticeServedDays: input.noticeServedDays,
        monthlySalary,
      })
    : {
        amount: 0,
        shortfallDays: 0,
        dailyRate: 0,
        explanation: 'No notice-period recovery applied',
      };

  const bonus = Math.max(Number(input.bonus) || 0, 0);
  const otherEarnings = Math.max(Number(input.otherEarnings) || 0, 0);
  const advanceRecovery = Math.max(Number(input.advanceRecovery) || 0, 0);
  const assetRecovery = Math.max(Number(input.assetRecovery) || 0, 0);
  const otherDeductions = Math.max(Number(input.otherDeductions) || 0, 0);

  const earnings = {
    proratedSalary: prorated.amount,
    daysWorked: prorated.daysWorked,
    daysInMonth: prorated.daysInMonth,
    leaveEncashment: encashment.amount,
    encashableDays: encashment.encashableDays,
    gratuity: gratuity.amount,
    gratuityYears: gratuity.years,
    bonus: round2(bonus),
    other: round2(otherEarnings),
  };

  const deductions = {
    noticeShortfall: notice.amount,
    noticeShortfallDays: notice.shortfallDays,
    advanceRecovery: round2(advanceRecovery),
    assetRecovery: round2(assetRecovery),
    other: round2(otherDeductions),
  };

  const grossEarnings = round2(
    earnings.proratedSalary +
      earnings.leaveEncashment +
      earnings.gratuity +
      earnings.bonus +
      earnings.other,
  );

  const totalDeductions = round2(
    deductions.noticeShortfall +
      deductions.advanceRecovery +
      deductions.assetRecovery +
      deductions.other,
  );

  const netSettlement = round2(grossEarnings - totalDeductions);

  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netSettlement,
    // Every figure carries its reasoning, because an F&F is a document handed
    // to a departing employee.
    explanations: {
      proratedSalary: prorated.explanation,
      leaveEncashment: encashment.explanation,
      gratuity: gratuity.explanation,
      noticeShortfall: notice.explanation,
    },
    policy,
  };
}

/**
 * Whether a settlement may be committed.
 *
 * A negative net settlement means the employee owes the company more than they
 * are owed. That is a real situation, but it must be an explicit decision
 * rather than something that happens because a recovery figure was mistyped.
 *
 * @param {object} settlement
 * @param {object} [options]
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateSettlement(settlement, options = {}) {
  const errors = [];

  if (!settlement || typeof settlement !== 'object') {
    return { ok: false, errors: ['Settlement is missing'] };
  }

  if (!Number.isFinite(settlement.netSettlement)) {
    errors.push('Net settlement could not be calculated');
  }

  if (settlement.netSettlement < 0 && !options.allowNegative) {
    errors.push(
      `Net settlement is negative (${settlement.netSettlement}). Confirm the recovery amounts, or set allowNegative to proceed.`,
    );
  }

  if (settlement.grossEarnings < 0) {
    errors.push('Gross earnings cannot be negative');
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  round2,
  daysInMonth,
  parseDate,
  workingDaysUpTo,
  computeProratedSalary,
  computeLeaveEncashment,
  computeServiceYears,
  computeGratuity,
  computeNoticeShortfall,
  buildSettlement,
  validateSettlement,
};
