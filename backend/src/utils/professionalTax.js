/**
 * Professional tax — state slabs, half-yearly states and the enrolment
 * liability (#1876).
 *
 * `complianceAggregator.js` looks through a payroll run for a deduction line
 * labelled `professional tax`, `ptax` or `pt`, adds them up and reports the
 * total. That is the whole of the product's relationship with this levy: it
 * reads back a number somebody typed. This module computes it instead.
 *
 * Four things shape everything below.
 *
 * **Periodicity is part of the rule, not an assumption around it.** Maharashtra
 * and Karnataka are monthly and a slab table keyed by state handles them.
 * Tamil Nadu and Kerala are **half-yearly**, and the slab applies to the
 * aggregate income of the half-year. An employee who crosses a slab in one
 * month of a half-year and not in the others has a different liability from one
 * who earned the same total evenly, and only a half-yearly aggregation can see
 * it. A monthly engine with a multiplier does not get those states slightly
 * wrong — it computes a different thing.
 *
 * **The special month is not a rounding.** Maharashtra levies ₹300 in February
 * against ₹200 in the other eleven months, so the year lands exactly on the
 * Article 276 ceiling of ₹2,500. Twelve times ₹200 is short by ₹100 on every
 * employee above the threshold, every year, and it looks entirely reasonable.
 *
 * **The state is the state of the place of work.** Not the registered office
 * and not the employee's residence. A company in Mumbai with an office in
 * Bengaluru deducts under two registration certificates at two different slabs,
 * so `assessEstablishment` returns one remittance per certificate and never a
 * single total.
 *
 * **Accrued and paid are different numbers.** Section 16(iii) of the
 * Income-tax Act allows professional tax **actually paid** as a deduction from
 * salary income. A figure that has been deducted from an employee and not yet
 * remitted is not allowable, so `section16iiiDeduction` reads the payments and
 * deliberately not the accruals — feeding the accrual into the salary
 * computation would understate taxable income and therefore TDS.
 *
 * The slab tables below are **seed defaults with effective-from dates**, not a
 * current-state snapshot. Karnataka's threshold moved to ₹25,000 in 2023 and
 * Maharashtra's women's threshold moved with it; a payroll re-run for an
 * earlier month has to reproduce the slab that was in force then. A tenant
 * overrides them per state, and the override is dated too.
 *
 * Pure functions, no database access, matching how `minimumWages.js` and
 * `labourWelfareFund.js` are written.
 */

/**
 * Article 276(2) of the Constitution.
 *
 * A hard ceiling on what any state may levy on one person in one year, and it
 * binds the *total* rather than any one slab — which is why it is enforced as a
 * cap on the year's accrual rather than assumed to fall out of the tables.
 */
const ANNUAL_CEILING = 2500;

const PERIODICITY = {
  MONTHLY: 'MONTHLY',
  HALF_YEARLY: 'HALF_YEARLY',
  ANNUAL: 'ANNUAL',
  /** The state does not levy professional tax at all. */
  NOT_LEVIED: 'NOT_LEVIED',
};

/**
 * Who levies it.
 *
 * Kerala levies at the level of the panchayat or municipality, so the rate
 * depends on the local body of the *workplace* rather than on the state. A
 * state-keyed table cannot express that on its own, and pretending otherwise
 * produces a plausible figure under the wrong authority.
 */
const LEVY_LEVEL = {
  STATE: 'STATE',
  LOCAL_BODY: 'LOCAL_BODY',
};

/**
 * The two certificates, which are different obligations.
 *
 * The enrolment certificate covers the employer's **own** liability on the
 * trade or profession it carries on — an annual amount owed by the company and
 * deducted from nobody. The registration certificate is the authority under
 * which it deducts from employees and remits. They have different due dates and
 * different returns, and the product has never had a concept of the first.
 */
const CERTIFICATE = {
  ENROLMENT: 'ENROLMENT',
  REGISTRATION: 'REGISTRATION',
};

/**
 * Per-person exemptions.
 *
 * These are exemptions on the person and not boundaries on the slab, so they
 * are applied after the slab is found rather than folded into the table. The
 * distinction matters when a state amends a slab: the exemption survives it.
 */
const EXEMPTION = {
  DISABILITY: 'DISABILITY',
  PARENT_OF_CHILD_WITH_DISABILITY: 'PARENT_OF_CHILD_WITH_DISABILITY',
  ARMED_FORCES: 'ARMED_FORCES',
  SENIOR_CITIZEN: 'SENIOR_CITIZEN',
  BADLI_WORKER: 'BADLI_WORKER',
};

/** Categories a state's table may distinguish. */
const CATEGORY = {
  DEFAULT: 'DEFAULT',
  WOMAN: 'WOMAN',
};

const FINDING = {
  NOT_LEVIED_IN_STATE: 'NOT_LEVIED_IN_STATE',
  WORK_STATE_MISSING: 'WORK_STATE_MISSING',
  NO_RULE_FOR_STATE: 'NO_RULE_FOR_STATE',
  RULE_PREDATES_PERIOD: 'RULE_PREDATES_PERIOD',
  ANNUAL_CEILING_APPLIED: 'ANNUAL_CEILING_APPLIED',
  HALF_YEARLY_ATTRIBUTED: 'HALF_YEARLY_ATTRIBUTED',
  PERSON_EXEMPT: 'PERSON_EXEMPT',
  DEDUCTED_NOT_REMITTED: 'DEDUCTED_NOT_REMITTED',
  LOCAL_BODY_NOT_SET: 'LOCAL_BODY_NOT_SET',
  ENROLMENT_NOT_RECORDED: 'ENROLMENT_NOT_RECORDED',
  DEDUCTION_DISAGREES_WITH_PAYROLL: 'DEDUCTION_DISAGREES_WITH_PAYROLL',
};

const FINDING_AUTHORITY = {
  [FINDING.NOT_LEVIED_IN_STATE]: 'Article 276',
  [FINDING.WORK_STATE_MISSING]: 'Place of work',
  [FINDING.NO_RULE_FOR_STATE]: 'State enactment',
  [FINDING.RULE_PREDATES_PERIOD]: 'State enactment',
  [FINDING.ANNUAL_CEILING_APPLIED]: 'Article 276(2)',
  [FINDING.HALF_YEARLY_ATTRIBUTED]: 'State enactment',
  [FINDING.PERSON_EXEMPT]: 'State enactment',
  [FINDING.DEDUCTED_NOT_REMITTED]: 'Section 16(iii), Income-tax Act',
  [FINDING.LOCAL_BODY_NOT_SET]: 'Kerala Panchayat Raj / Municipality Acts',
  [FINDING.ENROLMENT_NOT_RECORDED]: 'Enrolment certificate',
  [FINDING.DEDUCTION_DISAGREES_WITH_PAYROLL]: 'State enactment',
};

const SEVERITY = {
  BREACH: 'BREACH',
  EXPOSURE: 'EXPOSURE',
  INFORMATIONAL: 'INFORMATIONAL',
};

const FINDING_SEVERITY = {
  [FINDING.NOT_LEVIED_IN_STATE]: SEVERITY.INFORMATIONAL,
  [FINDING.WORK_STATE_MISSING]: SEVERITY.BREACH,
  [FINDING.NO_RULE_FOR_STATE]: SEVERITY.BREACH,
  [FINDING.RULE_PREDATES_PERIOD]: SEVERITY.EXPOSURE,
  [FINDING.ANNUAL_CEILING_APPLIED]: SEVERITY.INFORMATIONAL,
  [FINDING.HALF_YEARLY_ATTRIBUTED]: SEVERITY.INFORMATIONAL,
  [FINDING.PERSON_EXEMPT]: SEVERITY.INFORMATIONAL,
  [FINDING.DEDUCTED_NOT_REMITTED]: SEVERITY.EXPOSURE,
  [FINDING.LOCAL_BODY_NOT_SET]: SEVERITY.BREACH,
  [FINDING.ENROLMENT_NOT_RECORDED]: SEVERITY.EXPOSURE,
  [FINDING.DEDUCTION_DISAGREES_WITH_PAYROLL]: SEVERITY.EXPOSURE,
};

// --- Seed rules -------------------------------------------------------------

/**
 * Seed slab tables, each with the date it took effect.
 *
 * Dated rather than current, and seeds rather than truth. A state amends its
 * table by notification and a re-run for an earlier month has to reproduce what
 * was in force then, so `resolveRule` picks by date and never by "the latest
 * one". A tenant that has been notified of something else overrides per state,
 * and the override carries its own effective date.
 *
 * `upTo` is inclusive and the last band carries `null`. Amounts are per period
 * of the state's own periodicity — per month in a monthly state, per half-year
 * in a half-yearly one — which is why the periodicity travels with the table
 * rather than beside it.
 */
const SEED_RULES = [
  {
    state: 'MH',
    name: 'Maharashtra',
    effectiveFrom: '2023-04-01',
    periodicity: PERIODICITY.MONTHLY,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [
      { upTo: 7500, amount: 0 },
      { upTo: 10000, amount: 175 },
      { upTo: null, amount: 200 },
    ],
    /**
     * ₹300 in February against ₹200 in the other eleven, so the year lands on
     * ₹2,500 exactly. Not a rounding and not optional.
     */
    specialMonth: { month: 2, amount: 300 },
    categorySlabs: {
      [CATEGORY.WOMAN]: [
        { upTo: 25000, amount: 0 },
        { upTo: null, amount: 200 },
      ],
    },
  },
  {
    state: 'KA',
    name: 'Karnataka',
    effectiveFrom: '2023-04-01',
    periodicity: PERIODICITY.MONTHLY,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [
      { upTo: 24999, amount: 0 },
      { upTo: null, amount: 200 },
    ],
  },
  {
    state: 'WB',
    name: 'West Bengal',
    effectiveFrom: '2019-04-01',
    periodicity: PERIODICITY.MONTHLY,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [
      { upTo: 10000, amount: 0 },
      { upTo: 15000, amount: 110 },
      { upTo: 25000, amount: 130 },
      { upTo: 40000, amount: 150 },
      { upTo: null, amount: 200 },
    ],
  },
  {
    state: 'TG',
    name: 'Telangana',
    effectiveFrom: '2019-04-01',
    periodicity: PERIODICITY.MONTHLY,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [
      { upTo: 15000, amount: 0 },
      { upTo: 20000, amount: 150 },
      { upTo: null, amount: 200 },
    ],
  },
  {
    state: 'GJ',
    name: 'Gujarat',
    effectiveFrom: '2022-04-01',
    periodicity: PERIODICITY.MONTHLY,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [
      { upTo: 12000, amount: 0 },
      { upTo: null, amount: 200 },
    ],
  },
  {
    state: 'TN',
    name: 'Tamil Nadu',
    effectiveFrom: '2018-10-01',
    /**
     * Half-yearly, and the slab is on the **aggregate income of the half-year**.
     * A monthly engine with a multiplier gets a different answer for anyone
     * whose income is uneven across the six months.
     */
    periodicity: PERIODICITY.HALF_YEARLY,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [
      { upTo: 21000, amount: 0 },
      { upTo: 30000, amount: 135 },
      { upTo: 45000, amount: 315 },
      { upTo: 60000, amount: 690 },
      { upTo: 75000, amount: 1025 },
      { upTo: null, amount: 1250 },
    ],
  },
  {
    state: 'KL',
    name: 'Kerala',
    effectiveFrom: '2015-04-01',
    periodicity: PERIODICITY.HALF_YEARLY,
    /**
     * Levied by the panchayat or municipality of the workplace. The table is
     * the common one, and an establishment whose local body has notified
     * something else overrides it — which is why `requiresLocalBody` is a
     * property of the rule rather than a note in a comment.
     */
    levyLevel: LEVY_LEVEL.LOCAL_BODY,
    requiresLocalBody: true,
    slabs: [
      { upTo: 11999, amount: 0 },
      { upTo: 17999, amount: 120 },
      { upTo: 29999, amount: 180 },
      { upTo: 44999, amount: 300 },
      { upTo: 59999, amount: 450 },
      { upTo: 74999, amount: 600 },
      { upTo: 99999, amount: 750 },
      { upTo: 124999, amount: 1000 },
      { upTo: null, amount: 1250 },
    ],
  },
  // Not levied. Present rather than absent, because "no rule for this state" and
  // "this state does not levy it" are different answers, and only the first is
  // a problem to be fixed.
  ...['DL', 'HR', 'UP', 'RJ', 'UK', 'CH', 'PB', 'GA', 'AN'].map((state) => ({
    state,
    name: state,
    effectiveFrom: '1900-01-01',
    periodicity: PERIODICITY.NOT_LEVIED,
    levyLevel: LEVY_LEVEL.STATE,
    slabs: [],
  })),
];

// --- Dates and periods ------------------------------------------------------

/**
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
function toUtcDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

/**
 * The first day of a wage month, at UTC midnight.
 *
 * @param {{year: number, month: number}} period `month` is 1-12.
 * @returns {Date}
 */
function periodStart(period) {
  return new Date(Date.UTC(Number(period.year), Number(period.month) - 1, 1));
}

/**
 * The twelve wage months of a financial year, April to March.
 *
 * @param {number} financialYear The year the April falls in.
 * @returns {Array<{year: number, month: number}>}
 */
function financialYearMonths(financialYear) {
  const months = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const month = ((3 + offset) % 12) + 1;
    const year = 3 + offset < 12 ? financialYear : financialYear + 1;
    months.push({ year, month });
  }
  return months;
}

/**
 * Which half-year a wage month falls in.
 *
 * The half-years run April-September and October-March, which is the split the
 * half-yearly states use. Returning a key rather than an index means the
 * grouping survives a financial year boundary inside the same call.
 *
 * @param {{year: number, month: number}} period
 * @returns {{key: string, months: Array<{year: number, month: number}>}}
 */
function halfYearOf(period) {
  const month = Number(period.month);
  const year = Number(period.year);

  const firstHalf = month >= 4 && month <= 9;
  const financialYear = month >= 4 ? year : year - 1;

  const months = firstHalf
    ? [4, 5, 6, 7, 8, 9].map((m) => ({ year: financialYear, month: m }))
    : [
        ...[10, 11, 12].map((m) => ({ year: financialYear, month: m })),
        ...[1, 2, 3].map((m) => ({ year: financialYear + 1, month: m })),
      ];

  return { key: `${financialYear}-${firstHalf ? 'H1' : 'H2'}`, months };
}

// --- Rules ------------------------------------------------------------------

/**
 * The rule for a state in force on a date.
 *
 * Picks the latest rule whose `effectiveFrom` is on or before the date, which
 * is not the same as the latest rule. A payroll re-run for March 2023 in
 * Karnataka has to see the old ₹15,000 threshold and not the ₹25,000 one that
 * replaced it in April.
 *
 * @param {string} state
 * @param {Date|string} asOn
 * @param {Array<object>} [ruleSets]
 * @returns {object|null}
 */
function resolveRule(state, asOn, ruleSets = SEED_RULES) {
  const on = toUtcDate(asOn);
  if (!state || !on) return null;

  const code = String(state).trim().toUpperCase();

  const candidates = (ruleSets || [])
    .filter((rule) => String(rule.state).toUpperCase() === code)
    .filter((rule) => {
      const from = toUtcDate(rule.effectiveFrom);
      return from ? from.getTime() <= on.getTime() : true;
    })
    .sort(
      (a, b) =>
        toUtcDate(a.effectiveFrom).getTime() -
        toUtcDate(b.effectiveFrom).getTime(),
    );

  return candidates.length ? candidates[candidates.length - 1] : null;
}

/**
 * The slab an amount falls in.
 *
 * `upTo` is inclusive, and the last band carries null. A table whose last band
 * is bounded would let a high earner fall off the end and attract nothing,
 * which is why `slabFor` returns the last band rather than undefined.
 *
 * @param {number} amount
 * @param {Array<{upTo: number|null, amount: number}>} slabs
 * @returns {{upTo: number|null, amount: number, index: number}|null}
 */
function slabFor(amount, slabs) {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;

  const value = Number(amount) || 0;

  for (let index = 0; index < slabs.length; index += 1) {
    const slab = slabs[index];
    if (slab.upTo === null || slab.upTo === undefined || value <= slab.upTo) {
      return { ...slab, index };
    }
  }

  return { ...slabs[slabs.length - 1], index: slabs.length - 1 };
}

/**
 * The table that applies to a person, after category.
 *
 * Maharashtra's women's threshold is a different table rather than a different
 * row, so it is selected here and the exemptions below are applied to whatever
 * comes out.
 *
 * @param {object} rule
 * @param {string} [category]
 * @returns {Array<object>}
 */
function slabsFor(rule, category = CATEGORY.DEFAULT) {
  if (!rule) return [];
  const byCategory = rule.categorySlabs?.[category];
  return Array.isArray(byCategory) && byCategory.length
    ? byCategory
    : rule.slabs || [];
}

// --- Computation ------------------------------------------------------------

/**
 * @param {number} value
 * @returns {number}
 */
function round0(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * The liability for one month in a monthly state.
 *
 * The special month is applied **after** the slab is found rather than as a
 * thirteenth band: it replaces the amount for that month only, and only for
 * employees the ordinary slab charges at all. An employee below the threshold
 * pays nothing in February either.
 *
 * @param {object} input
 * @param {object} input.rule
 * @param {{year: number, month: number}} input.period
 * @param {number} input.salary Salary for the month.
 * @param {string} [input.category]
 * @param {Array<string>} [input.exemptions]
 * @returns {{amount: number, slab: object|null, specialMonth: boolean, exempt: boolean}}
 */
function monthlyLiability({ rule, period, salary, category, exemptions = [] }) {
  if (!rule || rule.periodicity !== PERIODICITY.MONTHLY) {
    return { amount: 0, slab: null, specialMonth: false, exempt: false };
  }

  if (exemptions.length > 0) {
    return { amount: 0, slab: null, specialMonth: false, exempt: true };
  }

  const slab = slabFor(salary, slabsFor(rule, category));
  if (!slab) {
    return { amount: 0, slab: null, specialMonth: false, exempt: false };
  }

  const isSpecial =
    rule.specialMonth &&
    Number(rule.specialMonth.month) === Number(period.month) &&
    slab.amount > 0;

  return {
    amount: round0(isSpecial ? rule.specialMonth.amount : slab.amount),
    slab,
    specialMonth: Boolean(isSpecial),
    exempt: false,
  };
}

/**
 * The liability for a half-year in a half-yearly state.
 *
 * The slab is on the **aggregate** of the six months, which is the whole reason
 * this function is not `monthlyLiability` times six. An employee who earns
 * ₹90,000 in one month of a Tamil Nadu half-year and nothing in the other five
 * has the same half-yearly liability as one who earned ₹15,000 a month, and a
 * monthly engine gives them different answers.
 *
 * @param {object} input
 * @param {object} input.rule
 * @param {number} input.aggregateSalary
 * @param {string} [input.category]
 * @param {Array<string>} [input.exemptions]
 * @returns {{amount: number, slab: object|null, exempt: boolean}}
 */
function halfYearlyLiability({
  rule,
  aggregateSalary,
  category,
  exemptions = [],
}) {
  if (!rule || rule.periodicity !== PERIODICITY.HALF_YEARLY) {
    return { amount: 0, slab: null, exempt: false };
  }

  if (exemptions.length > 0) {
    return { amount: 0, slab: null, exempt: true };
  }

  const slab = slabFor(aggregateSalary, slabsFor(rule, category));
  return {
    amount: slab ? round0(slab.amount) : 0,
    slab,
    exempt: false,
  };
}

/**
 * Spread a half-yearly liability across the months it covers.
 *
 * Needed because payroll deducts monthly even where the levy is half-yearly,
 * and the payslip has to show something. The attribution is even with the
 * remainder on the **last** month of the half-year rather than the first: an
 * employee who leaves mid-half-year should not have been charged the rounding
 * up front for a period they did not complete.
 *
 * The result says it is an attribution. Nothing downstream should mistake a
 * sixth of a half-yearly liability for a monthly one.
 *
 * @param {number} amount
 * @param {Array<{year: number, month: number}>} months
 * @returns {Array<{year: number, month: number, amount: number, attributed: true}>}
 */
function attributeHalfYearly(amount, months) {
  const total = round0(amount);
  const count = months.length || 1;
  const base = Math.floor(total / count);
  const remainder = total - base * count;

  return months.map((month, index) => ({
    ...month,
    amount: index === count - 1 ? base + remainder : base,
    attributed: true,
  }));
}

/**
 * Cap a year's accrual at the Article 276 ceiling.
 *
 * Applied on the total for the year across every state the employee worked in,
 * because the ceiling is on the person and not on the state. Somebody who moves
 * from Maharashtra to West Bengal mid-year does not owe ₹2,500 twice, and this
 * is the only place that can see both halves.
 *
 * @param {number} accrued
 * @param {number} [ceiling]
 * @returns {{amount: number, capped: boolean, cappedFrom: number|null}}
 */
function applyAnnualCeiling(accrued, ceiling = ANNUAL_CEILING) {
  const amount = round0(accrued);
  if (amount <= ceiling) {
    return { amount, capped: false, cappedFrom: null };
  }
  return { amount: ceiling, capped: true, cappedFrom: amount };
}

/**
 * What section 16(iii) allows.
 *
 * Deliberately reads the payments and not the accruals. The section allows
 * professional tax **actually paid** in the previous year as a deduction from
 * salary income, so an amount deducted from an employee in March and remitted
 * in April belongs to the following year's deduction. Feeding the accrual into
 * the salary computation would understate taxable income and therefore
 * understate TDS, and the error would surface in Form 24Q rather than here.
 *
 * @param {Array<{paidOn: Date|string, amount: number}>} payments
 * @param {{from: Date|string, to: Date|string}} window
 * @returns {{amount: number, lines: Array<object>}}
 */
function section16iiiDeduction(payments, window) {
  const from = toUtcDate(window?.from);
  const to = toUtcDate(window?.to);

  const lines = (payments || [])
    .map((payment) => ({
      paidOn: toUtcDate(payment?.paidOn),
      amount: Math.max(0, Number(payment?.amount) || 0),
    }))
    .filter((payment) => {
      if (!payment.paidOn || payment.amount === 0) return false;
      if (from && payment.paidOn.getTime() < from.getTime()) return false;
      if (to && payment.paidOn.getTime() > to.getTime()) return false;
      return true;
    });

  return {
    amount: round0(lines.reduce((total, line) => total + line.amount, 0)),
    lines,
  };
}

/**
 * The employer's own liability under the enrolment certificate.
 *
 * Not a deduction from anybody. It is the company's tax on the trade or
 * profession it carries on, it is annual, and it is owed whether or not a
 * single employee crosses a slab. Kept as its own function so that no caller
 * can accidentally add it to the amount deducted from employees — the two are
 * remitted under different certificates with different returns.
 *
 * @param {object} input
 * @param {object} input.rule
 * @param {number} input.annualAmount The state's notified enrolment amount.
 * @param {boolean} [input.enrolled]
 * @returns {{amount: number, certificate: string, enrolled: boolean}}
 */
function enrolmentLiability({ rule, annualAmount, enrolled = false }) {
  if (!rule || rule.periodicity === PERIODICITY.NOT_LEVIED) {
    return { amount: 0, certificate: CERTIFICATE.ENROLMENT, enrolled };
  }

  return {
    amount: round0(Math.min(Number(annualAmount) || 0, ANNUAL_CEILING)),
    certificate: CERTIFICATE.ENROLMENT,
    enrolled: Boolean(enrolled),
  };
}

/**
 * A year of professional tax for one employee, in one work state.
 *
 * @param {object} input
 * @param {object} input.employee
 * @param {number} input.financialYear
 * @param {Array<{year: number, month: number, salary: number}>} input.wageMonths
 * @param {Array<object>} [input.ruleSets]
 * @returns {object}
 */
function computeEmployeeYear({
  employee,
  financialYear,
  wageMonths,
  ruleSets = SEED_RULES,
}) {
  const workState = employee?.workState
    ? String(employee.workState).trim().toUpperCase()
    : '';

  const category = employee?.category || CATEGORY.DEFAULT;
  const exemptions = Array.isArray(employee?.exemptions)
    ? employee.exemptions.filter((code) => EXEMPTION[code])
    : [];

  const months = financialYearMonths(financialYear);
  const salaryByKey = new Map(
    (wageMonths || []).map((row) => [
      `${row.year}-${row.month}`,
      Math.max(0, Number(row.salary) || 0),
    ]),
  );

  const issues = [];

  if (!workState) {
    issues.push({ code: FINDING.WORK_STATE_MISSING });
    return {
      employeeId: employee?.employeeId,
      name: employee?.name,
      workState: '',
      periodicity: null,
      accrued: 0,
      lines: [],
      issues,
    };
  }

  // Resolved as at the start of the year and again per month, because a state
  // can amend mid-year and the earlier months keep the earlier table.
  const openingRule = resolveRule(workState, periodStart(months[0]), ruleSets);

  if (!openingRule) {
    issues.push({ code: FINDING.NO_RULE_FOR_STATE, state: workState });
    return {
      employeeId: employee?.employeeId,
      name: employee?.name,
      workState,
      periodicity: null,
      accrued: 0,
      lines: [],
      issues,
    };
  }

  if (openingRule.periodicity === PERIODICITY.NOT_LEVIED) {
    issues.push({ code: FINDING.NOT_LEVIED_IN_STATE, state: workState });
    return {
      employeeId: employee?.employeeId,
      name: employee?.name,
      workState,
      periodicity: PERIODICITY.NOT_LEVIED,
      accrued: 0,
      lines: [],
      issues,
    };
  }

  if (openingRule.requiresLocalBody && !employee?.localBody) {
    issues.push({ code: FINDING.LOCAL_BODY_NOT_SET, state: workState });
  }

  if (exemptions.length > 0) {
    issues.push({ code: FINDING.PERSON_EXEMPT, exemptions });
  }

  const lines = [];

  if (openingRule.periodicity === PERIODICITY.HALF_YEARLY) {
    const seen = new Set();

    for (const month of months) {
      const half = halfYearOf(month);
      if (seen.has(half.key)) continue;
      seen.add(half.key);

      const aggregate = half.months.reduce(
        (total, row) =>
          total + (salaryByKey.get(`${row.year}-${row.month}`) || 0),
        0,
      );

      const rule =
        resolveRule(workState, periodStart(half.months[0]), ruleSets) ||
        openingRule;

      const liability = halfYearlyLiability({
        rule,
        aggregateSalary: aggregate,
        category,
        exemptions,
      });

      // Only the months inside this financial year are attributed. The second
      // half spills into January-March of the next calendar year, which is
      // still this financial year, so the filter is on membership rather than
      // on the calendar.
      const inYear = half.months.filter((row) =>
        months.some(
          (candidate) =>
            candidate.year === row.year && candidate.month === row.month,
        ),
      );

      const attributed = attributeHalfYearly(liability.amount, inYear);

      for (const row of attributed) {
        lines.push({
          ...row,
          halfYear: half.key,
          aggregateSalary: aggregate,
          slab: liability.slab,
          periodicity: PERIODICITY.HALF_YEARLY,
          exempt: liability.exempt,
        });
      }

      if (liability.amount > 0) {
        issues.push({
          code: FINDING.HALF_YEARLY_ATTRIBUTED,
          halfYear: half.key,
          amount: liability.amount,
          months: inYear.length,
        });
      }
    }
  } else {
    for (const month of months) {
      const rule =
        resolveRule(workState, periodStart(month), ruleSets) || openingRule;
      const salary = salaryByKey.get(`${month.year}-${month.month}`) || 0;

      const liability = monthlyLiability({
        rule,
        period: month,
        salary,
        category,
        exemptions,
      });

      lines.push({
        ...month,
        amount: liability.amount,
        salary,
        slab: liability.slab,
        specialMonth: liability.specialMonth,
        periodicity: PERIODICITY.MONTHLY,
        exempt: liability.exempt,
        attributed: false,
      });
    }
  }

  const accruedBeforeCeiling = lines.reduce(
    (total, line) => total + line.amount,
    0,
  );
  const ceiling = applyAnnualCeiling(accruedBeforeCeiling);

  if (ceiling.capped) {
    issues.push({
      code: FINDING.ANNUAL_CEILING_APPLIED,
      from: ceiling.cappedFrom,
      to: ceiling.amount,
    });
  }

  return {
    employeeId: employee?.employeeId,
    name: employee?.name,
    workState,
    localBody: employee?.localBody || '',
    category,
    exemptions,
    periodicity: openingRule.periodicity,
    levyLevel: openingRule.levyLevel,
    accrued: ceiling.amount,
    accruedBeforeCeiling: round0(accruedBeforeCeiling),
    ceilingApplied: ceiling.capped,
    lines,
    issues,
  };
}

/**
 * @param {Array<object>} findings
 * @param {string} code
 * @param {object} detail
 */
function addFinding(findings, code, detail) {
  findings.push({
    code,
    authority: FINDING_AUTHORITY[code],
    severity: FINDING_SEVERITY[code],
    ...detail,
  });
}

/**
 * Assess an establishment for a financial year.
 *
 * Returns **one remittance per registration certificate**, keyed by work state,
 * and no single total across them. A company in Mumbai with an office in
 * Bengaluru remits to two authorities under two certificates on two schedules,
 * and a combined figure is not a number anyone can pay.
 *
 * @param {object} input
 * @param {Array<object>} input.employees
 * @param {number} input.financialYear
 * @param {Array<object>} [input.ruleSets]
 * @param {Array<object>} [input.enrolments]
 * @param {Array<object>} [input.payments]
 * @returns {object}
 */
function assessEstablishment({
  employees,
  financialYear,
  ruleSets = SEED_RULES,
  enrolments = [],
  payments = [],
} = {}) {
  const findings = [];

  const assessed = (employees || []).map((entry) =>
    computeEmployeeYear({
      employee: entry.employee || entry,
      financialYear,
      wageMonths: entry.wageMonths || [],
      ruleSets,
    }),
  );

  for (const row of assessed) {
    for (const issue of row.issues) {
      addFinding(findings, issue.code, {
        employeeId: row.employeeId,
        name: row.name,
        state: row.workState,
        ...issue,
      });
    }
  }

  // Grouped by state, because that is the certificate the money is remitted
  // under. Never summed across them — see the note on the function.
  const byState = new Map();
  for (const row of assessed) {
    if (!row.workState || row.periodicity === PERIODICITY.NOT_LEVIED) continue;

    const bucket = byState.get(row.workState) || {
      state: row.workState,
      periodicity: row.periodicity,
      levyLevel: row.levyLevel,
      employeeCount: 0,
      deductedFromEmployees: 0,
    };

    bucket.employeeCount += 1;
    bucket.deductedFromEmployees += row.accrued;
    byState.set(row.workState, bucket);
  }

  const enrolmentByState = new Map(
    (enrolments || []).map((row) => [String(row.state).toUpperCase(), row]),
  );

  const registrations = [...byState.values()].map((bucket) => {
    const enrolment = enrolmentByState.get(bucket.state);
    const rule = resolveRule(
      bucket.state,
      periodStart({ year: financialYear, month: 4 }),
      ruleSets,
    );

    const employerOwn = enrolmentLiability({
      rule,
      annualAmount: enrolment?.annualAmount,
      enrolled: enrolment?.enrolled,
    });

    if (!enrolment?.enrolled) {
      addFinding(findings, FINDING.ENROLMENT_NOT_RECORDED, {
        state: bucket.state,
        note: 'The employer holds no recorded enrolment certificate for this state. The enrolment liability is the company’s own tax on the trade it carries on and is owed whether or not any employee crosses a slab.',
      });
    }

    return {
      ...bucket,
      deductedFromEmployees: round0(bucket.deductedFromEmployees),
      /**
       * The employer's own annual liability, under a different certificate.
       * Kept beside the deduction and deliberately not added to it.
       */
      employerEnrolmentLiability: employerOwn.amount,
      enrolled: employerOwn.enrolled,
    };
  });

  const remitted = section16iiiDeduction(payments, {
    from: new Date(Date.UTC(financialYear, 3, 1)),
    to: new Date(Date.UTC(financialYear + 1, 2, 31)),
  });

  const accrued = assessed.reduce((total, row) => total + row.accrued, 0);

  if (accrued > remitted.amount) {
    addFinding(findings, FINDING.DEDUCTED_NOT_REMITTED, {
      accrued: round0(accrued),
      paid: remitted.amount,
      amount: round0(accrued - remitted.amount),
      note: 'Section 16(iii) allows professional tax actually paid. The difference is not allowable to the employee this year, whatever was deducted from them.',
    });
  }

  const summary = new Map();
  for (const finding of findings) {
    const bucket = summary.get(finding.code) || {
      code: finding.code,
      authority: finding.authority,
      severity: finding.severity,
      count: 0,
    };
    bucket.count += 1;
    summary.set(finding.code, bucket);
  }

  return {
    financialYear,
    employees: assessed,

    /** One per registration certificate. There is no total across them. */
    registrations,

    /** What was deducted from employees over the year, before remittance. */
    accrued: round0(accrued),

    /**
     * What was actually paid, in the shape section 16(iii) wants.
     * Not the same number as `accrued`, and the difference is not allowable.
     */
    paidForSection16iii: remitted.amount,

    findings,
    summary: [...summary.values()],
  };
}

module.exports = {
  ANNUAL_CEILING,
  PERIODICITY,
  LEVY_LEVEL,
  CERTIFICATE,
  EXEMPTION,
  CATEGORY,
  FINDING,
  FINDING_AUTHORITY,
  FINDING_SEVERITY,
  SEVERITY,
  SEED_RULES,
  toUtcDate,
  periodStart,
  financialYearMonths,
  halfYearOf,
  resolveRule,
  slabFor,
  slabsFor,
  monthlyLiability,
  halfYearlyLiability,
  attributeHalfYearly,
  applyAnnualCeiling,
  section16iiiDeduction,
  enrolmentLiability,
  computeEmployeeYear,
  assessEstablishment,
};
