const {
  daysInMonth,
  validateComponents,
  computeComponentAmounts,
  buildDefaultStructure,
  sortByEffectiveDate,
  resolveStructureOnDate,
  resolveStructureForPeriod,
  prorate,
  diffStructures,
  validateRevision,
} = require('../salaryStructure');
const {
  COMPONENT_TYPE,
  CALCULATION,
  COMPONENT_CODE,
  REVISION_REASON,
} = require('../../config/salaryComponents');

const component = (code, calculation, value, extra = {}) => ({
  code,
  label: code,
  type: COMPONENT_TYPE.EARNING,
  calculation,
  value,
  taxable: true,
  ...extra,
});

const revision = (effectiveFrom, grossMonthly) => ({
  effectiveFrom: new Date(effectiveFrom),
  grossMonthly,
  ...buildDefaultStructure(grossMonthly),
});

describe('salaryStructure — daysInMonth (#461)', () => {
  test('uses the real month length, not a fixed 30', () => {
    // #310 fixed a hard-coded /30 divisor; proration must not reintroduce it.
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 7)).toBe(31);
  });
});

describe('salaryStructure — validateComponents', () => {
  test('accepts a well-formed list', () => {
    const result = validateComponents([
      component(COMPONENT_CODE.BASIC, CALCULATION.PERCENT_OF_GROSS, 50),
      component(COMPONENT_CODE.HRA, CALCULATION.PERCENT_OF_BASIC, 40),
    ]);

    expect(result.ok).toBe(true);
    expect(result.components).toHaveLength(2);
  });

  test('rejects an empty list', () => {
    [[], null, undefined, 'x'].forEach((value) => {
      expect(validateComponents(value).ok).toBe(false);
    });
  });

  test('rejects duplicate codes — they would make the total order-dependent', () => {
    const result = validateComponents([
      component('BASIC', CALCULATION.FIXED, 100),
      component('basic', CALCULATION.FIXED, 200),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Duplicate');
  });

  test('rejects a component with no code', () => {
    expect(validateComponents([{ value: 100 }]).ok).toBe(false);
  });

  test('rejects a negative or non-numeric value', () => {
    [-100, NaN, 'abc', null].forEach((value) => {
      expect(validateComponents([component('X', CALCULATION.FIXED, value)]).ok).toBe(
        false,
      );
    });
  });

  test('rejects a percentage over 100', () => {
    expect(
      validateComponents([component('X', CALCULATION.PERCENT_OF_GROSS, 150)]).ok,
    ).toBe(false);
  });

  test('rejects BASIC defined as a percentage of itself', () => {
    // A cycle, caught at write time rather than at payroll time.
    const result = validateComponents([
      component(COMPONENT_CODE.BASIC, CALCULATION.PERCENT_OF_BASIC, 50),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('percentage of itself');
  });

  test('rejects percent_of_basic when no BASIC exists', () => {
    const result = validateComponents([
      component('HRA', CALCULATION.PERCENT_OF_BASIC, 40),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('no BASIC component');
  });

  test('rejects more than one residual — the split would be ambiguous', () => {
    const result = validateComponents([
      component('A', CALCULATION.FIXED, 0, { isResidual: true }),
      component('B', CALCULATION.FIXED, 0, { isResidual: true }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('at most one residual'))).toBe(true);
  });

  test('normalises codes to upper case and defaults the label', () => {
    const result = validateComponents([
      { code: '  hra  ', calculation: CALCULATION.FIXED, value: 100 },
    ]);

    expect(result.components[0].code).toBe('HRA');
    expect(result.components[0].label).toBe('HRA');
  });

  test('collects every error, not just the first', () => {
    const result = validateComponents([
      { code: '', value: 1 },
      component('X', CALCULATION.FIXED, -5),
    ]);

    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('salaryStructure — computeComponentAmounts', () => {
  test('resolves the default template so it reconstitutes exactly', () => {
    // Non-negotiable for the migration: the split must add up to the salary.
    [30000, 12345, 999.99, 7777.77].forEach((gross) => {
      const resolved = computeComponentAmounts(buildDefaultStructure(gross));
      expect(resolved.totalEarnings).toBe(Math.round(gross * 100) / 100);
    });
  });

  test('the default template gives 50% basic and 40%-of-basic HRA', () => {
    const resolved = computeComponentAmounts(buildDefaultStructure(30000));
    const byCode = Object.fromEntries(resolved.components.map((c) => [c.code, c.amount]));

    expect(byCode.BASIC).toBe(15000);
    expect(byCode.HRA).toBe(6000);
    expect(byCode.SPECIAL_ALLOWANCE).toBe(9000);
  });

  test('percent_of_gross resolves against the declared gross, not a running subtotal', () => {
    // Otherwise the answer depends on the order components happen to be stored.
    const structure = {
      grossMonthly: 10000,
      components: [
        component('A', CALCULATION.PERCENT_OF_GROSS, 30),
        component('B', CALCULATION.PERCENT_OF_GROSS, 20),
      ],
    };

    const resolved = computeComponentAmounts(structure);
    expect(resolved.components.map((c) => c.amount)).toEqual([3000, 2000]);
  });

  test('component order does not change the result', () => {
    const forward = {
      grossMonthly: 20000,
      components: [
        component(COMPONENT_CODE.BASIC, CALCULATION.PERCENT_OF_GROSS, 50),
        component('HRA', CALCULATION.PERCENT_OF_BASIC, 40),
      ],
    };
    const reversed = { ...forward, components: [...forward.components].reverse() };

    const a = computeComponentAmounts(forward);
    const b = computeComponentAmounts(reversed);

    expect(a.totalEarnings).toBe(b.totalEarnings);
  });

  test('deductions reduce the net but not the gross', () => {
    const structure = {
      grossMonthly: 10000,
      components: [
        component('BASE', CALCULATION.FIXED, 10000),
        component('PF', CALCULATION.FIXED, 1200, { type: COMPONENT_TYPE.DEDUCTION }),
      ],
    };

    const resolved = computeComponentAmounts(structure);
    expect(resolved.totalEarnings).toBe(10000);
    expect(resolved.totalDeductions).toBe(1200);
    expect(resolved.netMonthly).toBe(8800);
  });

  test('the residual absorbs the remainder', () => {
    const structure = {
      grossMonthly: 10000,
      components: [
        component('BASE', CALCULATION.FIXED, 6000),
        component('BAL', CALCULATION.FIXED, 0, { isResidual: true }),
      ],
    };

    expect(computeComponentAmounts(structure).components[1].amount).toBe(4000);
  });

  test('an over-allocated structure clamps the residual and reports the overflow', () => {
    // A negative earning would quietly reduce someone's pay.
    const structure = {
      grossMonthly: 5000,
      components: [
        component('BASE', CALCULATION.FIXED, 8000),
        component('BAL', CALCULATION.FIXED, 0, { isResidual: true }),
      ],
    };

    const resolved = computeComponentAmounts(structure);
    expect(resolved.components[1].amount).toBe(0);
    expect(resolved.residualShortfall).toBe(3000);
  });

  test('an empty structure resolves to zeroes rather than NaN', () => {
    const resolved = computeComponentAmounts({ grossMonthly: 0, components: [] });
    expect(resolved.totalEarnings).toBe(0);
    expect(resolved.netMonthly).toBe(0);
  });
});

describe('salaryStructure — resolveStructureOnDate', () => {
  const revisions = [
    revision('2026-01-01', 30000),
    revision('2026-06-01', 36000),
    revision('2027-01-01', 42000),
  ];

  test('returns the revision in force on a date', () => {
    expect(resolveStructureOnDate(revisions, '2026-03-15').grossMonthly).toBe(30000);
    expect(resolveStructureOnDate(revisions, '2026-06-01').grossMonthly).toBe(36000);
    expect(resolveStructureOnDate(revisions, '2026-12-31').grossMonthly).toBe(36000);
    expect(resolveStructureOnDate(revisions, '2027-05-01').grossMonthly).toBe(42000);
  });

  test('returns null before the first revision', () => {
    expect(resolveStructureOnDate(revisions, '2025-12-31')).toBeNull();
  });

  test('is not fooled by unsorted input', () => {
    const shuffled = [revisions[2], revisions[0], revisions[1]];
    expect(resolveStructureOnDate(shuffled, '2026-07-01').grossMonthly).toBe(36000);
  });

  test('handles an invalid date and an empty list', () => {
    expect(resolveStructureOnDate(revisions, 'not-a-date')).toBeNull();
    expect(resolveStructureOnDate([], '2026-01-01')).toBeNull();
  });

  test('sortByEffectiveDate does not mutate the input', () => {
    const input = [revisions[2], revisions[0]];
    sortByEffectiveDate(input);
    expect(input[0].grossMonthly).toBe(42000);
  });
});

describe('salaryStructure — resolveStructureForPeriod', () => {
  test('a stable month is a single full-weight segment', () => {
    const period = resolveStructureForPeriod([revision('2026-01-01', 30000)], 3, 2026);

    expect(period.segments).toHaveLength(1);
    expect(period.segments[0].weight).toBe(1);
    expect(period.effectiveGross).toBe(30000);
  });

  test('a mid-month raise splits the month across both rates', () => {
    // The case the single mutable field could not express at all: the admin had
    // to apply it a fortnight early or a fortnight late.
    const period = resolveStructureForPeriod(
      [revision('2026-01-01', 30000), revision('2026-07-16', 60000)],
      7,
      2026,
    );

    expect(period.segments).toHaveLength(2);
    expect(period.segments[0]).toMatchObject({ fromDay: 1, toDay: 15, days: 15 });
    expect(period.segments[1]).toMatchObject({ fromDay: 16, toDay: 31, days: 16 });

    // 30000 * 15/31 + 60000 * 16/31
    expect(period.effectiveGross).toBeCloseTo(45483.87, 1);
  });

  test('proration uses the real month length', () => {
    const period = resolveStructureForPeriod(
      [revision('2026-01-01', 28000), revision('2026-02-15', 56000)],
      2,
      2026,
    );

    expect(period.totalDays).toBe(28);
    expect(period.segments[0].days).toBe(14);
    expect(period.segments[1].days).toBe(14);
    expect(period.effectiveGross).toBe(42000);
  });

  test('a revision effective the 1st is a single segment, not two', () => {
    const period = resolveStructureForPeriod(
      [revision('2026-01-01', 30000), revision('2026-07-01', 40000)],
      7,
      2026,
    );

    expect(period.segments).toHaveLength(1);
    expect(period.effectiveGross).toBe(40000);
  });

  test('a month before any revision has no segments', () => {
    const period = resolveStructureForPeriod([revision('2026-06-01', 30000)], 3, 2026);

    expect(period.segments).toEqual([]);
    expect(period.effectiveGross).toBe(0);
  });

  test('two raises in one month produce three segments', () => {
    const period = resolveStructureForPeriod(
      [
        revision('2026-01-01', 30000),
        revision('2026-07-10', 40000),
        revision('2026-07-20', 50000),
      ],
      7,
      2026,
    );

    expect(period.segments).toHaveLength(3);
    expect(period.segments.map((s) => s.days).reduce((a, b) => a + b, 0)).toBe(31);
  });
});

describe('salaryStructure — prorate', () => {
  test('a full month is the whole salary', () => {
    expect(prorate(30000, 31, 31)).toBe(30000);
    expect(prorate(30000, 40, 31)).toBe(30000);
  });

  test('a partial month is weighted by real days', () => {
    expect(prorate(28000, 14, 28)).toBe(14000);
    expect(prorate(31000, 10, 31)).toBe(10000);
  });

  test('zero or nonsense days pay nothing', () => {
    [0, -5, NaN, null, 'x'].forEach((days) => {
      expect(prorate(30000, days, 31)).toBe(0);
    });
  });

  test('a zero-length month cannot divide by zero', () => {
    expect(prorate(30000, 10, 0)).toBe(0);
  });
});

describe('salaryStructure — diffStructures', () => {
  test('reports the gross delta and percentage change', () => {
    const diff = diffStructures(
      buildDefaultStructure(30000),
      buildDefaultStructure(36000),
    );

    expect(diff.grossFrom).toBe(30000);
    expect(diff.grossTo).toBe(36000);
    expect(diff.grossDelta).toBe(6000);
    expect(diff.percentChange).toBe(20);
  });

  test('reports per-component movement', () => {
    const diff = diffStructures(
      buildDefaultStructure(30000),
      buildDefaultStructure(36000),
    );

    const basic = diff.components.find((c) => c.code === COMPONENT_CODE.BASIC);
    expect(basic.fromAmount).toBe(15000);
    expect(basic.toAmount).toBe(18000);
    expect(basic.change).toBe('changed');
  });

  test('marks added and removed components', () => {
    const before = {
      grossMonthly: 10000,
      components: [component('A', CALCULATION.FIXED, 10000)],
    };
    const after = {
      grossMonthly: 10000,
      components: [component('B', CALCULATION.FIXED, 10000)],
    };

    const diff = diffStructures(before, after);
    expect(diff.components.find((c) => c.code === 'A').change).toBe('removed');
    expect(diff.components.find((c) => c.code === 'B').change).toBe('added');
  });

  test('an initial revision (no previous) diffs against zero', () => {
    const diff = diffStructures(null, buildDefaultStructure(30000));

    expect(diff.grossFrom).toBe(0);
    expect(diff.grossDelta).toBe(30000);
    // No division by zero when there is nothing to compare against.
    expect(diff.percentChange).toBe(0);
  });

  test('an unchanged structure reports no movement', () => {
    const diff = diffStructures(
      buildDefaultStructure(30000),
      buildDefaultStructure(30000),
    );

    expect(diff.grossDelta).toBe(0);
    diff.components.forEach((c) => expect(c.change).toBe('unchanged'));
  });
});

describe('salaryStructure — validateRevision', () => {
  const valid = {
    grossMonthly: 30000,
    components: buildDefaultStructure(30000).components,
    effectiveFrom: '2026-07-01',
    reason: REVISION_REASON.REVISION,
  };

  test('accepts a well-formed revision and derives the annual CTC', () => {
    const result = validateRevision(valid);

    expect(result.ok).toBe(true);
    expect(result.value.ctcAnnual).toBe(360000);
    expect(result.value.effectiveFrom).toBeInstanceOf(Date);
  });

  test('rejects a non-positive gross', () => {
    [0, -1, NaN, 'x', null].forEach((grossMonthly) => {
      expect(validateRevision({ ...valid, grossMonthly }).ok).toBe(false);
    });
  });

  test('rejects an invalid effective date', () => {
    expect(validateRevision({ ...valid, effectiveFrom: 'nonsense' }).ok).toBe(false);
  });

  test('defaults an unknown reason rather than erroring', () => {
    const result = validateRevision({ ...valid, reason: 'because' });
    expect(result.value.reason).toBe(REVISION_REASON.REVISION);
  });

  test('rejects a structure whose components exceed the gross', () => {
    // Storing a breakdown that does not add up to the salary would be worse
    // than rejecting the write.
    const result = validateRevision({
      ...valid,
      grossMonthly: 5000,
      components: [
        component('BASE', CALCULATION.FIXED, 8000),
        component('BAL', CALCULATION.FIXED, 0, { isResidual: true }),
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('exceed the gross');
  });

  test('propagates component-level errors', () => {
    const result = validateRevision({ ...valid, components: [{ code: '' }] });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
