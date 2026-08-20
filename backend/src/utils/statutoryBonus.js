/**
 * Statutory bonus under the Payment of Bonus Act, 1965 (#1346).
 *
 * PaySphere already pays bonuses — `payroll.model.js` carries a field and the
 * wizard writes to it. That is a *discretionary* bonus: management decides
 * whether to pay it and how much. This module is the other kind, and mixing the
 * two would be a misstatement rather than an inconvenience:
 *
 *   - the discretionary bonus is computed on the wage that is paid;
 *   - the statutory bonus is computed on a wage capped by section 12, which for
 *     most eligible employees is a different and much smaller number;
 *   - the discretionary bonus is management's call, the statutory one is not;
 *   - Form C is a register of statutory bonus, and an ex-gratia payment
 *     appearing in it is a false return.
 *
 * Pure functions, no database access, like `settlement.js` and
 * `gratuityValuation.js` — the set-on/set-off ledger in particular is a
 * four-year running balance with a statutory expiry, and every transition in it
 * should be reachable from a test.
 */

/** Section 2(13): the monthly wage above which an employee is not eligible. */
const ELIGIBILITY_WAGE_CEILING = 21000;

/**
 * Section 12: the wage the bonus is *computed* on, when the employee earns more
 * than this. The floor is the higher of ₹7,000 and the minimum wage for the
 * scheduled employment — the `max` inside the `min` is the part that is most
 * often dropped, and dropping it understates the bonus everywhere the scheduled
 * minimum wage exceeds ₹7,000, which is most states for skilled categories.
 */
const CALCULATION_WAGE_FLOOR = 7000;

/** Section 8: minimum working days in the accounting year to be eligible. */
const MIN_WORKING_DAYS = 30;

/** Section 10: the minimum bonus, payable whether or not there is a surplus. */
const MIN_BONUS_RATE = 0.0833;

/** Section 11: the maximum, above which the excess is set on. */
const MAX_BONUS_RATE = 0.2;

/**
 * Section 2(4): the share of available surplus that is allocable.
 *
 * 67% for a company that has not made the prescribed arrangements for declaring
 * dividends within India, 60% in any other case — which is where a banking
 * company lands.
 */
const ALLOCABLE_SURPLUS_SHARE = {
  COMPANY: 0.67,
  OTHER: 0.6,
};

/** Section 15: set on and set off are carried for four accounting years. */
const SET_ON_SET_OFF_YEARS = 4;

/** Section 1(3)(b): the headcount at which the Act starts applying. */
const APPLICABILITY_HEADCOUNT = 20;

/** Section 19: payment is due within eight months of the close of the year. */
const PAYMENT_WINDOW_MONTHS = 8;

/** Section 9: the acts that forfeit a bonus outright. */
const DISQUALIFICATION = {
  FRAUD: 'fraud',
  RIOTOUS_BEHAVIOUR: 'riotous_or_violent_behaviour',
  THEFT: 'theft_misappropriation_or_sabotage',
};

const DISQUALIFICATION_LABEL = {
  [DISQUALIFICATION.FRAUD]: 'dismissed for fraud',
  [DISQUALIFICATION.RIOTOUS_BEHAVIOUR]:
    'dismissed for riotous or violent behaviour on the premises',
  [DISQUALIFICATION.THEFT]:
    'dismissed for theft, misappropriation or sabotage of company property',
};

/** Why an employee is not in the register. */
const EXCLUSION = {
  WAGE_CEILING: 'WAGE_CEILING',
  INSUFFICIENT_DAYS: 'INSUFFICIENT_DAYS',
  DISQUALIFIED: 'DISQUALIFIED',
  NO_WAGE_DATA: 'NO_WAGE_DATA',
};

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/**
 * Whether the Act applies to an establishment.
 *
 * Section 1(3)(b) brings in every establishment employing twenty or more
 * persons. Section 1(5) is the part a naive `headcount >= 20` check gets wrong:
 * once the Act has applied, it continues to apply even if the headcount later
 * falls below twenty. A company that grows past twenty and shrinks back does
 * not stop owing statutory bonus, and telling them they do is the kind of
 * answer that ends in a prosecution.
 *
 * @param {object} params
 * @param {number} params.headcount employees in the accounting year
 * @param {boolean} [params.previouslyCovered] has the Act applied in any earlier year
 * @returns {{covered: boolean, reason: string}}
 */
function isEstablishmentCovered({ headcount, previouslyCovered = false }) {
  const count = Number(headcount);

  if (previouslyCovered) {
    return {
      covered: true,
      reason:
        'The Act has applied to this establishment before, and section 1(5) keeps it applicable regardless of a later fall in headcount',
    };
  }

  if (Number.isFinite(count) && count >= APPLICABILITY_HEADCOUNT) {
    return {
      covered: true,
      reason: `${count} employees in the accounting year, at or above the section 1(3)(b) threshold of ${APPLICABILITY_HEADCOUNT}`,
    };
  }

  return {
    covered: false,
    reason: `${count || 0} employees, below the section 1(3)(b) threshold of ${APPLICABILITY_HEADCOUNT}`,
  };
}

/**
 * The wage a month's bonus is computed on.
 *
 * `min(what they actually earn, max(₹7,000, the scheduled minimum wage))`.
 *
 * Two things fall out of that shape and both are worth stating, because both
 * are routinely implemented as something simpler:
 *
 *   - an employee earning ₹18,000 is eligible and their bonus is computed on
 *     ₹7,000, not on ₹18,000;
 *   - an employee earning ₹5,000 is computed on ₹5,000, not raised to ₹7,000.
 *     The ceiling is a ceiling and not a floor for the low-paid.
 *
 * @param {number} monthlyWage
 * @param {number} [minimumWage] scheduled minimum wage for the employment
 * @returns {number}
 */
function qualifyingWage(monthlyWage, minimumWage = 0) {
  const actual = Number(monthlyWage);
  if (!Number.isFinite(actual) || actual <= 0) return 0;

  const statutory = Number(minimumWage);
  const ceiling = Math.max(
    CALCULATION_WAGE_FLOOR,
    Number.isFinite(statutory) && statutory > 0 ? statutory : 0,
  );

  return round2(Math.min(actual, ceiling));
}

/**
 * Whether an employee is in the register, and why not if they are not.
 *
 * The exclusions are returned with a reason rather than filtered away silently.
 * "Why did this person not get a bonus" is an inspection question under Rule 5
 * and the register has to be able to answer it.
 *
 * @param {object} employee
 * @param {object} [options]
 * @returns {{eligible: boolean, exclusion: object|null, daysWorked: number}}
 */
function assessEligibility(employee, options = {}) {
  const months = Array.isArray(employee.months) ? employee.months : [];

  const daysWorked = months.reduce(
    (sum, month) => sum + (Number(month.daysWorked) || 0),
    0,
  );

  if (employee.disqualification) {
    return {
      eligible: false,
      daysWorked,
      exclusion: {
        code: EXCLUSION.DISQUALIFIED,
        message: `Section 9 — ${
          DISQUALIFICATION_LABEL[employee.disqualification] ||
          employee.disqualification
        }`,
      },
    };
  }

  // The wage ceiling is tested on what the employee actually earns, which is a
  // different number from the wage the bonus is computed on. Testing the
  // capped wage would make everybody eligible, since the cap is well below the
  // ceiling.
  const wage = Number(employee.monthlyWage);

  if (!Number.isFinite(wage) || wage <= 0) {
    return {
      eligible: false,
      daysWorked,
      exclusion: {
        code: EXCLUSION.NO_WAGE_DATA,
        message: 'No usable monthly wage on record',
      },
    };
  }

  const ceiling =
    Number(options.eligibilityCeiling) || ELIGIBILITY_WAGE_CEILING;

  if (wage > ceiling) {
    return {
      eligible: false,
      daysWorked,
      exclusion: {
        code: EXCLUSION.WAGE_CEILING,
        message: `Section 2(13) — monthly wage of ${round2(wage)} exceeds the ${ceiling} ceiling`,
      },
    };
  }

  if (daysWorked < MIN_WORKING_DAYS) {
    return {
      eligible: false,
      daysWorked,
      exclusion: {
        code: EXCLUSION.INSUFFICIENT_DAYS,
        message: `Section 8 — ${daysWorked} working days in the accounting year, fewer than the ${MIN_WORKING_DAYS} required`,
      },
    };
  }

  return { eligible: true, daysWorked, exclusion: null };
}

/**
 * An employee's qualifying wages for the accounting year.
 *
 * Summed month by month rather than annualised from the current wage, which is
 * what makes joiners, leavers and mid-year revisions come out right without a
 * separate pro-rating rule: an employee who worked five months contributes five
 * months of capped wage, and one whose pay rose in October is capped separately
 * either side of it.
 *
 * @param {object} employee
 * @param {object} [options]
 * @returns {{total: number, months: Array<object>}}
 */
function computeQualifyingWages(employee, options = {}) {
  const months = Array.isArray(employee.months) ? employee.months : [];
  const minimumWage = options.minimumWage ?? employee.minimumWage ?? 0;

  const detail = months.map((month) => {
    const wage = Number(month.wage);
    const paidWage =
      Number.isFinite(wage) && wage > 0
        ? wage
        : Number(employee.monthlyWage) || 0;
    const qualifying = qualifyingWage(paidWage, minimumWage);

    return {
      month: month.month,
      daysWorked: Number(month.daysWorked) || 0,
      paidWage: round2(paidWage),
      qualifyingWage: qualifying,
      capped: qualifying < paidWage,
    };
  });

  const total = detail.reduce((sum, month) => sum + month.qualifyingWage, 0);

  return { total: round2(total), months: detail };
}

/**
 * Available surplus under section 5, from gross profit and the section 6
 * prior charges.
 *
 * The arithmetic is trivial and the inputs are not — they come out of the
 * audited accounts, which is why they are parameters rather than something this
 * module tries to derive.
 *
 * @param {object} params
 * @returns {object}
 */
function computeAvailableSurplus({
  grossProfit,
  depreciation = 0,
  developmentRebate = 0,
  directTax = 0,
  otherPriorCharges = 0,
}) {
  const profit = Number(grossProfit) || 0;

  const priorCharges =
    (Number(depreciation) || 0) +
    (Number(developmentRebate) || 0) +
    (Number(directTax) || 0) +
    (Number(otherPriorCharges) || 0);

  // Section 5 does not contemplate a negative available surplus; a loss year
  // produces nil available surplus and the minimum bonus is still payable out
  // of it, which is the whole point of section 10.
  const available = Math.max(0, profit - priorCharges);

  return {
    grossProfit: round2(profit),
    priorCharges: round2(priorCharges),
    availableSurplus: round2(available),
  };
}

/**
 * Allocable surplus under section 2(4).
 *
 * @param {number} availableSurplus
 * @param {string} [employerType] 'COMPANY' or 'OTHER'
 * @returns {object}
 */
function computeAllocableSurplus(availableSurplus, employerType = 'COMPANY') {
  const share =
    ALLOCABLE_SURPLUS_SHARE[employerType] ?? ALLOCABLE_SURPLUS_SHARE.COMPANY;

  return {
    availableSurplus: round2(Number(availableSurplus) || 0),
    share,
    allocableSurplus: round2((Number(availableSurplus) || 0) * share),
  };
}

/**
 * Drop set-on and set-off entries that have aged out.
 *
 * Section 15 carries a balance into the four *succeeding* accounting years, so
 * an amount set on in 2022 is available in 2023, 2024, 2025 and 2026, and is
 * spent — used or not — when 2027 is computed.
 *
 * The off-by-one is worth being explicit about because both readings are
 * plausible and the wrong one silently discards a live balance a year early,
 * which turns a set-off into a set-on that never existed.
 *
 * @param {Array<object>} ledger
 * @param {number} accountingYear the year being computed
 * @returns {{live: Array<object>, expired: Array<object>}}
 */
function expireLedger(ledger, accountingYear) {
  const entries = Array.isArray(ledger) ? ledger : [];
  const oldestLiveYear = Number(accountingYear) - SET_ON_SET_OFF_YEARS;

  const live = [];
  const expired = [];

  for (const entry of entries) {
    if (Number(entry.accountingYear) < oldestLiveYear) expired.push(entry);
    else live.push(entry);
  }

  return { live, expired };
}

/**
 * Allocate a year's allocable surplus into bonus, set on and set off.
 *
 * The ladder is fixed by sections 10, 11 and 15, and the order matters:
 *
 *   1. The minimum bonus of 8.33% is payable whether or not there is any
 *      surplus at all — a loss-making year still owes it.
 *   2. Anything above the minimum is paid, up to 20% of qualifying wages.
 *   3. Surplus beyond 20% is *set on*, carried for four years.
 *   4. A shortfall below the minimum is met from set-on carried in, and only
 *      what cannot be met that way is *set off*.
 *
 * Step 4 is the one that is usually missing, because it needs a memory. A
 * yearly script has none, which is why the set-on/set-off register is so rarely
 * maintained correctly in practice.
 *
 * @param {object} params
 * @returns {object}
 */
function allocate({
  allocableSurplus,
  totalQualifyingWages,
  accountingYear,
  ledger = [],
}) {
  const surplus = Math.max(0, Number(allocableSurplus) || 0);
  const wages = Math.max(0, Number(totalQualifyingWages) || 0);

  const minimumBonus = round2(wages * MIN_BONUS_RATE);
  const maximumBonus = round2(wages * MAX_BONUS_RATE);

  const { live, expired } = expireLedger(ledger, accountingYear);

  const setOnAvailable = live
    .filter((entry) => entry.type === 'set_on')
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  let payable;
  let drawnFromSetOn = 0;
  let setOn = 0;
  let setOff = 0;
  let basis;

  if (surplus >= maximumBonus) {
    payable = maximumBonus;
    setOn = round2(surplus - maximumBonus);
    basis = `Allocable surplus exceeds the section 11 maximum of 20%; the excess of ${setOn} is set on for ${SET_ON_SET_OFF_YEARS} accounting years`;
  } else if (surplus >= minimumBonus) {
    payable = round2(surplus);
    basis =
      'Allocable surplus falls between the section 10 minimum and the section 11 maximum, and is paid in full';
  } else {
    // The shortfall is met from set-on carried in before anything is set off.
    const shortfall = round2(minimumBonus - surplus);
    drawnFromSetOn = round2(Math.min(setOnAvailable, shortfall));
    payable = minimumBonus;
    setOff = round2(shortfall - drawnFromSetOn);

    basis =
      drawnFromSetOn > 0
        ? `Allocable surplus is below the section 10 minimum; ${drawnFromSetOn} is drawn from set on carried forward and ${setOff} is set off`
        : `Allocable surplus is below the section 10 minimum, which is payable regardless; the shortfall of ${setOff} is set off`;
  }

  const rate = wages === 0 ? 0 : payable / wages;

  return {
    accountingYear,
    totalQualifyingWages: round2(wages),
    allocableSurplus: round2(surplus),
    minimumBonus,
    maximumBonus,
    payableBonus: round2(payable),
    /** The percentage of qualifying wages actually paid, between 8.33 and 20. */
    bonusRate: Math.round(rate * 1000000) / 1000000,
    bonusPercent: round2(rate * 100),
    setOn,
    setOff,
    drawnFromSetOn,
    setOnAvailable: round2(setOnAvailable),
    expiredEntries: expired,
    basis,
  };
}

/**
 * The ledger after a year has been allocated.
 *
 * Returned rather than mutated: the caller decides whether a computation is a
 * preview or a commitment, and a preview that quietly consumed set-on would
 * make the second preview of the same year disagree with the first.
 *
 * @param {Array<object>} ledger
 * @param {object} allocation from `allocate`
 * @returns {Array<object>}
 */
function applyToLedger(ledger, allocation) {
  const { live } = expireLedger(ledger, allocation.accountingYear);

  // Set-on is consumed oldest first, so the entries closest to expiring are
  // spent before they lapse. Spending the newest first would let a live balance
  // age out while an older one sat unused.
  const ordered = [...live].sort(
    (a, b) => Number(a.accountingYear) - Number(b.accountingYear),
  );

  let toDraw = Number(allocation.drawnFromSetOn) || 0;
  const next = [];

  for (const entry of ordered) {
    if (entry.type !== 'set_on' || toDraw <= 0) {
      next.push(entry);
      continue;
    }

    const amount = Number(entry.amount) || 0;
    const drawn = Math.min(amount, toDraw);
    toDraw = round2(toDraw - drawn);

    const remaining = round2(amount - drawn);
    if (remaining > 0) next.push({ ...entry, amount: remaining });
  }

  if (allocation.setOn > 0) {
    next.push({
      accountingYear: allocation.accountingYear,
      type: 'set_on',
      amount: allocation.setOn,
    });
  }

  if (allocation.setOff > 0) {
    next.push({
      accountingYear: allocation.accountingYear,
      type: 'set_off',
      amount: allocation.setOff,
    });
  }

  return next;
}

/**
 * Section 19: the last date the bonus may be paid.
 *
 * Computed in UTC and with the day clamped to the end of the target month.
 *
 * Both of those are guarding against the same class of quiet wrongness.
 * `setMonth(month + 8)` on 31 March produces "31 November", which JavaScript
 * rolls forward to 1 December — a deadline a day later than the statute allows,
 * for exactly the 31 March year-end that most Indian establishments use. And
 * working in local time makes the answer depend on the server's timezone, which
 * is not a property a statutory deadline should have.
 *
 * @param {Date|string} accountingYearEnd
 * @returns {Date|null}
 */
function paymentDueDate(accountingYearEnd) {
  const end =
    accountingYearEnd instanceof Date
      ? new Date(accountingYearEnd.getTime())
      : new Date(accountingYearEnd);

  if (Number.isNaN(end.getTime())) return null;

  const year = end.getUTCFullYear();
  const month = end.getUTCMonth() + PAYMENT_WINDOW_MONTHS;
  const day = end.getUTCDate();

  // Day 0 of the following month is the last day of this one.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}

/**
 * The whole computation for an accounting year, and the Form C register.
 *
 * @param {object} params
 * @returns {object}
 */
function computeBonusRegister({
  employees,
  accountingYear,
  accountingYearEnd,
  grossProfit,
  depreciation,
  developmentRebate,
  directTax,
  otherPriorCharges,
  employerType,
  minimumWage,
  ledger = [],
  previouslyCovered = false,
}) {
  const roster = Array.isArray(employees) ? employees : [];

  const coverage = isEstablishmentCovered({
    headcount: roster.length,
    previouslyCovered,
  });

  const included = [];
  const excluded = [];

  for (const employee of roster) {
    const eligibility = assessEligibility(employee);

    if (!eligibility.eligible) {
      excluded.push({
        employeeId: employee.employeeId || employee._id || null,
        name: employee.name || '',
        designation: employee.designation || '',
        monthlyWage: round2(employee.monthlyWage),
        daysWorked: eligibility.daysWorked,
        code: eligibility.exclusion.code,
        reason: eligibility.exclusion.message,
      });
      continue;
    }

    const wages = computeQualifyingWages(employee, { minimumWage });

    included.push({
      employeeId: employee.employeeId || employee._id || null,
      name: employee.name || '',
      designation: employee.designation || '',
      monthlyWage: round2(employee.monthlyWage),
      daysWorked: eligibility.daysWorked,
      monthsWorked: wages.months.length,
      qualifyingWages: wages.total,
      monthDetail: wages.months,
    });
  }

  const totalQualifyingWages = round2(
    included.reduce((sum, row) => sum + row.qualifyingWages, 0),
  );

  const surplus = computeAvailableSurplus({
    grossProfit,
    depreciation,
    developmentRebate,
    directTax,
    otherPriorCharges,
  });

  const allocable = computeAllocableSurplus(
    surplus.availableSurplus,
    employerType,
  );

  const allocation = allocate({
    allocableSurplus: allocable.allocableSurplus,
    totalQualifyingWages,
    accountingYear,
    ledger,
  });

  // Each employee's share is their qualifying wages at the year's rate. Not an
  // equal split and not their own 8.33% — the rate is an establishment-level
  // figure and every eligible employee is paid at it.
  const register = included.map((row) => ({
    ...row,
    bonusPayable: round2(row.qualifyingWages * allocation.bonusRate),
  }));

  // Distribute the rounding remainder rather than letting the register
  // disagree with the total it is supposed to add up to. An inspector reading
  // Form C adds the column; it has to match.
  const registerTotal = round2(
    register.reduce((sum, row) => sum + row.bonusPayable, 0),
  );
  const remainder = round2(allocation.payableBonus - registerTotal);

  if (register.length > 0 && Math.abs(remainder) >= 0.01) {
    register[0].bonusPayable = round2(register[0].bonusPayable + remainder);
    register[0].roundingAdjustment = remainder;
  }

  return {
    accountingYear,
    coverage,
    applicable: coverage.covered,
    surplus,
    allocable,
    allocation,
    totalQualifyingWages,
    eligibleCount: included.length,
    excludedCount: excluded.length,
    register,
    excluded,
    ledgerAfter: applyToLedger(ledger, allocation),
    paymentDueBy: paymentDueDate(accountingYearEnd),
  };
}

module.exports = {
  ELIGIBILITY_WAGE_CEILING,
  CALCULATION_WAGE_FLOOR,
  MIN_WORKING_DAYS,
  MIN_BONUS_RATE,
  MAX_BONUS_RATE,
  ALLOCABLE_SURPLUS_SHARE,
  SET_ON_SET_OFF_YEARS,
  APPLICABILITY_HEADCOUNT,
  PAYMENT_WINDOW_MONTHS,
  DISQUALIFICATION,
  EXCLUSION,
  isEstablishmentCovered,
  qualifyingWage,
  assessEligibility,
  computeQualifyingWages,
  computeAvailableSurplus,
  computeAllocableSurplus,
  expireLedger,
  allocate,
  applyToLedger,
  paymentDueDate,
  computeBonusRegister,
};
