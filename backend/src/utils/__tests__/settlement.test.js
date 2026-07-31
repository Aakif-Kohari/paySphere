const {
  daysInMonth,
  workingDaysUpTo,
  computeProratedSalary,
  computeLeaveEncashment,
  computeServiceYears,
  computeGratuity,
  computeNoticeShortfall,
  buildSettlement,
  validateSettlement,
} = require('../settlement');
const { GRATUITY, PRORATION_BASIS } = require('../../config/employment');

describe('settlement — daysInMonth (#462)', () => {
  test('uses the real month length, not a fixed 30', () => {
    // #310 fixed a hard-coded /30 divisor. A settlement that reintroduced it
    // would overpay every February leaver.
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 7)).toBe(31);
  });
});

describe('settlement — computeProratedSalary', () => {
  test('pays the worked fraction of the final month', () => {
    // The figure the isActive toggle could not produce: flipping it early paid
    // nothing, flipping it late paid the full month.
    const result = computeProratedSalary(31000, '2026-07-18');

    expect(result.daysWorked).toBe(18);
    expect(result.daysInMonth).toBe(31);
    expect(result.amount).toBe(18000);
  });

  test('uses the real February length', () => {
    const result = computeProratedSalary(28000, '2026-02-14');

    expect(result.daysInMonth).toBe(28);
    expect(result.amount).toBe(14000);
  });

  test('a last day on the final date of the month pays in full', () => {
    expect(computeProratedSalary(30000, '2026-04-30').amount).toBe(30000);
    expect(computeProratedSalary(31000, '2026-07-31').amount).toBe(31000);
  });

  test('a last day on the 1st pays a single day', () => {
    const result = computeProratedSalary(31000, '2026-07-01');
    expect(result.daysWorked).toBe(1);
    expect(result.amount).toBe(1000);
  });

  test('a working-day basis excludes weekly offs', () => {
    const calendar = computeProratedSalary(30000, '2026-07-15', {
      basis: PRORATION_BASIS.CALENDAR,
    });
    const working = computeProratedSalary(30000, '2026-07-15', {
      basis: PRORATION_BASIS.WORKING,
      weeklyOffDays: [0],
    });

    expect(working.basis).toBe(PRORATION_BASIS.WORKING);
    expect(working.daysInMonth).toBeLessThan(calendar.daysInMonth);
  });

  test('degrades to zero on missing inputs rather than NaN', () => {
    [
      [0, '2026-07-18'],
      [-100, '2026-07-18'],
      [30000, null],
      [30000, 'not-a-date'],
      [NaN, '2026-07-18'],
    ].forEach(([salary, date]) => {
      expect(computeProratedSalary(salary, date).amount).toBe(0);
    });
  });

  test('explains how the figure was reached', () => {
    const result = computeProratedSalary(31000, '2026-07-18');
    expect(result.explanation).toContain('18 of 31');
  });
});

describe('settlement — computeLeaveEncashment', () => {
  test('encashes unused leave at the 26-day working rate', () => {
    const result = computeLeaveEncashment({
      unusedLeaveDays: 10,
      monthlySalary: 26000,
      capDays: 15,
    });

    expect(result.dailyRate).toBe(1000);
    expect(result.encashableDays).toBe(10);
    expect(result.amount).toBe(10000);
    expect(result.capApplied).toBe(false);
  });

  test('applies the policy cap and says so', () => {
    const result = computeLeaveEncashment({
      unusedLeaveDays: 40,
      monthlySalary: 26000,
      capDays: 15,
    });

    expect(result.encashableDays).toBe(15);
    expect(result.amount).toBe(15000);
    expect(result.capApplied).toBe(true);
    expect(result.explanation).toContain('capped');
  });

  test('a zero cap disables encashment entirely', () => {
    const result = computeLeaveEncashment({
      unusedLeaveDays: 10,
      monthlySalary: 26000,
      capDays: 0,
    });

    expect(result.amount).toBe(0);
    expect(result.explanation).toContain('disabled');
  });

  test('handles a half day of unused leave', () => {
    const result = computeLeaveEncashment({
      unusedLeaveDays: 2.5,
      monthlySalary: 26000,
      capDays: 15,
    });

    expect(result.amount).toBe(2500);
  });

  test('nothing to encash pays nothing', () => {
    [0, -3, NaN, null, undefined].forEach((unusedLeaveDays) => {
      expect(
        computeLeaveEncashment({ unusedLeaveDays, monthlySalary: 26000 }).amount,
      ).toBe(0);
    });
  });

  test('an explicit daily rate overrides the derived one', () => {
    const result = computeLeaveEncashment({
      unusedLeaveDays: 5,
      monthlySalary: 26000,
      dailyRate: 2000,
      capDays: 15,
    });

    expect(result.amount).toBe(10000);
  });
});

describe('settlement — computeServiceYears', () => {
  test('counts completed years', () => {
    expect(computeServiceYears('2020-01-01', '2026-01-01').years).toBe(6);
    expect(computeServiceYears('2020-01-01', '2025-12-31').years).toBe(6); // 5y11m -> rounds up
  });

  test('rounds a part-year of 6 months or more up', () => {
    // The statutory rule: ≥6 months counts as a full year.
    expect(computeServiceYears('2020-01-01', '2025-07-01').years).toBe(6); // 5y6m
    expect(computeServiceYears('2020-01-01', '2025-06-30').years).toBe(5); // 5y5m
  });

  test('does not count the final month until the day is reached', () => {
    const before = computeServiceYears('2020-03-15', '2026-03-14');
    const on = computeServiceYears('2020-03-15', '2026-03-15');

    expect(before.rawMonths).toBe(71);
    expect(on.rawMonths).toBe(72);
  });

  test('handles a last day before the joining date', () => {
    expect(computeServiceYears('2026-01-01', '2020-01-01').years).toBe(0);
  });

  test('handles missing dates', () => {
    expect(computeServiceYears(null, '2026-01-01').years).toBe(0);
    expect(computeServiceYears('2020-01-01', 'nonsense').years).toBe(0);
  });
});

describe('settlement — computeGratuity', () => {
  test('pays (wages × 15 × years) / 26 for an eligible employee', () => {
    const result = computeGratuity({
      joiningDate: '2018-01-01',
      lastWorkingDay: '2026-01-01',
      lastDrawnBasic: 26000,
    });

    expect(result.eligible).toBe(true);
    expect(result.years).toBe(8);
    // 26000 * 15 * 8 / 26 = 120000
    expect(result.amount).toBe(120000);
  });

  test('is not payable below five completed years', () => {
    const result = computeGratuity({
      joiningDate: '2022-01-01',
      lastWorkingDay: '2026-01-01',
      lastDrawnBasic: 26000,
    });

    expect(result.eligible).toBe(false);
    expect(result.amount).toBe(0);
    expect(result.explanation).toContain('4 completed year');
  });

  test('the five-year gate applies to actual service, not rounded service', () => {
    // 4y7m rounds to 5 for the formula, but five years have not been completed,
    // so no gratuity is due at all.
    const result = computeGratuity({
      joiningDate: '2021-06-01',
      lastWorkingDay: '2026-01-01',
      lastDrawnBasic: 26000,
    });

    expect(result.eligible).toBe(false);
    expect(result.amount).toBe(0);
  });

  test('exactly five years is eligible', () => {
    const result = computeGratuity({
      joiningDate: '2021-01-01',
      lastWorkingDay: '2026-01-01',
      lastDrawnBasic: 26000,
    });

    expect(result.eligible).toBe(true);
    expect(result.years).toBe(5);
  });

  test('applies the statutory ceiling', () => {
    const result = computeGratuity({
      joiningDate: '1990-01-01',
      lastWorkingDay: '2026-01-01',
      lastDrawnBasic: 500000,
    });

    expect(result.amount).toBe(GRATUITY.CEILING);
    expect(result.ceilingApplied).toBe(true);
  });

  test('can be disabled by policy', () => {
    const result = computeGratuity({
      joiningDate: '2010-01-01',
      lastWorkingDay: '2026-01-01',
      lastDrawnBasic: 26000,
      enabled: false,
    });

    expect(result.amount).toBe(0);
    expect(result.explanation).toContain('disabled');
  });

  test('is not payable when wages cannot be determined', () => {
    expect(
      computeGratuity({
        joiningDate: '2010-01-01',
        lastWorkingDay: '2026-01-01',
        lastDrawnBasic: 0,
      }).amount,
    ).toBe(0);
  });
});

describe('settlement — computeNoticeShortfall', () => {
  test('recovers the unserved days', () => {
    const result = computeNoticeShortfall({
      noticePeriodDays: 30,
      noticeServedDays: 10,
      monthlySalary: 26000,
    });

    expect(result.shortfallDays).toBe(20);
    expect(result.dailyRate).toBe(1000);
    expect(result.amount).toBe(20000);
  });

  test('a fully served notice recovers nothing', () => {
    const result = computeNoticeShortfall({
      noticePeriodDays: 30,
      noticeServedDays: 30,
      monthlySalary: 26000,
    });

    expect(result.amount).toBe(0);
    expect(result.explanation).toContain('Full notice period');
  });

  test('over-serving does not produce a negative recovery', () => {
    expect(
      computeNoticeShortfall({
        noticePeriodDays: 30,
        noticeServedDays: 45,
        monthlySalary: 26000,
      }).amount,
    ).toBe(0);
  });

  test('no notice period means nothing to recover', () => {
    [0, -5, NaN, null].forEach((noticePeriodDays) => {
      expect(
        computeNoticeShortfall({
          noticePeriodDays,
          noticeServedDays: 0,
          monthlySalary: 26000,
        }).amount,
      ).toBe(0);
    });
  });

  test('a missing served figure is treated as none served', () => {
    const result = computeNoticeShortfall({
      noticePeriodDays: 30,
      monthlySalary: 26000,
    });

    expect(result.shortfallDays).toBe(30);
  });
});

describe('settlement — buildSettlement', () => {
  const base = {
    monthlySalary: 26000,
    joiningDate: '2018-01-01',
    lastWorkingDay: '2026-07-15',
    unusedLeaveDays: 8,
    noticePeriodDays: 30,
    noticeServedDays: 30,
  };

  test('assembles earnings, deductions and the net', () => {
    const result = buildSettlement(base);

    expect(result.earnings.proratedSalary).toBeGreaterThan(0);
    expect(result.earnings.leaveEncashment).toBe(8000);
    expect(result.earnings.gratuity).toBeGreaterThan(0);
    expect(result.grossEarnings).toBe(
      Math.round(
        (result.earnings.proratedSalary +
          result.earnings.leaveEncashment +
          result.earnings.gratuity) *
          100,
      ) / 100,
    );
    expect(result.netSettlement).toBe(result.grossEarnings - result.totalDeductions);
  });

  test('an unserved notice reduces the net', () => {
    const served = buildSettlement(base);
    const unserved = buildSettlement({ ...base, noticeServedDays: 0 });

    expect(unserved.deductions.noticeShortfall).toBeGreaterThan(0);
    expect(unserved.netSettlement).toBeLessThan(served.netSettlement);
  });

  test('manual recoveries reduce the net and cannot be negative', () => {
    const result = buildSettlement({
      ...base,
      assetRecovery: 5000,
      advanceRecovery: 3000,
      otherDeductions: -999, // floored at 0
    });

    expect(result.deductions.assetRecovery).toBe(5000);
    expect(result.deductions.advanceRecovery).toBe(3000);
    expect(result.deductions.other).toBe(0);
  });

  test('every computed line carries an explanation', () => {
    const result = buildSettlement(base);

    ['proratedSalary', 'leaveEncashment', 'gratuity', 'noticeShortfall'].forEach(
      (key) => {
        expect(typeof result.explanations[key]).toBe('string');
        expect(result.explanations[key].length).toBeGreaterThan(0);
      },
    );
  });

  test('freezes the policy that was applied', () => {
    const result = buildSettlement({ ...base, policy: { leaveEncashmentCapDays: 5 } });

    expect(result.policy.leaveEncashmentCapDays).toBe(5);
    expect(result.earnings.encashableDays).toBe(5);
  });

  test('a short-service leaver gets no gratuity but still gets the rest', () => {
    const result = buildSettlement({ ...base, joiningDate: '2024-01-01' });

    expect(result.earnings.gratuity).toBe(0);
    expect(result.earnings.proratedSalary).toBeGreaterThan(0);
    expect(result.earnings.leaveEncashment).toBeGreaterThan(0);
  });

  test('an empty input produces zeroes rather than NaN', () => {
    const result = buildSettlement({});

    expect(result.grossEarnings).toBe(0);
    expect(result.totalDeductions).toBe(0);
    expect(result.netSettlement).toBe(0);
  });
});

describe('settlement — validateSettlement', () => {
  test('accepts a positive settlement', () => {
    const settlement = buildSettlement({
      monthlySalary: 26000,
      lastWorkingDay: '2026-07-15',
    });

    expect(validateSettlement(settlement).ok).toBe(true);
  });

  test('no notice recovery is applied when the caller says nothing about notice', () => {
    // Falling back to the policy default with zero days served would silently
    // deduct a month's salary from every settlement computed without notice
    // information.
    const settlement = buildSettlement({
      monthlySalary: 26000,
      lastWorkingDay: '2026-07-15',
    });

    expect(settlement.deductions.noticeShortfall).toBe(0);
    expect(settlement.explanations.noticeShortfall).toContain('No notice-period');
  });

  test('the policy default applies once the caller supplies served days', () => {
    const settlement = buildSettlement({
      monthlySalary: 26000,
      lastWorkingDay: '2026-07-15',
      noticeServedDays: 10,
    });

    // 30-day policy default, 10 served -> 20 recovered.
    expect(settlement.deductions.noticeShortfallDays).toBe(20);
  });

  test('blocks a negative settlement by default', () => {
    // A negative net is a real situation, but it must be a deliberate decision
    // rather than the result of a mistyped recovery figure.
    const settlement = buildSettlement({
      monthlySalary: 26000,
      lastWorkingDay: '2026-07-02',
      assetRecovery: 500000,
    });

    const result = validateSettlement(settlement);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('negative');
  });

  test('allows a negative settlement when explicitly overridden', () => {
    const settlement = buildSettlement({
      monthlySalary: 26000,
      lastWorkingDay: '2026-07-02',
      assetRecovery: 500000,
    });

    expect(validateSettlement(settlement, { allowNegative: true }).ok).toBe(true);
  });

  test('rejects a missing settlement', () => {
    [null, undefined, 'x'].forEach((value) => {
      expect(validateSettlement(value).ok).toBe(false);
    });
  });
});

describe('settlement — workingDaysUpTo', () => {
  test('excludes Sundays by default', () => {
    // July 2026 has 31 days; counting to the 31st excludes each Sunday.
    const all = workingDaysUpTo(2026, 7, 31, [0]);
    expect(all).toBeLessThan(31);
    expect(all).toBeGreaterThan(24);
  });

  test('honours a custom weekly-off configuration', () => {
    const oneOff = workingDaysUpTo(2026, 7, 31, [0]);
    const twoOff = workingDaysUpTo(2026, 7, 31, [0, 6]);
    expect(twoOff).toBeLessThan(oneOff);
  });

  test('counting to day zero yields nothing', () => {
    expect(workingDaysUpTo(2026, 7, 0, [0])).toBe(0);
  });
});
