const {
  resolvePolicy,
  resolveLeaveYear,
  isWithinLeaveYear,
  monthsAccrued,
  computeEntitlement,
  computeConsumed,
  computeLeaveBalance,
  canTakePaidLeave,
  computeCarryForward,
} = require('../leaveBalance');
const { ACCRUAL_MODE, DEFAULT_LEAVE_POLICY } = require('../../config/attendance');

const monthRecord = (year, month, paidLeave) => ({
  year,
  month,
  totals: { paidLeave },
});

describe('leaveBalance — resolvePolicy (#459)', () => {
  test('an absent policy falls back to the documented defaults', () => {
    expect(resolvePolicy(undefined)).toEqual(DEFAULT_LEAVE_POLICY);
    expect(resolvePolicy(null)).toEqual(DEFAULT_LEAVE_POLICY);
    expect(resolvePolicy('nonsense')).toEqual(DEFAULT_LEAVE_POLICY);
  });

  test('a partial policy is merged over the defaults', () => {
    const policy = resolvePolicy({ annualPaidLeaveDays: 24 });

    expect(policy.annualPaidLeaveDays).toBe(24);
    expect(policy.accrualMode).toBe(DEFAULT_LEAVE_POLICY.accrualMode);
  });

  test('nonsense values are rejected rather than propagated into an entitlement', () => {
    const policy = resolvePolicy({
      annualPaidLeaveDays: -5,
      carryForwardCapDays: 9999,
      leaveYearStartMonth: 47,
      accrualMode: 'whenever',
    });

    expect(policy.annualPaidLeaveDays).toBe(DEFAULT_LEAVE_POLICY.annualPaidLeaveDays);
    expect(policy.carryForwardCapDays).toBe(DEFAULT_LEAVE_POLICY.carryForwardCapDays);
    expect(policy.leaveYearStartMonth).toBe(DEFAULT_LEAVE_POLICY.leaveYearStartMonth);
    expect(policy.accrualMode).toBe(DEFAULT_LEAVE_POLICY.accrualMode);
  });

  test('zero entitlement is a legitimate choice, not a fallback trigger', () => {
    expect(resolvePolicy({ annualPaidLeaveDays: 0 }).annualPaidLeaveDays).toBe(0);
  });
});

describe('leaveBalance — resolveLeaveYear', () => {
  test('with an April start, April begins the year named for that calendar year', () => {
    expect(resolveLeaveYear(2026, 4, 4)).toEqual({
      startYear: 2026,
      startMonth: 4,
      endYear: 2027,
      endMonth: 3,
    });
  });

  test('March belongs to the previous leave year', () => {
    // March 2027 is the last month of leave year 2026, matching how an Indian
    // financial year is conventionally labelled.
    expect(resolveLeaveYear(2027, 3, 4).startYear).toBe(2026);
  });

  test('a January start makes the leave year the calendar year', () => {
    expect(resolveLeaveYear(2026, 7, 1)).toEqual({
      startYear: 2026,
      startMonth: 1,
      endYear: 2026,
      endMonth: 12,
    });
  });

  test('isWithinLeaveYear is inclusive at both ends', () => {
    const ly = resolveLeaveYear(2026, 4, 4);

    expect(isWithinLeaveYear(2026, 4, ly)).toBe(true); // first month
    expect(isWithinLeaveYear(2027, 3, ly)).toBe(true); // last month
    expect(isWithinLeaveYear(2026, 3, ly)).toBe(false); // one before
    expect(isWithinLeaveYear(2027, 4, ly)).toBe(false); // one after
  });
});

describe('leaveBalance — monthsAccrued', () => {
  const leaveYear = resolveLeaveYear(2026, 4, 4);

  test('a long-standing employee accrues from the start of the leave year', () => {
    expect(
      monthsAccrued({ joiningDate: '2020-01-01', year: 2026, month: 4, leaveYear }),
    ).toBe(1);
    expect(
      monthsAccrued({ joiningDate: '2020-01-01', year: 2026, month: 9, leaveYear }),
    ).toBe(6);
    expect(
      monthsAccrued({ joiningDate: '2020-01-01', year: 2027, month: 3, leaveYear }),
    ).toBe(12);
  });

  test('a mid-year joiner accrues only from their joining month', () => {
    // Crediting a full year to someone who joined in February would hand them
    // eleven months of leave they have not earned.
    expect(
      monthsAccrued({ joiningDate: '2026-10-15', year: 2027, month: 3, leaveYear }),
    ).toBe(6);
  });

  test('an employee who has not joined yet has accrued nothing', () => {
    expect(
      monthsAccrued({ joiningDate: '2027-01-01', year: 2026, month: 6, leaveYear }),
    ).toBe(0);
  });

  test('accrual never runs past the end of the leave year', () => {
    expect(
      monthsAccrued({ joiningDate: '2020-01-01', year: 2028, month: 12, leaveYear }),
    ).toBe(12);
  });

  test('a missing or unparseable joining date falls back to the leave-year start', () => {
    [null, undefined, 'not-a-date'].forEach((joiningDate) => {
      expect(monthsAccrued({ joiningDate, year: 2026, month: 6, leaveYear })).toBe(3);
    });
  });
});

describe('leaveBalance — computeEntitlement', () => {
  test('monthly accrual credits 1/12th per completed month', () => {
    const result = computeEntitlement({
      policy: { annualPaidLeaveDays: 12, accrualMode: ACCRUAL_MODE.MONTHLY },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 9, // 6th month of the April leave year
    });

    expect(result.monthsAccrued).toBe(6);
    expect(result.accrued).toBe(6);
  });

  test('monthly accrual handles a non-integer per-month figure', () => {
    const result = computeEntitlement({
      policy: { annualPaidLeaveDays: 15, accrualMode: ACCRUAL_MODE.MONTHLY },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 6, // 3 months
    });

    expect(result.accrued).toBe(3.75);
  });

  test('annual accrual credits the whole entitlement in the first month', () => {
    const result = computeEntitlement({
      policy: { annualPaidLeaveDays: 12, accrualMode: ACCRUAL_MODE.ANNUAL },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 4,
    });

    expect(result.accrued).toBe(12);
  });

  test('annual accrual still gives a not-yet-joined employee nothing', () => {
    const result = computeEntitlement({
      policy: { annualPaidLeaveDays: 12, accrualMode: ACCRUAL_MODE.ANNUAL },
      joiningDate: '2027-06-01',
      year: 2026,
      month: 5,
    });

    expect(result.accrued).toBe(0);
  });

  test('accrual is capped at the annual entitlement', () => {
    const result = computeEntitlement({
      policy: { annualPaidLeaveDays: 12, accrualMode: ACCRUAL_MODE.MONTHLY },
      joiningDate: '2020-01-01',
      year: 2027,
      month: 3,
    });

    expect(result.accrued).toBe(12);
  });
});

describe('leaveBalance — computeConsumed', () => {
  const leaveYear = resolveLeaveYear(2026, 7, 4);

  test('sums paid leave inside the leave year only', () => {
    const consumed = computeConsumed(
      [
        monthRecord(2026, 3, 5), // previous leave year — excluded
        monthRecord(2026, 4, 2),
        monthRecord(2026, 7, 1.5),
        monthRecord(2027, 4, 4), // next leave year — excluded
      ],
      leaveYear,
    );

    expect(consumed).toBe(3.5);
  });

  test('ignores malformed records rather than producing NaN', () => {
    const consumed = computeConsumed(
      [null, 'x', { year: 'a', month: 4 }, monthRecord(2026, 5, 2)],
      leaveYear,
    );

    expect(consumed).toBe(2);
  });

  test('an empty history consumes nothing', () => {
    expect(computeConsumed([], leaveYear)).toBe(0);
    expect(computeConsumed(null, leaveYear)).toBe(0);
  });
});

describe('leaveBalance — computeLeaveBalance', () => {
  test('available = accrued + carried − consumed', () => {
    const balance = computeLeaveBalance({
      policy: { annualPaidLeaveDays: 12, carryForwardCapDays: 5 },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 9, // 6 months accrued = 6 days
      monthlyTotals: [monthRecord(2026, 5, 2)],
      carriedForward: 3,
    });

    expect(balance.accrued).toBe(6);
    expect(balance.carriedForward).toBe(3);
    expect(balance.consumed).toBe(2);
    expect(balance.available).toBe(7);
    expect(balance.isOverdrawn).toBe(false);
  });

  test('carry-forward is capped by policy', () => {
    const balance = computeLeaveBalance({
      policy: { annualPaidLeaveDays: 12, carryForwardCapDays: 2 },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 4,
      carriedForward: 10,
    });

    expect(balance.carriedForward).toBe(2);
  });

  test('a negative carry-forward is floored at zero', () => {
    const balance = computeLeaveBalance({
      policy: { carryForwardCapDays: 5 },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 4,
      carriedForward: -8,
    });

    expect(balance.carriedForward).toBe(0);
  });

  test('an overdrawn balance is surfaced, not clamped', () => {
    // The employer needs to see that leave was taken in advance; hiding it
    // behind a Math.max would make the ledger disagree with reality.
    const balance = computeLeaveBalance({
      policy: { annualPaidLeaveDays: 12 },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 4, // 1 day accrued
      monthlyTotals: [monthRecord(2026, 4, 5)],
    });

    expect(balance.available).toBe(-4);
    expect(balance.isOverdrawn).toBe(true);
  });

  test('handles a half-day of paid leave without floating-point drift', () => {
    const balance = computeLeaveBalance({
      policy: { annualPaidLeaveDays: 12 },
      joiningDate: '2020-01-01',
      year: 2026,
      month: 6, // 3 days accrued
      monthlyTotals: [monthRecord(2026, 4, 0.5), monthRecord(2026, 5, 0.5)],
    });

    expect(balance.consumed).toBe(1);
    expect(balance.available).toBe(2);
  });

  test('a brand-new employee has no balance to spend', () => {
    const balance = computeLeaveBalance({
      policy: { annualPaidLeaveDays: 12 },
      joiningDate: '2027-01-01',
      year: 2026,
      month: 8,
    });

    expect(balance.accrued).toBe(0);
    expect(balance.available).toBe(0);
  });
});

describe('leaveBalance — canTakePaidLeave', () => {
  const balanceWith = (available, allowNegativeBalance = false) => ({
    available,
    policy: { allowNegativeBalance },
  });

  test('allows a request within the balance', () => {
    expect(canTakePaidLeave(balanceWith(5), 3)).toEqual({
      allowed: true,
      shortfall: 0,
    });
  });

  test('allows a request that exactly exhausts the balance', () => {
    expect(canTakePaidLeave(balanceWith(3), 3).allowed).toBe(true);
  });

  test('refuses a request beyond the balance and reports the shortfall', () => {
    const result = canTakePaidLeave(balanceWith(2), 5);

    expect(result.allowed).toBe(false);
    expect(result.shortfall).toBe(3);
    expect(result.reason).toContain('2 paid leave day(s) available');
  });

  test('permits an overdraw when the policy allows it, still reporting the shortfall', () => {
    const result = canTakePaidLeave(balanceWith(1, true), 4);

    expect(result.allowed).toBe(true);
    expect(result.shortfall).toBe(3);
  });

  test('a zero or nonsensical request is trivially allowed', () => {
    [0, -1, NaN, null, undefined, 'x'].forEach((requested) => {
      expect(canTakePaidLeave(balanceWith(0), requested).allowed).toBe(true);
    });
  });
});

describe('leaveBalance — computeCarryForward', () => {
  test('carries the lesser of the balance and the cap', () => {
    expect(
      computeCarryForward({ available: 8, policy: { carryForwardCapDays: 5 } }),
    ).toBe(5);
    expect(
      computeCarryForward({ available: 3, policy: { carryForwardCapDays: 5 } }),
    ).toBe(3);
  });

  test('an overdrawn balance carries nothing forward rather than a debt', () => {
    expect(
      computeCarryForward({ available: -4, policy: { carryForwardCapDays: 5 } }),
    ).toBe(0);
  });

  test('a zero cap means leave lapses', () => {
    expect(
      computeCarryForward({ available: 9, policy: { carryForwardCapDays: 0 } }),
    ).toBe(0);
  });

  test('a malformed balance degrades to zero', () => {
    expect(computeCarryForward(null)).toBe(0);
    expect(computeCarryForward({})).toBe(0);
  });
});
