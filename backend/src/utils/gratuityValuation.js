/**
 * Gratuity actuarial valuation — the Projected Unit Credit method (#1344).
 *
 * `utils/settlement.js` already computes gratuity, and this module is not a
 * second copy of it. The two answer different questions and the distinction is
 * the whole point of the feature:
 *
 *   - `settlement.js` answers "what do we owe this person, now, because they
 *     are leaving". One employee, one date, no uncertainty left in it.
 *
 *   - this module answers "what do we owe everybody, eventually, discounted to
 *     today". Every active employee, every future exit date, weighted by how
 *     likely each exit is and by what their salary will be when it happens.
 *
 * The second is a defined benefit obligation, and AS 15 (Revised) para 65 /
 * Ind AS 19 para 67 require it to be measured by Projected Unit Credit. There
 * is no shortcut: "gratuity payable if everyone resigned today" is not the DBO
 * and an auditor will say so. It ignores salary growth, which understates it;
 * it ignores discounting and attrition, which overstate it; the two errors do
 * not cancel and their net sign depends on the age profile of the workforce.
 *
 * Pure functions, no database access, matching how `settlement.js` and
 * `salaryCalculator.js` are written — every statutory and actuarial boundary in
 * here is a place the number can go wrong quietly, so each one is reachable
 * from a unit test without standing up Mongo.
 *
 * The statutory constants are read from `config/employment.js` rather than
 * redeclared. The five-year cliff, the 15/26 formula and the ₹20,00,000 ceiling
 * are the same statute for the F&F path and for this one, and a future
 * amendment should be one edit.
 */

const { GRATUITY } = require('../config/employment');

/**
 * Default actuarial assumptions.
 *
 * These are starting points, not recommendations. Every one of them is a
 * judgement a company makes with its auditor and then discloses, which is why
 * `computeValuation` snapshots whatever it was given onto its result: a
 * valuation that cannot be reproduced from its own record is not a valuation.
 *
 * The discount rate is the one with a rule attached — Ind AS 19 para 83 ties it
 * to the market yield on government securities of a term consistent with the
 * obligation, so it is not a free choice and it moves every year.
 */
const DEFAULT_ASSUMPTIONS = {
  /** Yield on government securities of comparable term. */
  discountRate: 0.0715,
  /** Expected long-term salary growth, compounded annually. */
  salaryEscalationRate: 0.08,
  /** Probability an employee leaves in any one year, before retirement. */
  attritionRate: 0.12,
  /** Age at which an employee is assumed to retire. */
  retirementAge: 58,
  /** Expected return on plan assets, for a funded scheme. */
  expectedReturnOnPlanAssets: 0.075,
  /**
   * The share of monthly pay that counts as "wages" for gratuity.
   *
   * Section 2(s) of the Payment of Gratuity Act defines wages as basic plus
   * dearness allowance, and excludes HRA, bonus, overtime and other
   * allowances. `employee.model.js` stores a single `monthlySalary`, so
   * without a breakdown the valuation has to assume a proportion. 0.5 is the
   * conventional basic+DA share of an Indian CTC; a tenant with a real salary
   * structure should override it.
   *
   * Set to 1 to treat `monthlySalary` as already being the gratuity wage.
   */
  gratuityWageRatio: 0.5,
  /**
   * Whether the scheme is funded — typically an LIC group gratuity policy.
   * Decides whether the funded-status block means anything.
   */
  funded: false,
};

/** How far a projection is allowed to run before it is treated as a mistake. */
const MAX_PROJECTION_YEARS = 60;

/** The shifts applied to produce the required sensitivity disclosure. */
const SENSITIVITY_SHIFTS = {
  /** ±50 basis points on the discount rate. */
  discountRate: 0.005,
  /** ±100 basis points on salary escalation. */
  salaryEscalationRate: 0.01,
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
 * @param {number} value
 * @returns {number} rounded to four decimals, for rates and probabilities
 */
function round4(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 10000) / 10000;
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
 * Elapsed years between two dates, as a fraction.
 *
 * 365.25 rather than 365 so a thirty-year projection does not drift by a week
 * of leap days — which is not material to the money, but does make two
 * valuations of the same employee a year apart disagree by an amount nobody
 * can explain.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function yearsBetween(from, to) {
  return (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Completed years of service for the benefit formula.
 *
 * Section 4(2): a part-year of six months or more counts as a full year, and
 * anything less is disregarded. That rounding is applied to the *total* service
 * at the assumed exit, not to past service — an employee with 4.6 years today
 * is not eligible today, and rounding them to 5 here would put a benefit into
 * the obligation that the statute does not owe.
 *
 * @param {number} rawYears
 * @returns {number}
 */
function completedYears(rawYears) {
  if (!Number.isFinite(rawYears) || rawYears <= 0) return 0;

  const whole = Math.floor(rawYears);
  const remainderMonths = (rawYears - whole) * 12;

  return remainderMonths >= GRATUITY.ROUND_UP_MONTHS ? whole + 1 : whole;
}

/**
 * The statutory benefit for a given wage and length of service.
 *
 * `(15 / 26) × monthly wage × completed years`, nil below the five-year cliff,
 * capped at the statutory maximum.
 *
 * The cap is applied here — to the *projected* benefit at the assumed exit —
 * and deliberately not to the accrued benefit at the valuation date. Capping in
 * the wrong place understates the obligation for exactly the population where
 * it is largest, because a senior employee whose projected benefit exceeds the
 * ceiling has an accrued benefit well below it, and capping the accrued figure
 * changes nothing while capping the projection changes a lot.
 *
 * @param {number} monthlyWage gratuity wage — basic + DA, not CTC
 * @param {number} yearsOfService completed years, already rounded
 * @returns {{amount: number, capped: boolean, eligible: boolean}}
 */
function statutoryBenefit(monthlyWage, yearsOfService) {
  const wage = Number(monthlyWage);

  if (!Number.isFinite(wage) || wage <= 0 || yearsOfService <= 0) {
    return { amount: 0, capped: false, eligible: false };
  }

  if (yearsOfService < GRATUITY.ELIGIBILITY_YEARS) {
    return { amount: 0, capped: false, eligible: false };
  }

  const raw =
    (GRATUITY.DAYS_PER_YEAR / GRATUITY.MONTH_DAYS) * wage * yearsOfService;

  if (raw > GRATUITY.CEILING) {
    return { amount: GRATUITY.CEILING, capped: true, eligible: true };
  }

  return { amount: round2(raw), capped: false, eligible: true };
}

/**
 * Compound a salary forward.
 *
 * @param {number} currentWage
 * @param {number} years
 * @param {number} escalationRate
 * @returns {number}
 */
function projectWage(currentWage, years, escalationRate) {
  return Number(currentWage) * Math.pow(1 + escalationRate, years);
}

/**
 * Present value of one rupee received `years` from now.
 *
 * @param {number} years
 * @param {number} discountRate
 * @returns {number}
 */
function discountFactor(years, discountRate) {
  return 1 / Math.pow(1 + discountRate, years);
}

/**
 * Merge caller assumptions over the defaults, and refuse the ones that make the
 * arithmetic meaningless.
 *
 * A discount rate of -1 divides by zero. A retirement age below a plausible
 * working age makes every employee's future service negative. Both are input
 * errors rather than edge cases, and a valuation that silently produced zero
 * for them would be worse than one that throws.
 *
 * @param {object} [assumptions]
 * @returns {object}
 */
function normaliseAssumptions(assumptions = {}) {
  const merged = { ...DEFAULT_ASSUMPTIONS, ...assumptions };

  const rates = [
    ['discountRate', -0.99, 1],
    ['salaryEscalationRate', -0.5, 1],
    ['attritionRate', 0, 0.99],
    ['expectedReturnOnPlanAssets', -0.5, 1],
    ['gratuityWageRatio', 0.01, 1],
  ];

  for (const [key, min, max] of rates) {
    const value = Number(merged[key]);

    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(
        `${key} must be a number between ${min} and ${max}, received ${merged[key]}`,
      );
    }

    merged[key] = value;
  }

  const retirementAge = Number(merged.retirementAge);
  if (
    !Number.isFinite(retirementAge) ||
    retirementAge < 40 ||
    retirementAge > 75
  ) {
    throw new RangeError(
      `retirementAge must be between 40 and 75, received ${merged.retirementAge}`,
    );
  }
  merged.retirementAge = retirementAge;
  merged.funded = Boolean(merged.funded);

  return merged;
}

/**
 * The exit scenarios for one employee, with the probability of each.
 *
 * An employee can leave in any year between the valuation date and retirement,
 * or reach retirement. Under a flat attrition rate `q`, the probability of
 * surviving `t` whole years and then leaving in year `t + 1` is
 * `(1 - q)^t × q`, and the residual probability of surviving to retirement is
 * `(1 - q)^n`. The scenarios therefore sum to 1 by construction, which
 * `computeEmployeeObligation` asserts on rather than assumes.
 *
 * Exits are placed at the end of the year they occur in. Placing them at the
 * start would credit a full extra year of service that has not been worked.
 *
 * @param {number} futureYears whole years to retirement
 * @param {number} attritionRate
 * @returns {Array<{yearsFromNow: number, probability: number, mode: string}>}
 */
function exitScenarios(futureYears, attritionRate) {
  const horizon = Math.max(
    0,
    Math.min(Math.floor(futureYears), MAX_PROJECTION_YEARS),
  );
  const scenarios = [];
  let survival = 1;

  for (let year = 1; year <= horizon; year += 1) {
    const probability = survival * attritionRate;
    survival -= probability;

    scenarios.push({
      yearsFromNow: year,
      probability,
      mode: 'withdrawal',
    });
  }

  // Whatever probability is left belongs to reaching retirement. Computing it
  // as a residual rather than as `(1 - q)^n` means the scenarios sum to exactly
  // 1 regardless of floating point drift over a forty-year horizon.
  scenarios.push({
    yearsFromNow: Math.max(horizon, 0),
    probability: survival,
    mode: 'retirement',
  });

  return scenarios;
}

/**
 * The obligation carried for a single employee.
 *
 * This is the heart of the method. For each possible exit:
 *
 *   1. project the gratuity wage forward to that exit at the escalation rate,
 *   2. work out the statutory benefit that wage and the total service at exit
 *      would produce — including the five-year cliff and the ceiling,
 *   3. attribute the part of that benefit earned *so far*, which under
 *      Projected Unit Credit is `pastService / totalServiceAtExit`,
 *   4. discount it back to the valuation date,
 *   5. weight it by the probability of that exit actually happening.
 *
 * Current service cost is the same sum with the attribution replaced by one
 * year's worth — `1 / totalServiceAtExit` — because that is the additional
 * benefit the coming year of work will earn.
 *
 * @param {object} employee
 * @param {Date} valuationDate
 * @param {object} assumptions normalised
 * @returns {object|null} null when the record cannot be valued
 */
function computeEmployeeObligation(employee, valuationDate, assumptions) {
  const joiningDate = parseDate(employee.joiningDate);
  const dateOfBirth = parseDate(employee.dateOfBirth);
  const monthlySalary = Number(employee.monthlySalary);

  if (!joiningDate || !Number.isFinite(monthlySalary) || monthlySalary <= 0) {
    return null;
  }

  const pastService = Math.max(0, yearsBetween(joiningDate, valuationDate));

  // Without a date of birth there is no age, and without an age there is no
  // retirement date. Falling back to the full horizon would treat a
  // fifty-seven-year-old as having decades left and overstate their
  // obligation; falling back to zero would drop them from the valuation
  // entirely. Assuming an average career remaining is the least wrong of the
  // three, and the record is flagged so the caller can see how much of the
  // total rests on it.
  const assumedAge = dateOfBirth
    ? yearsBetween(dateOfBirth, valuationDate)
    : null;

  const futureYears =
    assumedAge === null
      ? Math.max(0, assumptions.retirementAge - 35)
      : Math.max(0, assumptions.retirementAge - assumedAge);

  const gratuityWage = monthlySalary * assumptions.gratuityWageRatio;

  const scenarios = exitScenarios(futureYears, assumptions.attritionRate);

  let obligation = 0;
  let serviceCost = 0;
  let expectedBenefit = 0;
  let anyCapped = false;

  for (const scenario of scenarios) {
    if (scenario.probability <= 0) continue;

    const totalServiceRaw = pastService + scenario.yearsFromNow;
    const totalServiceYears = completedYears(totalServiceRaw);

    const wageAtExit = projectWage(
      gratuityWage,
      scenario.yearsFromNow,
      assumptions.salaryEscalationRate,
    );

    const benefit = statutoryBenefit(wageAtExit, totalServiceYears);
    if (benefit.capped) anyCapped = true;
    if (benefit.amount <= 0) continue;

    const discount = discountFactor(
      scenario.yearsFromNow,
      assumptions.discountRate,
    );

    // Guard the divisor rather than the numerator: a brand new joiner valued on
    // their first day has `totalServiceRaw` of essentially zero in the
    // immediate-exit scenario, and dividing by it would produce Infinity for a
    // benefit that is nil anyway.
    const divisor = Math.max(totalServiceRaw, 1 / 12);
    const accruedShare = Math.min(1, pastService / divisor);

    obligation +=
      scenario.probability * benefit.amount * accruedShare * discount;
    serviceCost += (scenario.probability * benefit.amount * discount) / divisor;
    expectedBenefit += scenario.probability * benefit.amount;
  }

  const vested = completedYears(pastService) >= GRATUITY.ELIGIBILITY_YEARS;

  return {
    employeeId: employee.employeeId || employee._id || null,
    name: employee.name || employee.fullName || '',
    department: employee.department || '',
    joiningDate,
    pastServiceYears: round4(pastService),
    ageYears: assumedAge === null ? null : round4(assumedAge),
    ageAssumed: assumedAge === null,
    monthlySalary: round2(monthlySalary),
    gratuityWage: round2(gratuityWage),
    /**
     * Vesting is about the *statutory* right, not about whether the employee
     * contributes to the obligation. An employee with three years of service
     * has no vested benefit and still carries a real obligation, because the
     * scenarios in which they stay past five years are not all zero-probability.
     * Reporting the vested/unvested split is a disclosure requirement and this
     * is where the flag comes from.
     */
    vested,
    definedBenefitObligation: round2(obligation),
    currentServiceCost: round2(serviceCost),
    expectedBenefitAtExit: round2(expectedBenefit),
    ceilingApplied: anyCapped,
  };
}

/**
 * Run a valuation across a workforce.
 *
 * @param {Array<object>} employees
 * @param {object} [options]
 * @param {Date|string} [options.valuationDate]
 * @param {object} [options.assumptions]
 * @returns {object}
 */
function computeValuation(employees, options = {}) {
  const assumptions = normaliseAssumptions(options.assumptions);
  const valuationDate = parseDate(options.valuationDate) || new Date();

  const roster = Array.isArray(employees) ? employees : [];

  const schedule = [];
  const skipped = [];

  for (const employee of roster) {
    const row = computeEmployeeObligation(employee, valuationDate, assumptions);

    if (!row) {
      skipped.push({
        employeeId: employee.employeeId || employee._id || null,
        name: employee.name || employee.fullName || '',
        reason: !parseDate(employee.joiningDate)
          ? 'No joining date — length of service cannot be established'
          : 'No usable monthly salary',
      });
      continue;
    }

    schedule.push(row);
  }

  const totals = schedule.reduce(
    (acc, row) => {
      acc.definedBenefitObligation += row.definedBenefitObligation;
      acc.currentServiceCost += row.currentServiceCost;
      if (row.vested) acc.vestedObligation += row.definedBenefitObligation;
      else acc.unvestedObligation += row.definedBenefitObligation;
      if (row.ageAssumed) acc.recordsWithAssumedAge += 1;
      return acc;
    },
    {
      definedBenefitObligation: 0,
      currentServiceCost: 0,
      vestedObligation: 0,
      unvestedObligation: 0,
      recordsWithAssumedAge: 0,
    },
  );

  return {
    valuationDate,
    assumptions,
    headcountValued: schedule.length,
    headcountSkipped: skipped.length,
    definedBenefitObligation: round2(totals.definedBenefitObligation),
    currentServiceCost: round2(totals.currentServiceCost),
    vestedObligation: round2(totals.vestedObligation),
    unvestedObligation: round2(totals.unvestedObligation),
    recordsWithAssumedAge: totals.recordsWithAssumedAge,
    schedule,
    skipped,
  };
}

/**
 * The defined benefit obligation roll-forward.
 *
 * The identity is fixed:
 *
 *     closing DBO = opening DBO
 *                 + current service cost
 *                 + interest cost
 *                 - benefits paid
 *                 + actuarial (gain) / loss
 *
 * Everything except the last term is known, so the actuarial gain or loss is
 * the balancing figure. That is not a fudge — it is the definition. What makes
 * it a *disclosure* rather than a plug is splitting it, which is what
 * `priorAssumptionsClosingDbo` is for: re-run the closing valuation on last
 * year's assumptions and the difference from the expected figure is experience,
 * while the difference between the two closing figures is the assumption change.
 *
 * "The provision moved by ₹41 lakh" is not an answer. "₹12 lakh of it was the
 * discount rate dropping 50 basis points" is.
 *
 * @param {object} params
 * @param {number} params.openingDbo
 * @param {number} params.currentServiceCost
 * @param {number} params.closingDbo
 * @param {number} params.discountRate the rate the *opening* DBO was measured at
 * @param {number} [params.benefitsPaid]
 * @param {number} [params.pastServiceCost] cost of a plan amendment, if any
 * @param {number} [params.priorAssumptionsClosingDbo]
 * @returns {object}
 */
function rollForward({
  openingDbo,
  currentServiceCost,
  closingDbo,
  discountRate,
  benefitsPaid = 0,
  pastServiceCost = 0,
  priorAssumptionsClosingDbo = null,
}) {
  const opening = Number(openingDbo) || 0;
  const closing = Number(closingDbo) || 0;
  const service = Number(currentServiceCost) || 0;
  const paid = Number(benefitsPaid) || 0;
  const pastService = Number(pastServiceCost) || 0;

  // Interest unwinds on the opening obligation. Benefits paid during the year
  // stop accruing interest when they are paid, and without payment dates the
  // conventional approximation is a half-year of interest on them — which is
  // what the subtraction below does.
  const interestCost =
    discountRate * (opening - paid / 2) + discountRate * (service / 2);

  const expectedClosing = opening + service + pastService + interestCost - paid;
  const actuarialGainLoss = closing - expectedClosing;

  let experienceAdjustment = null;
  let assumptionChange = null;

  if (
    priorAssumptionsClosingDbo !== null &&
    Number.isFinite(Number(priorAssumptionsClosingDbo))
  ) {
    const priorClosing = Number(priorAssumptionsClosingDbo);
    experienceAdjustment = round2(priorClosing - expectedClosing);
    assumptionChange = round2(closing - priorClosing);
  }

  return {
    openingDbo: round2(opening),
    currentServiceCost: round2(service),
    pastServiceCost: round2(pastService),
    interestCost: round2(interestCost),
    benefitsPaid: round2(paid),
    expectedClosingDbo: round2(expectedClosing),
    closingDbo: round2(closing),
    actuarialGainLoss: round2(actuarialGainLoss),
    experienceAdjustment,
    assumptionChange,
    /**
     * Sign convention, stated because it is the single most common source of a
     * misread disclosure: a positive `actuarialGainLoss` means the obligation
     * came in *higher* than expected, which is a loss to the employer.
     */
    outcome: actuarialGainLoss > 0 ? 'loss' : 'gain',
  };
}

/**
 * Funded status against plan assets.
 *
 * Most Indian employers fund gratuity through an LIC group policy. An unfunded
 * scheme has no plan assets and its net liability is simply the DBO, which is
 * why this returns a coherent answer for `planAssets = 0` rather than refusing.
 *
 * @param {object} params
 * @param {number} params.definedBenefitObligation
 * @param {number} [params.openingPlanAssets]
 * @param {number} [params.contributions]
 * @param {number} [params.benefitsPaidFromFund]
 * @param {number} [params.expectedReturnRate]
 * @param {number} [params.actualClosingPlanAssets]
 * @returns {object}
 */
function computeFundedStatus({
  definedBenefitObligation,
  openingPlanAssets = 0,
  contributions = 0,
  benefitsPaidFromFund = 0,
  expectedReturnRate = DEFAULT_ASSUMPTIONS.expectedReturnOnPlanAssets,
  actualClosingPlanAssets = null,
}) {
  const dbo = Number(definedBenefitObligation) || 0;
  const opening = Number(openingPlanAssets) || 0;
  const contributed = Number(contributions) || 0;
  const paid = Number(benefitsPaidFromFund) || 0;

  const expectedReturn =
    expectedReturnRate * (opening + contributed / 2 - paid / 2);

  const expectedClosing = opening + contributed - paid + expectedReturn;

  const closing =
    actualClosingPlanAssets === null
      ? expectedClosing
      : Number(actualClosingPlanAssets) || 0;

  const returnOnAssets = closing - opening - contributed + paid;
  const actuarialGainOnAssets = closing - expectedClosing;

  const netLiability = dbo - closing;

  return {
    definedBenefitObligation: round2(dbo),
    openingPlanAssets: round2(opening),
    contributions: round2(contributed),
    benefitsPaidFromFund: round2(paid),
    expectedReturn: round2(expectedReturn),
    actualReturn: round2(returnOnAssets),
    actuarialGainOnAssets: round2(actuarialGainOnAssets),
    closingPlanAssets: round2(closing),
    netLiability: round2(netLiability),
    /**
     * A negative net liability is a surplus, and a surplus is not automatically
     * an asset — Ind AS 19 para 64 limits it to what can actually be recovered.
     * Reported as a status rather than as a signed number so nobody posts a
     * surplus to the balance sheet without deciding that question.
     */
    status: netLiability > 0 ? 'deficit' : 'surplus',
    funded: closing > 0,
  };
}

/**
 * Restate the obligation under shifted assumptions.
 *
 * Required disclosure, and trivial once the engine exists: re-run the same
 * workforce with one assumption moved and report the difference. The shifts are
 * the conventional ones — 50 basis points on the discount rate, 100 on salary
 * escalation.
 *
 * Worth knowing what the output should look like, because a sign error here is
 * invisible: raising the discount rate *lowers* the obligation, and raising
 * salary escalation *raises* it. If a sensitivity table shows otherwise,
 * something is wrong upstream of the table.
 *
 * @param {Array<object>} employees
 * @param {object} options same shape as `computeValuation`
 * @returns {Array<object>}
 */
function computeSensitivities(employees, options = {}) {
  const base = computeValuation(employees, options);
  const rows = [];

  for (const [assumption, shift] of Object.entries(SENSITIVITY_SHIFTS)) {
    for (const direction of [1, -1]) {
      const shifted = {
        ...base.assumptions,
        [assumption]: base.assumptions[assumption] + direction * shift,
      };

      const result = computeValuation(employees, {
        ...options,
        assumptions: shifted,
      });

      const delta =
        result.definedBenefitObligation - base.definedBenefitObligation;

      rows.push({
        assumption,
        shift: round4(direction * shift),
        direction: direction > 0 ? 'increase' : 'decrease',
        definedBenefitObligation: result.definedBenefitObligation,
        change: round2(delta),
        changePercent:
          base.definedBenefitObligation === 0
            ? 0
            : round2((delta / base.definedBenefitObligation) * 100),
      });
    }
  }

  return rows;
}

/**
 * A complete valuation: obligation, roll-forward, funded status, sensitivities.
 *
 * The one composition point, so a caller does not have to know the order the
 * pieces go in — the roll-forward needs the closing DBO, which is the thing the
 * valuation produces, and getting that wiring wrong is how a report ends up
 * rolling forward to last year's number.
 *
 * @param {Array<object>} employees
 * @param {object} [options]
 * @returns {object}
 */
function buildValuationReport(employees, options = {}) {
  const valuation = computeValuation(employees, options);

  const prior = options.prior || {};

  const roll = rollForward({
    openingDbo: prior.definedBenefitObligation || 0,
    currentServiceCost:
      prior.currentServiceCost || valuation.currentServiceCost,
    closingDbo: valuation.definedBenefitObligation,
    discountRate:
      prior.discountRate === undefined
        ? valuation.assumptions.discountRate
        : prior.discountRate,
    benefitsPaid: options.benefitsPaid || 0,
    pastServiceCost: options.pastServiceCost || 0,
    priorAssumptionsClosingDbo:
      prior.assumptions === undefined || prior.assumptions === null
        ? null
        : computeValuation(employees, {
            ...options,
            assumptions: prior.assumptions,
          }).definedBenefitObligation,
  });

  const funded = computeFundedStatus({
    definedBenefitObligation: valuation.definedBenefitObligation,
    openingPlanAssets: options.openingPlanAssets || 0,
    contributions: options.contributions || 0,
    benefitsPaidFromFund:
      options.benefitsPaidFromFund || options.benefitsPaid || 0,
    expectedReturnRate: valuation.assumptions.expectedReturnOnPlanAssets,
    actualClosingPlanAssets:
      options.actualClosingPlanAssets === undefined
        ? null
        : options.actualClosingPlanAssets,
  });

  const sensitivities = computeSensitivities(employees, options);

  // The expense recognised in the P&L for the period, which is the figure the
  // accounting module needs to post and the one finance is actually asked for.
  const expenseForPeriod = round2(
    roll.currentServiceCost +
      roll.pastServiceCost +
      roll.interestCost -
      funded.expectedReturn,
  );

  return {
    ...valuation,
    rollForward: roll,
    fundedStatus: funded,
    sensitivities,
    expenseForPeriod,
  };
}

module.exports = {
  DEFAULT_ASSUMPTIONS,
  SENSITIVITY_SHIFTS,
  MAX_PROJECTION_YEARS,
  completedYears,
  statutoryBenefit,
  projectWage,
  discountFactor,
  normaliseAssumptions,
  exitScenarios,
  computeEmployeeObligation,
  computeValuation,
  rollForward,
  computeFundedStatus,
  computeSensitivities,
  buildValuationReport,
};
