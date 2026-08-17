/**
 * Salary structure resolution (#461).
 *
 * Pure functions — no database access — so component resolution, proration and
 * diffing can be unit-tested in isolation, matching how `salaryCalculator.js`
 * is written.
 *
 * The problem being solved: `monthlySalary` is a single mutable number that
 * `updateEmployee` overwrites in place. There is no effective date, so a raise
 * effective the 16th cannot be expressed; no breakdown, so a payslip cannot
 * show earnings; and no history, so a payroll run sitting in `PENDING_APPROVAL`
 * can have its basis changed underneath the approver with nothing recording it.
 */

const {
  COMPONENT_TYPE,
  CALCULATION,
  REVISION_REASON,
  ALL_REVISION_REASONS,
  COMPONENT_CODE,
  DEFAULT_STRUCTURE_TEMPLATE,
  MAX_COMPONENTS,
  MAX_COMPONENT_CODE_LENGTH,
  MAX_COMPONENT_LABEL_LENGTH,
} = require('../config/salaryComponents');

/**
 * Round to paise. #347 already showed what an unrounded sum does to a payroll
 * total; a component breakdown multiplies the opportunities for drift.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Days in a month — the real number, not 30.
 *
 * #310 fixed a hard-coded `/30` divisor in the salary calculator. Proration
 * must not reintroduce it: a raise effective the 16th of February is 13/28,
 * not 15/30.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Validate a component list.
 *
 * Returns errors rather than throwing, so a controller can report every problem
 * at once instead of the first.
 *
 * @param {*} components
 * @returns {{ok: boolean, components: object[], errors: string[]}}
 */
function validateComponents(components) {
  const errors = [];

  if (!Array.isArray(components) || components.length === 0) {
    return {
      ok: false,
      components: [],
      errors: ['At least one salary component is required'],
    };
  }

  if (components.length > MAX_COMPONENTS) {
    return {
      ok: false,
      components: [],
      errors: [`A structure cannot have more than ${MAX_COMPONENTS} components`],
    };
  }

  const seen = new Set();
  const cleaned = [];

  components.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      errors.push(`Component at index ${index} is not an object`);
      return;
    }

    const code =
      typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';

    if (!code) {
      errors.push(`Component at index ${index} is missing a code`);
      return;
    }

    if (code.length > MAX_COMPONENT_CODE_LENGTH) {
      errors.push(`Component code "${code}" exceeds ${MAX_COMPONENT_CODE_LENGTH} characters`);
      return;
    }

    if (seen.has(code)) {
      // Duplicates would make the resolved total depend on iteration order.
      errors.push(`Duplicate component code: ${code}`);
      return;
    }

    const type = Object.values(COMPONENT_TYPE).includes(raw.type)
      ? raw.type
      : COMPONENT_TYPE.EARNING;

    const calculation = Object.values(CALCULATION).includes(raw.calculation)
      ? raw.calculation
      : CALCULATION.FIXED;

    // `Number(null)` is 0 and `Number('')` is 0, so a missing value would
    // silently become a zero-rupee component instead of being rejected. The
    // raw value has to actually be numeric.
    const isNumeric =
      typeof raw.value === 'number' ||
      (typeof raw.value === 'string' && raw.value.trim() !== '');
    const value = isNumeric ? Number(raw.value) : NaN;

    if (!Number.isFinite(value) || value < 0) {
      errors.push(`Component "${code}" must have a non-negative numeric value`);
      return;
    }

    if (
      (calculation === CALCULATION.PERCENT_OF_BASIC ||
        calculation === CALCULATION.PERCENT_OF_GROSS) &&
      value > 100
    ) {
      errors.push(`Component "${code}" cannot be more than 100%`);
      return;
    }

    // BASIC anchors percent_of_basic, so defining it in terms of itself is a
    // cycle. Rejected here, at write time, rather than at payroll time.
    if (code === COMPONENT_CODE.BASIC && calculation === CALCULATION.PERCENT_OF_BASIC) {
      errors.push('BASIC cannot be defined as a percentage of itself');
      return;
    }

    const label =
      typeof raw.label === 'string' && raw.label.trim()
        ? raw.label.trim().slice(0, MAX_COMPONENT_LABEL_LENGTH)
        : code;

    seen.add(code);
    cleaned.push({
      code,
      label,
      type,
      calculation,
      value: round2(value),
      taxable: raw.taxable !== false,
      isResidual: Boolean(raw.isResidual),
    });
  });

  // A structure with more than one residual has no single balancing figure and
  // the split becomes ambiguous.
  const residuals = cleaned.filter((c) => c.isResidual);
  if (residuals.length > 1) {
    errors.push('A structure can have at most one residual component');
  }

  // percent_of_basic needs something to be a percentage of.
  const hasBasic = cleaned.some((c) => c.code === COMPONENT_CODE.BASIC);
  const needsBasic = cleaned.some(
    (c) => c.calculation === CALCULATION.PERCENT_OF_BASIC,
  );
  if (needsBasic && !hasBasic) {
    errors.push(
      'A component is defined as a percentage of BASIC, but no BASIC component exists',
    );
  }

  return { ok: errors.length === 0, components: cleaned, errors };
}

/**
 * Resolve every component to a rupee amount.
 *
 * Evaluation is strictly ordered — fixed, then percent-of-gross, then
 * percent-of-basic — so the result never depends on the order components happen
 * to be stored in. The residual absorbs whatever is left, which both makes the
 * breakdown reconstitute to exactly the gross and gives the migration a way to
 * split an arbitrary existing salary without changing it.
 *
 * @param {object} structure `{ grossMonthly, components }`
 * @returns {{components: object[], totalEarnings: number, totalDeductions: number, netMonthly: number, grossMonthly: number, residualShortfall: number}}
 */
function computeComponentAmounts(structure) {
  const gross = round2(Number(structure?.grossMonthly) || 0);
  const list = Array.isArray(structure?.components) ? structure.components : [];

  const resolved = new Map();

  // Pass 1 — fixed amounts.
  list
    .filter((c) => c.calculation === CALCULATION.FIXED && !c.isResidual)
    .forEach((c) => resolved.set(c.code, round2(c.value)));

  // Pass 2 — percentages of the declared gross (not a running subtotal, which
  // would make the answer order-dependent).
  list
    .filter((c) => c.calculation === CALCULATION.PERCENT_OF_GROSS)
    .forEach((c) => resolved.set(c.code, round2((gross * c.value) / 100)));

  // Pass 3 — percentages of BASIC, now that BASIC is known.
  const basic = resolved.get(COMPONENT_CODE.BASIC) || 0;
  list
    .filter((c) => c.calculation === CALCULATION.PERCENT_OF_BASIC)
    .forEach((c) => resolved.set(c.code, round2((basic * c.value) / 100)));

  // Pass 4 — the residual absorbs the remainder.
  const residual = list.find((c) => c.isResidual);
  let residualShortfall = 0;

  if (residual) {
    const allocated = list
      .filter((c) => !c.isResidual && c.type === COMPONENT_TYPE.EARNING)
      .reduce((sum, c) => sum + (resolved.get(c.code) || 0), 0);

    const remainder = round2(gross - allocated);

    // A negative remainder means the named components already exceed the gross.
    // Clamp to zero and surface the overflow rather than emitting a negative
    // earning that would quietly reduce someone's pay.
    resolved.set(residual.code, Math.max(remainder, 0));
    if (remainder < 0) residualShortfall = round2(-remainder);
  }

  const components = list.map((c) => ({
    ...c,
    amount: resolved.get(c.code) || 0,
  }));

  const totalEarnings = round2(
    components
      .filter((c) => c.type === COMPONENT_TYPE.EARNING)
      .reduce((sum, c) => sum + c.amount, 0),
  );

  const totalDeductions = round2(
    components
      .filter((c) => c.type === COMPONENT_TYPE.DEDUCTION)
      .reduce((sum, c) => sum + c.amount, 0),
  );

  return {
    components,
    totalEarnings,
    totalDeductions,
    netMonthly: round2(totalEarnings - totalDeductions),
    grossMonthly: gross,
    residualShortfall,
  };
}

/**
 * Build a structure from a single salary figure using a template.
 *
 * This is what makes the migration non-disruptive: every existing employee gets
 * a defensible Basic/HRA/Special split derived from the number already on their
 * record, and the split always reconstitutes to exactly that number.
 *
 * @param {number} monthlySalary
 * @param {object[]} [template]
 * @returns {{grossMonthly: number, components: object[]}}
 */
function buildDefaultStructure(monthlySalary, template = DEFAULT_STRUCTURE_TEMPLATE) {
  const gross = round2(Number(monthlySalary) || 0);

  const components = (Array.isArray(template) ? template : DEFAULT_STRUCTURE_TEMPLATE).map(
    (c) => ({ ...c }),
  );

  return { grossMonthly: gross, components };
}

/**
 * A calendar date as a sortable YYYYMMDD number, read in UTC.
 *
 * `effectiveFrom` is a calendar date, not an instant. Comparing raw `Date`
 * objects mixes two conventions: an ISO string like "2026-07-01" parses to UTC
 * midnight, while `new Date(2026, 6, 1)` is *local* midnight. In any timezone
 * ahead of UTC the first is later than the second, so a revision effective the
 * 1st compared false against its own month boundary and the month silently
 * resolved to the previous rate.
 *
 * Mongo stores dates as UTC instants and the API receives ISO strings, so UTC
 * is the right convention to normalise on.
 *
 * @param {Date|string} value
 * @returns {number} e.g. 20260701, or NaN
 */
function toDayNumber(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return NaN;

  return (
    date.getUTCFullYear() * 10000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

/**
 * The day-of-month an effective date falls on, read in UTC to match
 * `toDayNumber`.
 *
 * @param {Date|string} value
 * @returns {number}
 */
function effectiveDayOfMonth(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 1 : date.getUTCDate();
}

/**
 * Order revisions oldest-first by effective date.
 *
 * @param {object[]} structures
 * @returns {object[]}
 */
function sortByEffectiveDate(structures) {
  return (Array.isArray(structures) ? [...structures] : []).sort(
    (a, b) => toDayNumber(a.effectiveFrom) - toDayNumber(b.effectiveFrom),
  );
}

/**
 * The revision in force on a given date.
 *
 * @param {object[]} structures
 * @param {Date|string} onDate
 * @returns {object|null}
 */
function resolveStructureOnDate(structures, onDate) {
  const target = toDayNumber(onDate);
  if (Number.isNaN(target)) return null;

  const sorted = sortByEffectiveDate(structures);

  let inForce = null;
  for (const structure of sorted) {
    if (toDayNumber(structure.effectiveFrom) <= target) inForce = structure;
    else break;
  }

  return inForce;
}

/**
 * The revision(s) covering a payroll month, with their day weights.
 *
 * A raise effective mid-month is the case the single mutable field could not
 * express at all: the admin had to apply it a fortnight early or a fortnight
 * late, and for a payroll product both are wrong answers. Here the month is
 * split across the rates actually in force, weighted by the real number of days
 * in that month.
 *
 * @param {object[]} structures
 * @param {number} month 1-12
 * @param {number} year
 * @returns {{segments: Array<{structure: object, days: number, weight: number, fromDay: number, toDay: number}>, totalDays: number, effectiveGross: number}}
 */
function resolveStructureForPeriod(structures, month, year) {
  const totalDays = daysInMonth(year, month);
  const sorted = sortByEffectiveDate(structures);

  if (sorted.length === 0) {
    return { segments: [], totalDays, effectiveGross: 0 };
  }

  // The revision in force on the first of the month, if any. Built in UTC so
  // it compares like-for-like against the stored effective dates.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const opening = resolveStructureOnDate(sorted, monthStart);

  // Revisions that land inside the month, after the 1st.
  const midMonth = sorted.filter((s) => {
    const dayNumber = toDayNumber(s.effectiveFrom);
    if (Number.isNaN(dayNumber)) return false;

    const revisionYear = Math.floor(dayNumber / 10000);
    const revisionMonth = Math.floor((dayNumber % 10000) / 100);

    return (
      revisionYear === year &&
      revisionMonth === month &&
      effectiveDayOfMonth(s.effectiveFrom) > 1
    );
  });

  const boundaries = [];
  if (opening) boundaries.push({ structure: opening, fromDay: 1 });
  midMonth.forEach((s) =>
    boundaries.push({ structure: s, fromDay: effectiveDayOfMonth(s.effectiveFrom) }),
  );

  if (boundaries.length === 0) {
    // Every revision starts after this month — nothing is in force yet.
    return { segments: [], totalDays, effectiveGross: 0 };
  }

  boundaries.sort((a, b) => a.fromDay - b.fromDay);

  const segments = boundaries.map((boundary, index) => {
    const next = boundaries[index + 1];
    const toDay = next ? next.fromDay - 1 : totalDays;
    const days = toDay - boundary.fromDay + 1;

    return {
      structure: boundary.structure,
      fromDay: boundary.fromDay,
      toDay,
      days,
      weight: round2(days / totalDays),
    };
  });

  const effectiveGross = round2(
    segments.reduce(
      (sum, seg) =>
        sum + (Number(seg.structure.grossMonthly) || 0) * (seg.days / totalDays),
      0,
    ),
  );

  return { segments, totalDays, effectiveGross };
}

/**
 * Prorate a gross figure for a partial month.
 *
 * @param {number} grossMonthly
 * @param {number} daysWorked
 * @param {number} totalDays
 * @returns {number}
 */
function prorate(grossMonthly, daysWorked, totalDays) {
  const gross = Number(grossMonthly) || 0;
  const worked = Number(daysWorked);
  const total = Number(totalDays);

  if (!Number.isFinite(worked) || worked <= 0) return 0;
  if (!Number.isFinite(total) || total <= 0) return 0;

  if (worked >= total) return round2(gross);

  return round2((gross * worked) / total);
}

/**
 * Component-level delta between two revisions.
 *
 * `EMPLOYEE_UPDATE` audit entries record only `Object.keys(req.body)` — the
 * field *names* that changed, not the values. A salary change therefore left no
 * trace of what it changed from. This produces the before/after that was
 * missing.
 *
 * @param {object|null} previous
 * @param {object} next
 * @returns {{grossFrom: number, grossTo: number, grossDelta: number, percentChange: number, components: object[]}}
 */
function diffStructures(previous, next) {
  const before = computeComponentAmounts(previous || { grossMonthly: 0, components: [] });
  const after = computeComponentAmounts(next || { grossMonthly: 0, components: [] });

  const beforeByCode = new Map(before.components.map((c) => [c.code, c]));
  const afterByCode = new Map(after.components.map((c) => [c.code, c]));

  const codes = [...new Set([...beforeByCode.keys(), ...afterByCode.keys()])];

  const components = codes.map((code) => {
    const from = beforeByCode.get(code);
    const to = afterByCode.get(code);

    let change = 'unchanged';
    if (!from) change = 'added';
    else if (!to) change = 'removed';
    else if (from.amount !== to.amount) change = 'changed';

    return {
      code,
      label: (to || from).label,
      fromAmount: from ? from.amount : 0,
      toAmount: to ? to.amount : 0,
      delta: round2((to ? to.amount : 0) - (from ? from.amount : 0)),
      change,
    };
  });

  const grossFrom = before.grossMonthly;
  const grossTo = after.grossMonthly;
  const grossDelta = round2(grossTo - grossFrom);

  return {
    grossFrom,
    grossTo,
    grossDelta,
    percentChange: grossFrom > 0 ? round2((grossDelta / grossFrom) * 100) : 0,
    components,
  };
}

/**
 * Validate a whole revision.
 *
 * @param {object} revision
 * @returns {{ok: boolean, value: object, errors: string[]}}
 */
function validateRevision(revision = {}) {
  const errors = [];

  const gross = Number(revision.grossMonthly);
  if (!Number.isFinite(gross) || gross <= 0) {
    errors.push('Gross monthly salary must be a positive number');
  }

  const effectiveFrom = new Date(revision.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) {
    errors.push('effectiveFrom must be a valid date');
  }

  const reason = ALL_REVISION_REASONS.includes(revision.reason)
    ? revision.reason
    : REVISION_REASON.REVISION;

  const componentCheck = validateComponents(revision.components);
  errors.push(...componentCheck.errors);

  if (errors.length > 0) {
    return { ok: false, value: {}, errors };
  }

  const resolved = computeComponentAmounts({
    grossMonthly: gross,
    components: componentCheck.components,
  });

  // The named components already exceed the declared gross, so the residual
  // would have to be negative. Reject rather than silently clamping, which
  // would store a breakdown that does not add up to the salary.
  if (resolved.residualShortfall > 0) {
    errors.push(
      `Components exceed the gross salary by ${resolved.residualShortfall}`,
    );
    return { ok: false, value: {}, errors };
  }

  return {
    ok: true,
    value: {
      grossMonthly: round2(gross),
      components: componentCheck.components,
      effectiveFrom,
      reason,
      ctcAnnual: round2(gross * 12),
    },
    errors: [],
  };
}

module.exports = {
  round2,
  daysInMonth,
  toDayNumber,
  effectiveDayOfMonth,
  validateComponents,
  computeComponentAmounts,
  buildDefaultStructure,
  sortByEffectiveDate,
  resolveStructureOnDate,
  resolveStructureForPeriod,
  prorate,
  diffStructures,
  validateRevision,
};
