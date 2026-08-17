/**
 * @fileoverview Per-diem entitlement, travel policy checks and advance settlement.
 * @description Pure functions — no Mongoose, no I/O, no clock.
 *
 * Issue: #1077
 *
 * `expenseClaim.model.js` handles money an employee has already spent: a receipt
 * goes in, an approver signs it off, #719's flow reimburses it in the next
 * payroll run. Business travel does not fit that shape and was being forced into
 * it anyway.
 *
 * Travel is *pre-approved*, it is *funded in advance*, and a large part of its
 * cost — per-diem — has **no receipt at all**. It is an entitlement computed
 * from policy: so many rupees a day, by grade and by the class of city travelled
 * to, with defined rules for the part-days at each end of a trip.
 *
 * The consequence of not modelling it is an accounting hole rather than a
 * missing screen. An employee is given a ₹40,000 advance, spends ₹31,500, and
 * the ₹8,500 difference has to come back through payroll. Nothing in PaySphere
 * tracked an outstanding travel advance, so that recovery depended on somebody
 * remembering.
 *
 * Two things in here are policy made explicit rather than assumed:
 *
 *   - **The part-day rule is a policy field, not a constant.** Whether a
 *     departure after noon is half a day or a whole one is a decision each
 *     company makes, and burying either answer in the calculator makes the
 *     product wrong for whoever chose the other.
 *
 *   - **A single-day trip is never zero days.** Someone who flies out at 2pm and
 *     back at 9pm has travelled, eaten and spent. Naive `to − from` arithmetic
 *     gives zero, which is the one answer that is definitely wrong.
 */

'use strict';

/** City classes, in the order used for rate lookup. */
const CITY_CLASS = Object.freeze({
  A: 'A',
  B: 'B',
  C: 'C',
  INTERNATIONAL: 'International',
});

/** How the part-days at each end of a trip are counted. */
const PART_DAY_RULE = Object.freeze({
  HALF: 'half',
  FULL: 'full',
});

const TRAVEL_MODE = Object.freeze({
  AIR: 'Air',
  RAIL: 'Rail',
  ROAD: 'Road',
});

/**
 * Travel classes, cheapest first, per mode.
 *
 * Ordered arrays rather than a rank map because "is this class above the
 * entitlement" is an index comparison, and an index comparison cannot disagree
 * with itself the way two hand-maintained rank tables can.
 */
const TRAVEL_CLASS_ORDER = Object.freeze({
  [TRAVEL_MODE.AIR]: ['Economy', 'PremiumEconomy', 'Business', 'First'],
  [TRAVEL_MODE.RAIL]: ['Sleeper', 'AC3', 'AC2', 'AC1'],
  [TRAVEL_MODE.ROAD]: ['Bus', 'Taxi', 'Chauffeur'],
});

const REQUEST_STATUS = Object.freeze({
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  SETTLED: 'Settled',
});

const SETTLEMENT_TYPE = Object.freeze({
  REIMBURSEMENT: 'reimbursement',
  RECOVERY: 'recovery',
  SETTLED: 'settled',
});

/**
 * Which payroll component each settlement direction posts to.
 *
 * A lookup rather than a conditional, so the mapping is stated once and a caller
 * cannot end up with a reimbursement posted as a deduction.
 */
const PAYROLL_COMPONENT = Object.freeze({
  [SETTLEMENT_TYPE.REIMBURSEMENT]: 'travel_reimbursement',
  [SETTLEMENT_TYPE.RECOVERY]: 'travel_advance_recovery',
  [SETTLEMENT_TYPE.SETTLED]: null,
});

const MS_PER_DAY = 86400000;

/**
 * Round to two decimals.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Midnight UTC on the day a timestamp falls in.
 *
 * Day counting has to be done on calendar days, not on elapsed hours: a trip
 * from Monday 09:00 to Tuesday 08:00 is 23 hours and two travel days.
 *
 * @param {Date|string} date
 * @returns {number} epoch milliseconds
 */
function startOfDay(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return NaN;
  return Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
}

/**
 * Resolve a destination to a city class.
 *
 * Falls back to the policy's `defaultCityClass`, and to `C` if the policy does
 * not state one — the cheapest domestic band, so an unrecognised city cannot
 * quietly pay a metro rate. Matching is trimmed and case-insensitive, because
 * these are typed by hand.
 *
 * @param {object} leg
 * @param {object} policy
 * @returns {{cityClass: string, matched: boolean, reason: string}}
 */
function classifyCity(leg, policy) {
  if (leg?.isInternational) {
    return {
      cityClass: CITY_CLASS.INTERNATIONAL,
      matched: true,
      reason: 'Leg is marked international',
    };
  }

  const city = String(leg?.toCity || '')
    .trim()
    .toLowerCase();
  const classes = policy?.cityClasses || {};

  for (const key of [CITY_CLASS.A, CITY_CLASS.B, CITY_CLASS.C]) {
    const cities = (classes[key] || []).map((name) =>
      String(name).trim().toLowerCase(),
    );
    if (city && cities.includes(city)) {
      return {
        cityClass: key,
        matched: true,
        reason: `${leg.toCity} is a class ${key} city`,
      };
    }
  }

  const fallback = policy?.defaultCityClass || CITY_CLASS.C;

  return {
    cityClass: fallback,
    matched: false,
    // Reported rather than silent: an unclassified city is usually a spelling
    // that does not match the policy list, and paying it the default rate
    // without saying so is how a metro gets paid at a tier-3 rate for a year.
    reason: `${leg?.toCity || 'Destination'} is not in the policy city list; defaulted to class ${fallback}`,
  };
}

/**
 * Eligible per-diem days for one leg.
 *
 * Calendar days, inclusive of both ends, adjusted by the part-day rule:
 *
 *   - `half`: a departure at or after noon and a return before noon each count
 *     as half a day.
 *   - `full`: both ends count as whole days.
 *
 * Floored at 0.5 rather than 0. Someone who flies out at 2pm and back at 9pm the
 * same day has travelled, eaten and spent; zero is the one answer that is
 * definitely wrong.
 *
 * @param {object} leg
 * @param {string} partDayRule
 * @returns {{valid: boolean, reason?: string, days?: number, calendarDays?: number, deductions?: string[]}}
 */
function countEligibleDays(leg, partDayRule = PART_DAY_RULE.HALF) {
  const from = new Date(leg?.departureAt);
  const to = new Date(leg?.returnAt);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return {
      valid: false,
      reason: 'Leg needs a valid departureAt and returnAt',
    };
  }
  if (to.getTime() < from.getTime()) {
    return { valid: false, reason: 'returnAt is before departureAt' };
  }

  const calendarDays =
    Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY) + 1;

  if (partDayRule !== PART_DAY_RULE.HALF) {
    return { valid: true, days: calendarDays, calendarDays, deductions: [] };
  }

  const deductions = [];
  let days = calendarDays;

  if (from.getUTCHours() >= 12) {
    days -= 0.5;
    deductions.push('Departed at or after noon — half day');
  }
  if (to.getUTCHours() < 12) {
    days -= 0.5;
    deductions.push('Returned before noon — half day');
  }

  return {
    valid: true,
    days: Math.max(0.5, days),
    calendarDays,
    deductions,
  };
}

/**
 * Per-diem for one leg.
 *
 * @param {object} leg
 * @param {object} policy
 * @returns {object}
 */
function computeLegPerDiem(leg, policy) {
  const classification = classifyCity(leg, policy);
  const dayCount = countEligibleDays(leg, policy?.partDayRule);

  if (!dayCount.valid) {
    return { valid: false, reason: dayCount.reason, amount: 0 };
  }

  const rates = policy?.perDiemRates || {};
  const dailyRate = Number(rates[classification.cityClass]);

  if (!Number.isFinite(dailyRate) || dailyRate < 0) {
    return {
      valid: false,
      reason: `Policy has no per-diem rate for city class ${classification.cityClass}`,
      amount: 0,
    };
  }

  return {
    valid: true,
    toCity: leg?.toCity,
    cityClass: classification.cityClass,
    cityMatched: classification.matched,
    classificationReason: classification.reason,
    eligibleDays: dayCount.days,
    calendarDays: dayCount.calendarDays,
    partDayDeductions: dayCount.deductions,
    dailyRate: round2(dailyRate),
    amount: round2(dayCount.days * dailyRate),
  };
}

/**
 * Per-diem for a whole trip, with the per-leg breakdown.
 *
 * The breakdown is returned rather than just the total because an employee
 * disputing a per-diem is disputing one leg of it, and "₹14,500" is not
 * something anybody can check.
 *
 * @param {object} request
 * @param {object} policy
 * @returns {object}
 */
function computeTripPerDiem(request, policy) {
  const legs = Array.isArray(request?.legs) ? request.legs : [];

  if (legs.length === 0) {
    return { valid: false, reason: 'Trip has no legs', total: 0, legs: [] };
  }

  const computed = legs.map((leg) => computeLegPerDiem(leg, policy));
  const invalid = computed.filter((leg) => !leg.valid);

  if (invalid.length > 0) {
    return {
      valid: false,
      reason: invalid.map((leg) => leg.reason).join('; '),
      total: 0,
      legs: computed,
    };
  }

  return {
    valid: true,
    legs: computed,
    totalDays: computed.reduce((sum, leg) => sum + leg.eligibleDays, 0),
    total: round2(computed.reduce((sum, leg) => sum + leg.amount, 0)),
    // Surfaced at the trip level so an approver sees it without reading every
    // leg. An unclassified destination is the most common cause of a per-diem
    // that looks wrong to the traveller.
    unclassifiedCities: computed
      .filter((leg) => !leg.cityMatched)
      .map((leg) => leg.toCity),
  };
}

/**
 * The most that may be released as an advance against an estimate.
 *
 * @param {number} estimatedCost
 * @param {object} policy
 * @returns {{ceiling: number, percent: number}}
 */
function computeAdvanceCeiling(estimatedCost, policy) {
  const estimate = Math.max(0, Number(estimatedCost) || 0);
  const percent = Math.min(
    100,
    Math.max(0, Number(policy?.advanceCeilingPercent ?? 80)),
  );

  return { ceiling: round2(estimate * (percent / 100)), percent };
}

/**
 * Do two legs overlap in time?
 *
 * Touching at a boundary is not an overlap: a leg returning at 18:00 and the
 * next departing at 18:00 is a connection, not a person in two cities at once.
 *
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function legsOverlap(a, b) {
  const aStart = new Date(a?.departureAt).getTime();
  const aEnd = new Date(a?.returnAt).getTime();
  const bStart = new Date(b?.departureAt).getTime();
  const bEnd = new Date(b?.returnAt).getTime();

  if ([aStart, aEnd, bStart, bEnd].some((value) => Number.isNaN(value)))
    return false;

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Everything about a request that breaches policy.
 *
 * Returned as a list rather than thrown, and reported at approval time rather
 * than discovered in a month-end variance report. Each entry carries the
 * overage, because "over the cap" without a number is not something an approver
 * can weigh.
 *
 * @param {object} request
 * @param {object} policy
 * @returns {Array<object>}
 */
function detectPolicyViolations(request, policy) {
  const violations = [];
  const legs = Array.isArray(request?.legs) ? request.legs : [];

  legs.forEach((leg, index) => {
    // --- Travel class above entitlement --------------------------------
    const order = TRAVEL_CLASS_ORDER[leg?.mode];
    const permitted = policy?.permittedClasses?.[leg?.mode];

    if (order && permitted) {
      const bookedRank = order.indexOf(leg?.travelClass);
      const permittedRank = order.indexOf(permitted);

      if (bookedRank === -1) {
        violations.push({
          type: 'unknown-travel-class',
          legIndex: index,
          message: `'${leg?.travelClass}' is not a recognised ${leg.mode} class`,
        });
      } else if (permittedRank !== -1 && bookedRank > permittedRank) {
        violations.push({
          type: 'travel-class-above-entitlement',
          legIndex: index,
          message: `${leg.mode} booked in ${leg.travelClass}; grade permits ${permitted}`,
          booked: leg.travelClass,
          permitted,
        });
      }
    }

    // --- Lodging over the city cap --------------------------------------
    const { cityClass } = classifyCity(leg, policy);
    const cap = Number(policy?.lodgingCaps?.[cityClass]);
    const nightly = Number(leg?.lodgingPerNight);

    if (Number.isFinite(cap) && Number.isFinite(nightly) && nightly > cap) {
      violations.push({
        type: 'lodging-over-cap',
        legIndex: index,
        message: `Lodging ${round2(nightly)} per night exceeds the class ${cityClass} cap of ${round2(cap)}`,
        overage: round2(nightly - cap),
        cap: round2(cap),
      });
    }
  });

  // --- Overlapping legs -------------------------------------------------
  //
  // A person cannot be in two cities at once, and overlapping legs double-count
  // the per-diem for the overlap.
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      if (legsOverlap(legs[i], legs[j])) {
        violations.push({
          type: 'overlapping-legs',
          legIndex: j,
          message: `Leg ${j + 1} overlaps leg ${i + 1} in time`,
        });
      }
    }
  }

  // --- Advance over the ceiling ----------------------------------------
  const requested = Number(request?.advanceRequested) || 0;
  if (requested > 0) {
    const { ceiling, percent } = computeAdvanceCeiling(
      request?.estimatedCost,
      policy,
    );
    if (requested > ceiling) {
      violations.push({
        type: 'advance-over-ceiling',
        message: `Advance ${round2(requested)} exceeds ${percent}% of the estimate (${ceiling})`,
        overage: round2(requested - ceiling),
        ceiling,
      });
    }
  }

  return violations;
}

/**
 * Settle a trip: what the company owes, or what it needs back.
 *
 * The payable side is receipted actuals *plus* the per-diem entitlement, because
 * per-diem is owed whether or not anything was spent — that is what makes it a
 * per-diem rather than a reimbursement. The advance is netted off, and whichever
 * side is left over decides the direction.
 *
 * @param {object} input
 * @param {number} input.advanceReleased
 * @param {object} input.actuals expense heads → amount
 * @param {number} input.perDiemEntitlement
 * @param {object} [input.policy]
 * @returns {object}
 */
function settleTrip({
  advanceReleased = 0,
  actuals = {},
  perDiemEntitlement = 0,
  policy,
}) {
  const advance = Math.max(0, Number(advanceReleased) || 0);
  const perDiem = Math.max(0, Number(perDiemEntitlement) || 0);

  const heads = Object.entries(actuals || {})
    .map(([head, amount]) => ({ head, amount: round2(Number(amount) || 0) }))
    .filter((entry) => entry.amount > 0);

  const actualsTotal = round2(
    heads.reduce((sum, entry) => sum + entry.amount, 0),
  );
  const payable = round2(actualsTotal + perDiem);
  const net = round2(payable - advance);

  // Three-way rather than a signed number, because the two directions post to
  // different places: a reimbursement is an earnings line in the next payroll
  // run and a recovery is a deduction, and a caller reading a sign is a caller
  // who eventually gets the sign backwards.
  let type = SETTLEMENT_TYPE.SETTLED;
  if (net > 0) type = SETTLEMENT_TYPE.REIMBURSEMENT;
  if (net < 0) type = SETTLEMENT_TYPE.RECOVERY;

  return {
    advanceReleased: round2(advance),
    perDiemEntitlement: round2(perDiem),
    actualsTotal,
    actualsByHead: heads,
    payable,
    net,
    type,
    // Both are non-negative by construction: a caller adding
    // `recoveryAmount` to a payroll deduction must never be handed a negative.
    reimbursementAmount: net > 0 ? net : 0,
    recoveryAmount: net < 0 ? round2(Math.abs(net)) : 0,
    payrollComponent: PAYROLL_COMPONENT[type] ?? null,
    currency: policy?.currency || 'INR',
  };
}

/**
 * The outstanding travel-advance ledger, with ageing.
 *
 * An advance is a company receivable until the trip is settled. `loan.model.js`
 * tracks money lent to an employee; this is the same class of asset and was
 * tracked nowhere.
 *
 * @param {Array<object>} requests
 * @param {Array<object>} settlements
 * @param {Date|string} asOf
 * @returns {object}
 */
function outstandingAdvances(
  requests = [],
  settlements = [],
  asOf = new Date(),
) {
  const settledRequestIds = new Set(
    settlements.map((settlement) => String(settlement?.requestId)),
  );
  const when = new Date(asOf);

  const open = [];
  let total = 0;

  for (const request of requests) {
    const released = Number(request?.advanceReleased) || 0;
    if (released <= 0) continue;
    if (settledRequestIds.has(String(request?._id))) continue;

    const releasedOn = new Date(
      request?.advanceReleasedAt || request?.createdAt,
    );
    const ageDays = Number.isNaN(releasedOn.getTime())
      ? null
      : Math.max(
          0,
          Math.floor((when.getTime() - releasedOn.getTime()) / MS_PER_DAY),
        );

    total += released;
    open.push({
      requestId: request._id,
      employeeId: request.employeeId,
      purpose: request.purpose,
      advanceReleased: round2(released),
      advanceReleasedAt: request.advanceReleasedAt || null,
      ageDays,
      // Buckets rather than a raw age, because that is how a receivables ageing
      // report is read and how a follow-up is prioritised.
      bucket:
        ageDays === null
          ? 'unknown'
          : ageDays <= 30
            ? '0-30'
            : ageDays <= 60
              ? '31-60'
              : ageDays <= 90
                ? '61-90'
                : '90+',
    });
  }

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, unknown: 0 };
  for (const entry of open) buckets[entry.bucket] += entry.advanceReleased;

  return {
    asOf: when,
    count: open.length,
    totalOutstanding: round2(total),
    byBucket: Object.fromEntries(
      Object.entries(buckets).map(([key, value]) => [key, round2(value)]),
    ),
    advances: open.sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0)),
  };
}

/**
 * Rebalances a multi-currency travel settlement against advance and actual receipts.
 *
 * @param {object} travelRequest - { advanceReleased, advanceCurrency, perDiemEntitlement }
 * @param {Array<object>} expenses - Array of { currency, amount, category, exchangeRate }
 * @param {object} forexRates - Map of currency codes to base currency (e.g. { USD: 83.5, EUR: 90.2, GBP: 105.0 })
 * @param {string} [baseCurrency='INR']
 * @returns {object}
 */
function rebalanceMultiCurrencyTravelSettlement(
  travelRequest,
  expenses = [],
  forexRates = {},
  baseCurrency = 'INR',
) {
  const advanceReleased = Number(travelRequest.advanceReleased || 0);
  const advanceCurrency = travelRequest.advanceCurrency || baseCurrency;
  const advanceRate = advanceCurrency === baseCurrency ? 1.0 : Number(forexRates[advanceCurrency] || 1.0);
  const advanceReleasedBase = round2(advanceReleased * advanceRate);

  const perDiemBase = Number(travelRequest.perDiemEntitlement || 0);

  let totalExpensesBase = 0;
  const convertedExpenses = expenses.map((exp) => {
    const amount = Number(exp.amount || 0);
    const curr = exp.currency || baseCurrency;
    const rate = curr === baseCurrency ? 1.0 : Number(exp.exchangeRate || forexRates[curr] || 1.0);
    const convertedAmount = round2(amount * rate);

    totalExpensesBase += convertedAmount;

    return {
      category: exp.category || 'Miscellaneous',
      originalAmount: amount,
      originalCurrency: curr,
      exchangeRateUsed: rate,
      baseAmount: convertedAmount,
      baseCurrency,
    };
  });

  const totalActualSpend = round2(totalExpensesBase + perDiemBase);
  const netVariance = round2(totalActualSpend - advanceReleasedBase);

  let settlementAction = 'NIL_BALANCE';
  if (netVariance > 0) {
    settlementAction = 'REIMBURSEMENT_DUE';
  } else if (netVariance < 0) {
    settlementAction = 'SURPLUS_RECOVERY_DUE';
  }

  return {
    advanceReleased,
    advanceCurrency,
    advanceReleasedBase,
    perDiemBase,
    totalExpensesBase: round2(totalExpensesBase),
    totalActualSpend,
    netVariance,
    settlementAction,
    reimbursementPayable: netVariance > 0 ? netVariance : 0,
    surplusToRecover: netVariance < 0 ? Math.abs(netVariance) : 0,
    convertedExpenses,
  };
}

module.exports = {
  CITY_CLASS,
  PART_DAY_RULE,
  TRAVEL_MODE,
  TRAVEL_CLASS_ORDER,
  REQUEST_STATUS,
  SETTLEMENT_TYPE,
  PAYROLL_COMPONENT,
  round2,
  startOfDay,
  classifyCity,
  countEligibleDays,
  computeLegPerDiem,
  computeTripPerDiem,
  computeAdvanceCeiling,
  legsOverlap,
  detectPolicyViolations,
  settleTrip,
  outstandingAdvances,
  rebalanceMultiCurrencyTravelSettlement,
};

