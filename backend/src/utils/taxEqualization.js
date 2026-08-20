/**
 * International assignments: tax equalization, gross-up and day counting (#1348).
 *
 * The gap this fills sits between three modules that already exist and do not
 * meet. `MultiJurisdictionTaxService` taxes people in different places,
 * `EnterpriseTravelService` handles trips, `forex.controller` handles currency
 * — and none of them models the thing an assignment actually is: an employee
 * sent from one country to another for a year or three, still on the home
 * payroll, taxed in the host country, costing two to three times their base
 * salary once the package is built.
 *
 * Two mechanics here cannot be approximated.
 *
 * **Hypothetical tax.** The promise on an equalized assignment is that the
 * employee ends up in the same net position they would have been in had they
 * never left. Delivering it means deducting the tax they *would* have paid at
 * home on their *stay-at-home* compensation, and having the employer pay the
 * real home and host taxes. Hypo tax is not a real tax: it is remitted to
 * nobody, and `taxEngine.utils.js` computes tax owed, which is by construction
 * the opposite thing.
 *
 * **Gross-up.** When the employer bears the tax on a benefit, the benefit
 * becomes taxable income, which increases the tax, which increases the
 * gross-up. It is circular, and with a progressive rate table it has no closed
 * form — so it is solved by iteration, with a cap, because a pathological table
 * must not spin.
 *
 * Pure functions, no database access, matching `settlement.js` and
 * `gratuityValuation.js`. Every one of these figures ends up in front of
 * somebody deciding whether to approve a move.
 */

/** The three ways an assignment's tax burden can be arranged. */
const TAX_APPROACH = {
  /**
   * The employee is held to their home tax position exactly. If host tax is
   * lower, the *employer* keeps the saving; if higher, the employer absorbs it.
   */
  EQUALIZATION: 'equalization',
  /**
   * The employee is held *no worse off* than at home, and keeps any windfall.
   * Not the same thing as equalization, and implementing one while labelling it
   * the other is a real financial difference in the employee's favour.
   */
  PROTECTION: 'protection',
  /** No arrangement. The employee carries their own actual tax, wherever it falls. */
  LAISSEZ_FAIRE: 'laissez_faire',
};

const ASSIGNMENT_TYPE = {
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term',
  COMMUTER: 'commuter',
  PERMANENT_TRANSFER: 'permanent_transfer',
};

/** The threshold in the dependent-services article of most treaties. */
const TREATY_DAY_THRESHOLD = 183;

/** How the treaty measures its period. Which one applies is treaty-specific. */
const MEASUREMENT_PERIOD = {
  CALENDAR_YEAR: 'calendar_year',
  TAX_YEAR: 'tax_year',
  ROLLING_12_MONTHS: 'rolling_12_months',
};

/** Warn at this fraction of the threshold rather than after it is crossed. */
const DAY_COUNT_WARNING_RATIO = 0.85;

const GROSS_UP_MAX_ITERATIONS = 60;
/** Converged to the rupee. */
const GROSS_UP_TOLERANCE = 0.01;

/** Allowances that exist only because of the assignment. */
const ASSIGNMENT_ALLOWANCES = [
  'costOfLiving',
  'housing',
  'hardship',
  'mobilityPremium',
  'educationAllowance',
  'homeLeave',
  'relocation',
];

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
 * @param {*} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Tax on an income under a slab table.
 *
 * The table is `[{ upTo, rate }, …]` with the last entry's `upTo` omitted or
 * Infinity. Income is *sliced* at each boundary and each slice taxed at its own
 * rate — deliberately not "find the bracket, apply the rate to everything",
 * which overtaxes every income above the first threshold. #616 fixed exactly
 * that bug in `taxEngine.utils.js`; reintroducing it here would be a poor way
 * to repay the favour.
 *
 * @param {number} income
 * @param {Array<{upTo?: number, rate: number}>} table
 * @returns {number}
 */
function taxOnIncome(income, table) {
  const amount = Number(income);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Array.isArray(table) || table.length === 0) return 0;

  let tax = 0;
  let floor = 0;

  for (const slab of table) {
    const ceiling = Number.isFinite(Number(slab.upTo))
      ? Number(slab.upTo)
      : Infinity;

    if (amount <= floor) break;

    const slice = Math.min(amount, ceiling) - floor;
    if (slice > 0) tax += slice * Number(slab.rate);

    floor = ceiling;
    if (!Number.isFinite(ceiling)) break;
  }

  return round2(tax);
}

/**
 * The marginal rate at an income — the rate the next rupee is taxed at.
 *
 * Used to seed the gross-up iteration. Seeding at the *average* rate instead
 * converges to the same answer and takes noticeably longer, because the average
 * rate understates what the added income will cost.
 *
 * @param {number} income
 * @param {Array<object>} table
 * @returns {number}
 */
function marginalRate(income, table) {
  if (!Array.isArray(table) || table.length === 0) return 0;

  const amount = Number(income) || 0;

  for (const slab of table) {
    const ceiling = Number.isFinite(Number(slab.upTo))
      ? Number(slab.upTo)
      : Infinity;

    if (amount < ceiling) return Number(slab.rate);
  }

  return Number(table[table.length - 1].rate);
}

/**
 * The compensation the employee would have had if they had never left.
 *
 * Base plus the bonus they would have received at home, and *nothing* that
 * exists because of the assignment. Including a housing allowance here would
 * raise the hypo tax and reduce the employee's net below where staying at home
 * would have left them — which breaks the one promise the arrangement makes.
 *
 * @param {object} assignment
 * @returns {object}
 */
function stayAtHomeCompensation(assignment) {
  const base = Number(assignment.homeBaseSalary) || 0;
  const bonus = Number(assignment.homeBonus) || 0;
  const other = Number(assignment.otherHomeCompensation) || 0;

  const excluded = ASSIGNMENT_ALLOWANCES.reduce((sum, key) => {
    const value = Number(
      assignment.allowances ? assignment.allowances[key] : 0,
    );
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return {
    baseSalary: round2(base),
    bonus: round2(bonus),
    otherCompensation: round2(other),
    total: round2(base + bonus + other),
    excludedFromHypo: round2(excluded),
  };
}

/**
 * Hypothetical tax — what the employee would have paid at home, on the
 * stay-at-home package.
 *
 * @param {object} assignment
 * @param {object} params
 * @returns {object}
 */
function computeHypotheticalTax(
  assignment,
  { homeTaxTable, hypoDeductions = 0 } = {},
) {
  const stayAtHome = stayAtHomeCompensation(assignment);

  const taxable = Math.max(0, stayAtHome.total - (Number(hypoDeductions) || 0));
  const hypoTax = taxOnIncome(taxable, homeTaxTable);

  return {
    stayAtHome,
    hypoDeductions: round2(hypoDeductions),
    hypoTaxableIncome: round2(taxable),
    hypotheticalTax: hypoTax,
    /** The net the arrangement is promising to reproduce. */
    stayAtHomeNet: round2(stayAtHome.total - hypoTax),
    effectiveRate:
      stayAtHome.total === 0 ? 0 : round2((hypoTax / stayAtHome.total) * 100),
  };
}

/**
 * Settle the year under the chosen approach.
 *
 * The three paths are genuinely different and are written as three paths on
 * purpose:
 *
 *   - **Equalization** — the employee bears exactly the hypo tax. The employer
 *     pays the real home and host tax and keeps the difference in either
 *     direction, including a saving when the host is a low-tax country.
 *
 *   - **Protection** — the employee bears the *lower* of the hypo tax and the
 *     actual tax, so a low-tax host is a windfall they keep. The employer only
 *     ever tops up.
 *
 *   - **Laissez-faire** — the employee bears the actual tax and there is no
 *     hypo deduction at all.
 *
 * @param {object} params
 * @returns {object}
 */
function settleTaxPosition({
  approach,
  hypotheticalTax,
  actualHomeTax = 0,
  actualHostTax = 0,
  hypoTaxWithheld = null,
}) {
  const hypo = Number(hypotheticalTax) || 0;
  const home = Number(actualHomeTax) || 0;
  const host = Number(actualHostTax) || 0;
  const actualTotal = round2(home + host);

  // What was actually deducted through the year, which is rarely exactly the
  // hypo figure — the year-end reconciliation exists because a mid-year salary
  // change moves the hypo and the deductions do not always follow.
  const withheld =
    hypoTaxWithheld === null || !Number.isFinite(Number(hypoTaxWithheld))
      ? hypo
      : Number(hypoTaxWithheld);

  let employeeBears;
  let note;

  if (approach === TAX_APPROACH.PROTECTION) {
    employeeBears = Math.min(hypo, actualTotal);
    note =
      actualTotal < hypo
        ? 'Tax protection: the host position is cheaper than home, and the saving stays with the employee'
        : 'Tax protection: the employer tops the employee up to their home tax position';
  } else if (approach === TAX_APPROACH.LAISSEZ_FAIRE) {
    employeeBears = actualTotal;
    note =
      'No arrangement: the employee carries the actual tax wherever it falls';
  } else {
    employeeBears = hypo;
    note =
      actualTotal < hypo
        ? 'Tax equalization: the host position is cheaper than home, and the saving accrues to the employer'
        : 'Tax equalization: the employer absorbs the excess over the home tax position';
  }

  const employerBears = round2(actualTotal - employeeBears);

  // Positive means the employee owes the company; negative means the company
  // owes the employee. Stated because the sign is the single most misread
  // figure on an equalization settlement.
  const settlement = round2(employeeBears - withheld);

  return {
    approach: approach || TAX_APPROACH.EQUALIZATION,
    hypotheticalTax: round2(hypo),
    hypoTaxWithheld: round2(withheld),
    actualHomeTax: round2(home),
    actualHostTax: round2(host),
    actualTotalTax: actualTotal,
    employeeBears: round2(employeeBears),
    employerBears,
    settlement,
    settlementDirection:
      settlement > 0
        ? 'employee_owes_company'
        : settlement < 0
          ? 'company_owes_employee'
          : 'settled',
    note,
  };
}

/**
 * Gross up an employer-borne benefit.
 *
 * The fixed point: `gross = net + tax(baseIncome + gross) - tax(baseIncome)`.
 *
 * Solved by iteration rather than by `net / (1 - rate)`, because the closed
 * form is only correct when the rate is flat. With a progressive table a
 * gross-up that crosses a slab boundary is understated by the closed form, and
 * the error grows with the size of the benefit — which is exactly the case that
 * matters, since the benefits being grossed up on an assignment are large.
 *
 * The iteration cap is not decoration. A table with a rate at or above 1
 * has no fixed point, and without the cap this spins.
 *
 * @param {number} netBenefit
 * @param {object} params
 * @returns {object}
 */
function grossUp(netBenefit, { taxTable, baseIncome = 0 } = {}) {
  const net = Number(netBenefit) || 0;

  if (net <= 0) {
    return {
      netBenefit: 0,
      grossedUp: 0,
      taxOnBenefit: 0,
      iterations: 0,
      converged: true,
    };
  }

  const base = Number(baseIncome) || 0;
  const baseTax = taxOnIncome(base, taxTable);

  // Seed from the marginal rate, which is the closed-form answer and is already
  // close unless the benefit crosses a boundary.
  const seedRate = marginalRate(base + net, taxTable);
  let gross = seedRate >= 1 ? net : net / (1 - seedRate);

  let iterations = 0;
  let converged = false;

  while (iterations < GROSS_UP_MAX_ITERATIONS) {
    iterations += 1;

    const taxOnBenefit = taxOnIncome(base + gross, taxTable) - baseTax;
    const next = net + taxOnBenefit;

    if (Math.abs(next - gross) < GROSS_UP_TOLERANCE) {
      gross = next;
      converged = true;
      break;
    }

    gross = next;
  }

  const taxOnBenefit = round2(taxOnIncome(base + gross, taxTable) - baseTax);

  return {
    netBenefit: round2(net),
    grossedUp: round2(gross),
    taxOnBenefit,
    effectiveGrossUpRate: net === 0 ? 0 : round2(((gross - net) / net) * 100),
    iterations,
    /**
     * False means the iteration hit its cap without settling, which in practice
     * means a rate at or above 100%. Reported rather than thrown, so a
     * misconfigured table shows up as a flagged figure instead of a 500.
     */
    converged,
  };
}

/**
 * Days of physical presence in the host country.
 *
 * Every part of a day counts as a day, including both the day of arrival and
 * the day of departure — which is the rule in the dependent-services article of
 * essentially every treaty. Counting whole days or counting nights undercounts
 * by two days per trip, and on a commuter assignment with twenty trips a year
 * that is forty days: enough on its own to be the difference between 175 and
 * 215.
 *
 * Overlapping or duplicated trips are collapsed, because a day is a day however
 * many rows claim it.
 *
 * @param {Array<{arrival: *, departure: *}>} trips
 * @param {object} [window]
 * @returns {object}
 */
function countPresenceDays(trips, window = {}) {
  const from = parseDate(window.from);
  const to = parseDate(window.to);

  const days = new Set();
  const ignored = [];

  for (const trip of Array.isArray(trips) ? trips : []) {
    const arrival = parseDate(trip.arrival);
    const departure = parseDate(trip.departure) || arrival;

    if (!arrival || !departure || departure < arrival) {
      ignored.push({ trip, reason: 'Unusable arrival or departure date' });
      continue;
    }

    const cursor = new Date(
      Date.UTC(
        arrival.getUTCFullYear(),
        arrival.getUTCMonth(),
        arrival.getUTCDate(),
      ),
    );

    const last = Date.UTC(
      departure.getUTCFullYear(),
      departure.getUTCMonth(),
      departure.getUTCDate(),
    );

    while (cursor.getTime() <= last) {
      if ((!from || cursor >= from) && (!to || cursor <= to)) {
        days.add(cursor.toISOString().slice(0, 10));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return {
    days: days.size,
    dates: [...days].sort(),
    ignored,
  };
}

/**
 * Where the day count stands against the treaty threshold.
 *
 * The warning fires before the threshold rather than after it, because after it
 * there is nothing left to decide — the filing obligation exists and the only
 * question is who tells the employer about it.
 *
 * @param {number} days
 * @param {object} [options]
 * @returns {object}
 */
function assessTreatyExposure(days, options = {}) {
  const threshold = Number(options.threshold) || TREATY_DAY_THRESHOLD;
  const count = Number(days) || 0;
  const period = options.period || MEASUREMENT_PERIOD.ROLLING_12_MONTHS;

  const warnAt = Math.floor(threshold * DAY_COUNT_WARNING_RATIO);

  let status;
  let message;

  if (count > threshold) {
    status = 'exceeded';
    message = `${count} days of physical presence, past the ${threshold}-day treaty threshold — the host country has a taxing right and a filing obligation follows`;
  } else if (count >= warnAt) {
    status = 'approaching';
    message = `${count} days of physical presence, ${threshold - count} short of the ${threshold}-day treaty threshold`;
  } else {
    status = 'within';
    message = `${count} days of physical presence, within the ${threshold}-day treaty threshold`;
  }

  return {
    days: count,
    threshold,
    warnAt,
    remaining: Math.max(0, threshold - count),
    period,
    status,
    message,
  };
}

/**
 * The full employer cost of an assignment.
 *
 * This is the figure that goes in front of whoever approves the move, and it is
 * currently produced in a spreadsheet. The hypo tax appears as a *credit*
 * because it is money the employer collects back from the employee — leaving it
 * out overstates the cost by the whole hypo, which on a senior assignment is
 * not a rounding error.
 *
 * @param {object} assignment
 * @param {object} params
 * @returns {object}
 */
function projectAssignmentCost(assignment, params = {}) {
  const allowances = assignment.allowances || {};

  const allowanceLines = ASSIGNMENT_ALLOWANCES.map((key) => ({
    component: key,
    amount: round2(Number(allowances[key]) || 0),
  })).filter((line) => line.amount > 0);

  const allowanceTotal = allowanceLines.reduce(
    (sum, line) => sum + line.amount,
    0,
  );

  const base = Number(assignment.homeBaseSalary) || 0;
  const bonus = Number(assignment.homeBonus) || 0;
  const socialSecurity = Number(params.socialSecurity) || 0;
  const relocationOneOff = Number(params.relocationOneOff) || 0;
  const repatriation = Number(params.repatriation) || 0;

  const hypo = computeHypotheticalTax(assignment, params);

  const employerBorneTax =
    (Number(params.estimatedHomeTax) || 0) +
    (Number(params.estimatedHostTax) || 0);

  // Under laissez-faire the employer bears no tax and collects no hypo, so both
  // lines drop out. Including them would make an unarranged assignment look
  // like an equalized one on the cost sheet.
  const arranged = assignment.taxApproach !== TAX_APPROACH.LAISSEZ_FAIRE;

  const lines = [
    { component: 'baseSalary', amount: round2(base) },
    { component: 'bonus', amount: round2(bonus) },
    ...allowanceLines,
    { component: 'socialSecurity', amount: round2(socialSecurity) },
    { component: 'relocation', amount: round2(relocationOneOff) },
    { component: 'repatriation', amount: round2(repatriation) },
    {
      component: 'employerBorneTax',
      amount: arranged ? round2(employerBorneTax) : 0,
    },
    {
      component: 'hypotheticalTaxCredit',
      amount: arranged ? round2(-hypo.hypotheticalTax) : 0,
    },
  ].filter((line) => line.amount !== 0);

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    lines,
    allowanceTotal: round2(allowanceTotal),
    hypotheticalTaxCredit: arranged ? round2(hypo.hypotheticalTax) : 0,
    employerBorneTax: arranged ? round2(employerBorneTax) : 0,
    totalCost: round2(total),
    /**
     * The multiple of base salary, which is the number people actually
     * remember. Two to three is normal; above four is usually a hardship
     * location or a very generous housing line.
     */
    costMultiple: base === 0 ? 0 : round2(total / base),
  };
}

/**
 * Everything about one assignment, in one call.
 *
 * @param {object} assignment
 * @param {object} [params]
 * @returns {object}
 */
function buildAssignmentAssessment(assignment, params = {}) {
  const hypo = computeHypotheticalTax(assignment, params);

  const settlement = settleTaxPosition({
    approach: assignment.taxApproach,
    hypotheticalTax: hypo.hypotheticalTax,
    actualHomeTax: params.actualHomeTax,
    actualHostTax: params.actualHostTax,
    hypoTaxWithheld: params.hypoTaxWithheld ?? null,
  });

  const presence = countPresenceDays(params.trips, params.window);

  const exposure = assessTreatyExposure(presence.days, {
    threshold: params.treatyDayThreshold,
    period: params.measurementPeriod,
  });

  const cost = projectAssignmentCost(assignment, params);

  const grossUps = (
    Array.isArray(params.grossUpBenefits) ? params.grossUpBenefits : []
  ).map((benefit) => ({
    component: benefit.component,
    ...grossUp(benefit.amount, {
      taxTable: params.hostTaxTable || params.homeTaxTable,
      baseIncome: benefit.baseIncome ?? hypo.stayAtHome.total,
    }),
  }));

  return {
    hypo,
    settlement,
    presence: { days: presence.days, ignored: presence.ignored },
    exposure,
    cost,
    grossUps,
  };
}

module.exports = {
  TAX_APPROACH,
  ASSIGNMENT_TYPE,
  TREATY_DAY_THRESHOLD,
  MEASUREMENT_PERIOD,
  DAY_COUNT_WARNING_RATIO,
  GROSS_UP_MAX_ITERATIONS,
  ASSIGNMENT_ALLOWANCES,
  taxOnIncome,
  marginalRate,
  stayAtHomeCompensation,
  computeHypotheticalTax,
  settleTaxPosition,
  grossUp,
  countPresenceDays,
  assessTreatyExposure,
  projectAssignmentCost,
  buildAssignmentAssessment,
};
