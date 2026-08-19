/**
 * Leave year-end closure arithmetic (#1159).
 *
 * The invariant everything below returns to is conservation:
 *
 *     carriedForward + encashedDays + lapsedDays === closingBalance
 *
 * A day that is neither kept, nor paid for, nor explicitly written off is a day
 * an employee earned and silently lost, so it is asserted on every shape of
 * policy rather than once.
 */

const {
  RATE_BASIS,
  DEFAULT_MONTH_DAYS,
  capOrInfinity,
  resolveEncashmentRate,
  computeYearEndClosure,
  isAlreadyClosed,
  computeClosureBatch,
  buildEncashmentPayrollLines,
} = require('../leaveEncashment');

const EMPLOYEE = {
  _id: 'emp-1',
  fullName: 'A. Employee',
  monthlySalary: 60000,
};

/**
 * A leave policy. Defaults are the permissive case — no caps, not encashable —
 * so each test only states the rule it is about.
 */
function policy(overrides = {}) {
  return {
    _id: 'pol-1',
    name: 'Earned Leave',
    leaveType: 'earned',
    maxCarryForward: null,
    maxAccumulation: null,
    isEncashable: false,
    maxEncashmentDays: null,
    minRetentionDays: 0,
    encashmentRateBasis: RATE_BASIS.BASIC,
    ...overrides,
  };
}

/**
 * A leave balance at the end of a leave year.
 */
function balance(overrides = {}) {
  return {
    _id: 'bal-1',
    employeeId: 'emp-1',
    policyId: 'pol-1',
    leaveType: 'earned',
    currentBalance: 30,
    year: 2026,
    closedForYear: null,
    ...overrides,
  };
}

/**
 * The invariant, as a helper, so every test can assert it cheaply.
 */
function assertConserved(closure) {
  expect(
    closure.carriedForward + closure.encashedDays + closure.lapsedDays,
  ).toBeCloseTo(closure.closingBalance, 2);
}

describe('capOrInfinity', () => {
  it('reads an absent cap as no limit, not as zero', () => {
    // Reading `maxCarryForward: null` as 0 would lapse an employee's whole
    // balance.
    expect(capOrInfinity(null)).toBe(Infinity);
    expect(capOrInfinity(undefined)).toBe(Infinity);
    expect(capOrInfinity('')).toBe(Infinity);
  });

  it('honours a real cap, including zero', () => {
    expect(capOrInfinity(15)).toBe(15);
    expect(capOrInfinity(0)).toBe(0);
  });

  it('ignores a nonsensical cap rather than applying it', () => {
    expect(capOrInfinity(-5)).toBe(Infinity);
    expect(capOrInfinity('lots')).toBe(Infinity);
  });
});

describe('resolveEncashmentRate', () => {
  it('prices on basic, derived from gross by the policy split', () => {
    const rate = resolveEncashmentRate(EMPLOYEE, policy());

    expect(rate.basis).toBe(RATE_BASIS.BASIC);
    expect(rate.basic).toBe(30000); // 50% of 60000
    expect(rate.perDayRate).toBe(1000); // 30000 / 30
  });

  it('prices on gross when the policy says so', () => {
    const rate = resolveEncashmentRate(
      EMPLOYEE,
      policy({ encashmentRateBasis: RATE_BASIS.GROSS }),
    );

    expect(rate.monthlyAmount).toBe(60000);
    expect(rate.perDayRate).toBe(2000);
  });

  it('prefers an explicit basic on the employee record', () => {
    const rate = resolveEncashmentRate(
      { ...EMPLOYEE, basicSalary: 24000 },
      policy(),
    );

    expect(rate.basic).toBe(24000);
    expect(rate.perDayRate).toBe(800);
  });

  it('honours a different basic split', () => {
    const rate = resolveEncashmentRate(
      EMPLOYEE,
      policy({ basicPercentOfGross: 40 }),
    );

    expect(rate.basic).toBe(24000);
  });

  it('falls back rather than dividing by a zero month length', () => {
    // A zero divisor makes the rate infinite, and that would reach a payroll
    // line.
    const rate = resolveEncashmentRate(
      EMPLOYEE,
      policy({ encashmentMonthDays: 0 }),
    );

    expect(rate.monthDays).toBe(DEFAULT_MONTH_DAYS);
    expect(Number.isFinite(rate.perDayRate)).toBe(true);
  });

  it('handles an employee with no salary on record', () => {
    const rate = resolveEncashmentRate({}, policy());

    expect(rate.perDayRate).toBe(0);
  });
});

describe('computeYearEndClosure', () => {
  it('carries the whole balance when there is no cap', () => {
    const closure = computeYearEndClosure(balance(), policy(), EMPLOYEE);

    expect(closure.carriedForward).toBe(30);
    expect(closure.encashedDays).toBe(0);
    expect(closure.lapsedDays).toBe(0);
    assertConserved(closure);
  });

  it('lapses the excess on a non-encashable leave type', () => {
    // Correct and deliberately visible for casual or sick leave.
    const closure = computeYearEndClosure(
      balance({ currentBalance: 30 }),
      policy({ maxCarryForward: 10, isEncashable: false }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(10);
    expect(closure.encashedDays).toBe(0);
    expect(closure.lapsedDays).toBe(20);
    assertConserved(closure);
  });

  it('encashes the excess on an encashable leave type', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: 30 }),
      policy({ maxCarryForward: 10, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(10);
    expect(closure.encashedDays).toBe(20);
    expect(closure.encashedAmount).toBe(20000); // 20 days at 1000/day
    expect(closure.lapsedDays).toBe(0);
    assertConserved(closure);
  });

  it('lapses whatever the encashment ceiling will not cover', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: 30 }),
      policy({ maxCarryForward: 10, isEncashable: true, maxEncashmentDays: 5 }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(10);
    expect(closure.encashedDays).toBe(5);
    expect(closure.lapsedDays).toBe(15);
    assertConserved(closure);
  });

  it('lets maxAccumulation bind even when maxCarryForward is higher', () => {
    // maxAccumulation is a ceiling on the total balance an employee may hold,
    // so a more generous carry-forward cap cannot lift it.
    const closure = computeYearEndClosure(
      balance({ currentBalance: 40 }),
      policy({ maxCarryForward: 30, maxAccumulation: 12, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(12);
    expect(closure.encashedDays).toBe(28);
    expect(closure.appliedCaps.accumulationCapBound).toBe(true);
    assertConserved(closure);
  });

  it('lets maxCarryForward bind when it is the tighter of the two', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: 40 }),
      policy({ maxCarryForward: 12, maxAccumulation: 30, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(12);
    expect(closure.appliedCaps.accumulationCapBound).toBe(false);
    assertConserved(closure);
  });

  it('raises the carried figure to the retention floor over a tighter cap', () => {
    // The floor exists so an employee is not left with nothing after a close.
    // A cap that overrode it would defeat the point of having it.
    const closure = computeYearEndClosure(
      balance({ currentBalance: 30 }),
      policy({ maxCarryForward: 2, minRetentionDays: 8, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(8);
    expect(closure.encashedDays).toBe(22);
    expect(closure.appliedCaps.retentionRaisedCarry).toBe(true);
    assertConserved(closure);
  });

  it('does not conjure days to meet a retention floor', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: 3 }),
      policy({ maxCarryForward: 0, minRetentionDays: 10 }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(3);
    expect(closure.lapsedDays).toBe(0);
    assertConserved(closure);
  });

  it('handles a zero carry-forward cap', () => {
    // Zero is a real cap and must not be read as "unset".
    const closure = computeYearEndClosure(
      balance({ currentBalance: 20 }),
      policy({ maxCarryForward: 0, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(0);
    expect(closure.encashedDays).toBe(20);
    assertConserved(closure);
  });

  it('handles a zero balance', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: 0 }),
      policy({ maxCarryForward: 10, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure).toMatchObject({
      carriedForward: 0,
      encashedDays: 0,
      lapsedDays: 0,
    });
    assertConserved(closure);
  });

  it('treats a negative balance as zero rather than paying it out', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: -5 }),
      policy({ isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.closingBalance).toBe(0);
    expect(closure.encashedAmount).toBe(0);
    assertConserved(closure);
  });

  it('conserves a fractional balance to two places', () => {
    // Accrual runs at 1.5 days a month, so half-days are the normal case, not
    // an edge one.
    const closure = computeYearEndClosure(
      balance({ currentBalance: 18.5 }),
      policy({ maxCarryForward: 7.25, isEncashable: true }),
      EMPLOYEE,
    );

    expect(closure.carriedForward).toBe(7.25);
    expect(closure.encashedDays).toBe(11.25);
    assertConserved(closure);
  });

  it('reports which caps were applied', () => {
    const closure = computeYearEndClosure(
      balance({ currentBalance: 40 }),
      policy({
        maxCarryForward: 10,
        maxAccumulation: 25,
        isEncashable: true,
        maxEncashmentDays: 15,
      }),
      EMPLOYEE,
    );

    expect(closure.appliedCaps).toMatchObject({
      carryForwardCap: 10,
      accumulationCap: 25,
      encashmentCap: 15,
    });
  });
});

describe('isAlreadyClosed', () => {
  it('recognises a balance already closed for the year', () => {
    expect(isAlreadyClosed(balance({ closedForYear: 2026 }), 2026)).toBe(true);
  });

  it('does not confuse one year with the next', () => {
    expect(isAlreadyClosed(balance({ closedForYear: 2025 }), 2026)).toBe(false);
    expect(isAlreadyClosed(balance({ closedForYear: null }), 2026)).toBe(false);
  });
});

describe('computeClosureBatch', () => {
  const policies = [
    policy({ _id: 'pol-1', maxCarryForward: 10, isEncashable: true }),
    policy({
      _id: 'pol-2',
      leaveType: 'sick',
      maxCarryForward: 5,
      isEncashable: false,
    }),
  ];

  const employees = [
    EMPLOYEE,
    { _id: 'emp-2', fullName: 'B. Employee', monthlySalary: 30000 },
  ];

  it('rolls the close up across a tenant', () => {
    const result = computeClosureBatch(
      [
        balance({
          _id: 'b1',
          employeeId: 'emp-1',
          policyId: 'pol-1',
          currentBalance: 30,
        }),
        balance({
          _id: 'b2',
          employeeId: 'emp-2',
          policyId: 'pol-2',
          currentBalance: 12,
          leaveType: 'sick',
        }),
      ],
      policies,
      employees,
      { year: 2026 },
    );

    expect(result.processedCount).toBe(2);
    expect(result.isComplete).toBe(true);
    expect(result.totals.encashedDays).toBe(20);
    expect(result.totals.lapsedDays).toBe(7);
    expect(result.totals.carriedForward).toBe(15);
  });

  it('conserves the balance across the whole batch', () => {
    const result = computeClosureBatch(
      [
        balance({
          _id: 'b1',
          employeeId: 'emp-1',
          policyId: 'pol-1',
          currentBalance: 30,
        }),
        balance({
          _id: 'b2',
          employeeId: 'emp-2',
          policyId: 'pol-2',
          currentBalance: 12,
        }),
      ],
      policies,
      employees,
      { year: 2026 },
    );

    const { totals } = result;

    expect(
      totals.carriedForward + totals.encashedDays + totals.lapsedDays,
    ).toBeCloseTo(totals.closingBalance, 2);
  });

  it('skips a balance whose year is already closed', () => {
    // Without this the close is not idempotent: a second run carries forward
    // and encashes again, and the employee is paid twice for days they earned
    // once.
    const result = computeClosureBatch(
      [balance({ closedForYear: 2026, currentBalance: 30 })],
      policies,
      employees,
      { year: 2026 },
    );

    expect(result.processedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.totals.encashedAmount).toBe(0);
  });

  it('blocks a balance with no policy rather than closing it on a default', () => {
    // Closing against a default applies carry and encashment rules nobody
    // configured — to money.
    const result = computeClosureBatch(
      [balance({ policyId: 'pol-missing' })],
      policies,
      employees,
      { year: 2026 },
    );

    expect(result.blockedCount).toBe(1);
    expect(result.isComplete).toBe(false);
    expect(result.processedCount).toBe(0);
  });

  it('still closes a balance whose employee record is missing, at a zero rate', () => {
    // The days are the employee's whether or not their salary row loaded; a
    // rate of zero is visible in the preview, a dropped balance is not.
    const result = computeClosureBatch(
      [balance({ employeeId: 'emp-gone', currentBalance: 30 })],
      policies,
      [],
      { year: 2026 },
    );

    expect(result.processedCount).toBe(1);
    expect(result.totals.encashedDays).toBe(20);
    expect(result.totals.encashedAmount).toBe(0);
  });

  it('handles an empty tenant', () => {
    const result = computeClosureBatch([], policies, employees, { year: 2026 });

    expect(result.processedCount).toBe(0);
    expect(result.isComplete).toBe(true);
    expect(result.totals.closingBalance).toBe(0);
  });
});

describe('buildEncashmentPayrollLines', () => {
  it('produces one taxable line per employee', () => {
    const lines = buildEncashmentPayrollLines([
      {
        employeeId: 'emp-1',
        employeeName: 'A. Employee',
        leaveType: 'earned',
        encashedDays: 10,
        encashedAmount: 10000,
        rate: { perDayRate: 1000 },
      },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      employeeId: 'emp-1',
      component: 'Leave Encashment',
      isTaxable: true,
      days: 10,
      amount: 10000,
    });
  });

  it('merges an employee’s leave types into one line with a breakdown', () => {
    // A payslip carrying two "Leave Encashment" rows invites a query every
    // single time.
    const lines = buildEncashmentPayrollLines([
      {
        employeeId: 'emp-1',
        leaveType: 'earned',
        encashedDays: 10,
        encashedAmount: 10000,
        rate: { perDayRate: 1000 },
      },
      {
        employeeId: 'emp-1',
        leaveType: 'compensatory',
        encashedDays: 4,
        encashedAmount: 4000,
        rate: { perDayRate: 1000 },
      },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].days).toBe(14);
    expect(lines[0].amount).toBe(14000);
    expect(lines[0].breakdown).toHaveLength(2);
  });

  it('omits employees who encashed nothing', () => {
    const lines = buildEncashmentPayrollLines([
      { employeeId: 'emp-1', encashedDays: 0, encashedAmount: 0 },
      {
        employeeId: 'emp-2',
        encashedDays: 3,
        encashedAmount: 3000,
        rate: { perDayRate: 1000 },
      },
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0].employeeId).toBe('emp-2');
  });

  it('is deterministically ordered', () => {
    const closures = [
      {
        employeeId: 'emp-z',
        encashedDays: 1,
        encashedAmount: 1000,
        rate: { perDayRate: 1000 },
      },
      {
        employeeId: 'emp-a',
        encashedDays: 1,
        encashedAmount: 1000,
        rate: { perDayRate: 1000 },
      },
    ];

    expect(
      buildEncashmentPayrollLines(closures).map((l) => l.employeeId),
    ).toEqual(
      buildEncashmentPayrollLines([...closures].reverse()).map(
        (l) => l.employeeId,
      ),
    );
  });

  it('handles an empty close', () => {
    expect(buildEncashmentPayrollLines([])).toEqual([]);
  });
});

describe('computeStatutoryDailyRate & generateNextYearOpeningBalances', () => {
  it('computes statutory daily rate based on Basic pay', () => {
    const emp = { basicSalary: 30000, monthlySalary: 60000 };
    const rate = computeStatutoryDailyRate(emp, {});
    expect(rate).toBe(1000); // 30000 / 30
  });

  it('falls back to 50% of monthly salary when basicSalary is not explicitly stored', () => {
    const emp = { monthlySalary: 60000 };
    const rate = computeStatutoryDailyRate(emp, { basicPercentOfGross: 50 });
    expect(rate).toBe(1000); // (60000 * 0.5) / 30 = 1000
  });

  it('generates next year opening balance records from carried forward days', () => {
    const closures = [
      {
        tenantId: 'ten-1',
        employeeId: 'emp-1',
        policyId: 'pol-1',
        leaveType: 'earned',
        carriedForward: 15,
      },
      {
        tenantId: 'ten-1',
        employeeId: 'emp-2',
        policyId: 'pol-1',
        leaveType: 'earned',
        carriedForward: 0, // no carry-forward
      },
    ];

    const opening = generateNextYearOpeningBalances(closures, 2027);
    expect(opening).toHaveLength(1);
    expect(opening[0].employeeId).toBe('emp-1');
    expect(opening[0].year).toBe(2027);
    expect(opening[0].openingBalance).toBe(15);
    expect(opening[0].carriedForwardFromLastYear).toBe(15);
  });
});

