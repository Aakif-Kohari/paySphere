const {
  daysInMonth,
  isValidMonth,
  isValidYear,
  normalizeOvertimeHours,
  validateGrid,
  computeTotals,
  derivePayrollInputs,
  buildDefaultGrid,
} = require('../attendanceGrid');
const { ATTENDANCE_STATUS } = require('../../config/attendance');

const day = (d, status, overtimeHours = 0, note = '') => ({
  day: d,
  status,
  overtimeHours,
  note,
});

describe('attendanceGrid — daysInMonth (#459)', () => {
  test('returns the real length of the month, not a fixed 30', () => {
    // #310 fixed a /30 divisor in the salary calculator. The ledger must not
    // reintroduce the same assumption from the other direction.
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  test('handles leap Februaries', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28); // not a leap year
    expect(daysInMonth(2000, 2)).toBe(29); // is a leap year
  });
});

describe('attendanceGrid — period validation', () => {
  test('accepts the boundaries and rejects everything outside them', () => {
    expect(isValidMonth(1)).toBe(true);
    expect(isValidMonth(12)).toBe(true);
    expect(isValidMonth(0)).toBe(false);
    expect(isValidMonth(13)).toBe(false);
    expect(isValidMonth(1.5)).toBe(false);
    expect(isValidMonth('3')).toBe(false);

    expect(isValidYear(2000)).toBe(true);
    expect(isValidYear(2100)).toBe(true);
    expect(isValidYear(1999)).toBe(false);
    expect(isValidYear(2101)).toBe(false);
  });
});

describe('attendanceGrid — normalizeOvertimeHours', () => {
  test('rounds to quarter hours so 31 days of drift cannot accumulate', () => {
    expect(normalizeOvertimeHours(2.1)).toBe(2);
    expect(normalizeOvertimeHours(2.13)).toBe(2.25);
    expect(normalizeOvertimeHours(2.5)).toBe(2.5);
  });

  test('clamps to 24 — a day cannot contain more hours than it has', () => {
    expect(normalizeOvertimeHours(100)).toBe(24);
    expect(normalizeOvertimeHours(24)).toBe(24);
  });

  test('treats negatives, zero and junk as zero', () => {
    [-5, 0, NaN, Infinity, null, undefined, 'abc', {}].forEach((value) => {
      expect(normalizeOvertimeHours(value)).toBe(0);
    });
  });
});

describe('attendanceGrid — validateGrid', () => {
  test('accepts a well-formed grid', () => {
    const result = validateGrid(
      [day(1, 'present'), day(2, 'absent'), day(3, 'overtime', 3)],
      2026,
      7,
    );

    expect(result.ok).toBe(true);
    expect(result.days).toHaveLength(3);
    expect(result.errors).toEqual([]);
  });

  test('rejects a day outside the month — 31 February cannot be deducted', () => {
    const result = validateGrid([day(30, 'absent')], 2026, 2);

    expect(result.ok).toBe(false);
    expect(result.errors[0].reason).toContain('between 1 and 28');
  });

  test('rejects day 0 and negative days', () => {
    const result = validateGrid([day(0, 'present'), day(-3, 'present')], 2026, 7);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  test('rejects duplicate entries for the same day', () => {
    // Two rows for one date would make the totals depend on iteration order.
    const result = validateGrid([day(5, 'present'), day(5, 'absent')], 2026, 7);

    expect(result.ok).toBe(false);
    expect(result.errors[0].reason).toContain('Duplicate');
  });

  test('rejects an unknown status', () => {
    const result = validateGrid([day(1, 'vacationing')], 2026, 7);

    expect(result.ok).toBe(false);
    expect(result.errors[0].reason).toContain('Unknown attendance status');
  });

  test('accepts the legacy SCREAMING_SNAKE spellings the modal already uses', () => {
    const result = validateGrid(
      [day(1, 'PRESENT'), day(2, 'HALF_DAY'), day(3, 'PAID_LEAVE'), day(4, 'UNPAID_LEAVE')],
      2026,
      7,
    );

    expect(result.ok).toBe(true);
    expect(result.days.map((d) => d.status)).toEqual([
      'present',
      'half_day',
      'paid_leave',
      'absent',
    ]);
  });

  test('refuses overtime logged against a day that cannot have any', () => {
    const result = validateGrid([day(1, 'absent', 5)], 2026, 7);

    expect(result.ok).toBe(false);
    expect(result.errors[0].reason).toContain('cannot be logged against');
  });

  test('allows overtime on a worked holiday — the common small-business case', () => {
    const result = validateGrid([day(1, 'holiday', 6)], 2026, 7);

    expect(result.ok).toBe(true);
    expect(result.days[0].overtimeHours).toBe(6);
  });

  test('zeroes overtime on statuses that do not carry it, without erroring', () => {
    const result = validateGrid([day(1, 'present', 0)], 2026, 7);
    expect(result.ok).toBe(true);
    expect(result.days[0].overtimeHours).toBe(0);
  });

  test('caps the month total, catching a client that fans a value across days', () => {
    const days = [];
    for (let d = 1; d <= 31; d += 1) days.push(day(d, 'overtime', 20));

    const result = validateGrid(days, 2026, 7);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.reason.includes('exceeds the maximum'))).toBe(
      true,
    );
  });

  test('truncates an oversized note rather than rejecting the day', () => {
    const result = validateGrid([day(1, 'present', 0, 'x'.repeat(500))], 2026, 7);

    expect(result.ok).toBe(true);
    expect(result.days[0].note).toHaveLength(200);
  });

  test('rejects a non-string note', () => {
    const result = validateGrid([{ day: 1, status: 'present', note: { $ne: 1 } }], 2026, 7);
    expect(result.ok).toBe(false);
  });

  test('rejects a non-array payload', () => {
    [null, undefined, 'days', 42, {}].forEach((value) => {
      expect(validateGrid(value, 2026, 7).ok).toBe(false);
    });
  });

  test('returns days sorted, so the stored order never depends on the client', () => {
    const result = validateGrid([day(9, 'present'), day(2, 'present'), day(5, 'present')], 2026, 7);

    expect(result.days.map((d) => d.day)).toEqual([2, 5, 9]);
  });

  test('collects every error rather than stopping at the first', () => {
    const result = validateGrid(
      [day(99, 'present'), day(1, 'nonsense'), day(2, 'absent', 4)],
      2026,
      7,
    );

    expect(result.errors).toHaveLength(3);
  });
});

describe('attendanceGrid — computeTotals', () => {
  test('a half day is worth 0.5 worked and 0.5 unpaid', () => {
    // The modal already implied this; the server never implemented it, so half
    // days were dropped entirely on the way to payroll.
    const totals = computeTotals([day(1, 'half_day')]);

    expect(totals.present).toBe(0.5);
    expect(totals.unpaidLeave).toBe(0.5);
    expect(totals.halfDay).toBe(1);
  });

  test('paid leave does not count as unpaid', () => {
    const totals = computeTotals([day(1, 'paid_leave'), day(2, 'paid_leave')]);

    expect(totals.paidLeave).toBe(2);
    expect(totals.unpaidLeave).toBe(0);
  });

  test('a holiday is neither worked nor deducted', () => {
    const totals = computeTotals([day(1, 'holiday')]);

    expect(totals.present).toBe(0);
    expect(totals.unpaidLeave).toBe(0);
    expect(totals.paidLeave).toBe(0);
    expect(totals.holiday).toBe(1);
  });

  test('an overtime day counts as present and accumulates hours', () => {
    const totals = computeTotals([day(1, 'overtime', 3), day(2, 'overtime', 2.5)]);

    expect(totals.present).toBe(2);
    expect(totals.overtimeHours).toBe(5.5);
  });

  test('a mixed month adds up correctly', () => {
    const totals = computeTotals([
      day(1, 'present'),
      day(2, 'present'),
      day(3, 'half_day'),
      day(4, 'absent'),
      day(5, 'paid_leave'),
      day(6, 'holiday'),
      day(7, 'overtime', 4),
    ]);

    expect(totals.present).toBe(3.5); // 2 present + 0.5 half day + 1 overtime day
    expect(totals.unpaidLeave).toBe(1.5); // 1 absent + 0.5 half day
    expect(totals.paidLeave).toBe(1);
    expect(totals.holiday).toBe(1);
    expect(totals.overtimeHours).toBe(4);
    expect(totals.daysRecorded).toBe(7);
  });

  test('rounds to two decimals so half days do not accumulate binary drift', () => {
    const days = [];
    for (let d = 1; d <= 3; d += 1) days.push(day(d, 'half_day'));

    const totals = computeTotals(days);

    expect(totals.unpaidLeave).toBe(1.5);
    expect(totals.present).toBe(1.5);
  });

  test('skips unrecognised entries instead of producing NaN', () => {
    const totals = computeTotals([day(1, 'present'), { day: 2, status: 'bogus' }, null]);

    expect(Number.isNaN(totals.present)).toBe(false);
    expect(totals.present).toBe(1);
  });

  test('an empty or non-array grid yields zeroes', () => {
    [[], null, undefined, 'x'].forEach((value) => {
      const totals = computeTotals(value);
      expect(totals.present).toBe(0);
      expect(totals.unpaidLeave).toBe(0);
    });
  });
});

describe('attendanceGrid — derivePayrollInputs', () => {
  test('only unpaid absence reaches leaveDays', () => {
    // The pre-#459 flow could not distinguish the two, so a company that
    // granted paid leave still docked the employee for it.
    const totals = computeTotals([
      day(1, 'paid_leave'),
      day(2, 'paid_leave'),
      day(3, 'absent'),
    ]);

    expect(derivePayrollInputs(totals)).toEqual({
      leaveDays: 1,
      overtimeHours: 0,
    });
  });

  test('half days contribute 0.5 to the deduction', () => {
    const totals = computeTotals([day(1, 'half_day'), day(2, 'absent')]);
    expect(derivePayrollInputs(totals).leaveDays).toBe(1.5);
  });

  test('overtime hours pass through', () => {
    const totals = computeTotals([day(1, 'overtime', 7.5)]);
    expect(derivePayrollInputs(totals).overtimeHours).toBe(7.5);
  });

  test('a perfect month produces no adjustments', () => {
    const totals = computeTotals([day(1, 'present'), day(2, 'present')]);
    expect(derivePayrollInputs(totals)).toEqual({ leaveDays: 0, overtimeHours: 0 });
  });

  test('junk input degrades to zeroes rather than NaN reaching the salary calculator', () => {
    [null, undefined, 'x', 42, { unpaidLeave: NaN, overtimeHours: Infinity }].forEach(
      (value) => {
        expect(derivePayrollInputs(value)).toEqual({
          leaveDays: 0,
          overtimeHours: 0,
        });
      },
    );
  });
});

describe('attendanceGrid — buildDefaultGrid', () => {
  test('covers exactly the days in the month', () => {
    expect(buildDefaultGrid(2026, 2)).toHaveLength(28);
    expect(buildDefaultGrid(2028, 2)).toHaveLength(29);
    expect(buildDefaultGrid(2026, 7)).toHaveLength(31);
  });

  test('marks weekly offs as holiday, not paid leave', () => {
    // The modal defaults Sundays to PAID_LEAVE, which consumes ~52 days of a
    // 12-day annual entitlement. A weekly off is not leave.
    const grid = buildDefaultGrid(2026, 7);
    const sundays = grid.filter(
      (d) => new Date(2026, 6, d.day).getDay() === 0,
    );

    expect(sundays.length).toBeGreaterThan(0);
    sundays.forEach((d) => {
      expect(d.status).toBe(ATTENDANCE_STATUS.HOLIDAY);
    });
  });

  test('a default month consumes no leave balance and deducts nothing', () => {
    const totals = computeTotals(buildDefaultGrid(2026, 7));

    expect(totals.paidLeave).toBe(0);
    expect(totals.unpaidLeave).toBe(0);
  });

  test('honours a custom weekly-off configuration', () => {
    const grid = buildDefaultGrid(2026, 7, [0, 6]); // Sunday + Saturday
    const saturdays = grid.filter((d) => new Date(2026, 6, d.day).getDay() === 6);

    saturdays.forEach((d) => expect(d.status).toBe(ATTENDANCE_STATUS.HOLIDAY));
  });

  test('working days default to present', () => {
    const grid = buildDefaultGrid(2026, 7);
    const monday = grid.find((d) => new Date(2026, 6, d.day).getDay() === 1);

    expect(monday.status).toBe(ATTENDANCE_STATUS.PRESENT);
  });

  test('the generated grid passes its own validator', () => {
    const grid = buildDefaultGrid(2026, 2);
    expect(validateGrid(grid, 2026, 2).ok).toBe(true);
  });
});
