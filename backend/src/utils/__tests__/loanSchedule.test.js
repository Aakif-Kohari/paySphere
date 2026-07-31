const {
  INTEREST_METHOD,
  LOAN_STATUS,
  validateLoanInput,
  computeInstallmentAmount,
  addMonths,
  buildAmortizationSchedule,
  findRepayment,
  computeOutstanding,
  hasStarted,
  resolveDueInstallment,
  splitRepayment,
  allocateRecovery,
  applyRepayment,
  canTransitionStatus,
} = require('../loanSchedule');

const baseTerms = {
  principal: 12000,
  tenureMonths: 12,
  interestMethod: INTEREST_METHOD.NONE,
  interestRatePercent: 0,
  startMonth: 1,
  startYear: 2026,
};

const loanFrom = (overrides = {}) => {
  const built = buildAmortizationSchedule({ ...baseTerms, ...overrides });
  return {
    _id: 'loan-1',
    status: LOAN_STATUS.ACTIVE,
    principal: overrides.principal ?? baseTerms.principal,
    startMonth: overrides.startMonth ?? baseTerms.startMonth,
    startYear: overrides.startYear ?? baseTerms.startYear,
    installmentAmount: built.installmentAmount,
    totalPayable: built.totalPayable,
    schedule: built.schedule,
    repayments: [],
    ...overrides,
  };
};

describe('loanSchedule — validateLoanInput (#460)', () => {
  test('accepts sane terms', () => {
    expect(validateLoanInput(baseTerms).ok).toBe(true);
  });

  test('rejects a non-positive or absurd principal', () => {
    [0, -100, NaN, null, 'x', 999999999999].forEach((principal) => {
      expect(validateLoanInput({ ...baseTerms, principal }).ok).toBe(false);
    });
  });

  test('rejects a fractional or out-of-range tenure', () => {
    [0, -3, 1.5, 200].forEach((tenureMonths) => {
      expect(validateLoanInput({ ...baseTerms, tenureMonths }).ok).toBe(false);
    });
  });

  test('rejects an impossible interest rate', () => {
    expect(
      validateLoanInput({ ...baseTerms, interestRatePercent: 500 }).ok,
    ).toBe(false);
  });

  test('a negative rate is floored to zero rather than rejected', () => {
    const result = validateLoanInput({ ...baseTerms, interestRatePercent: -5 });
    expect(result.ok).toBe(true);
    expect(result.value.interestRatePercent).toBe(0);
  });

  test('an interest method with a zero rate collapses to an interest-free advance', () => {
    // Otherwise the reducing-balance formula divides by zero.
    const result = validateLoanInput({
      ...baseTerms,
      interestMethod: INTEREST_METHOD.REDUCING,
      interestRatePercent: 0,
    });
    expect(result.value.interestMethod).toBe(INTEREST_METHOD.NONE);
  });

  test('rejects an invalid start period', () => {
    expect(validateLoanInput({ ...baseTerms, startMonth: 13 }).ok).toBe(false);
    expect(validateLoanInput({ ...baseTerms, startYear: 1990 }).ok).toBe(false);
  });

  test('collects every error, not just the first', () => {
    const result = validateLoanInput({
      principal: -1,
      tenureMonths: 0,
      startMonth: 99,
      startYear: 1,
    });
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  test('an unknown interest method falls back to none rather than erroring', () => {
    const result = validateLoanInput({ ...baseTerms, interestMethod: 'compound' });
    expect(result.value.interestMethod).toBe(INTEREST_METHOD.NONE);
  });
});

describe('loanSchedule — computeInstallmentAmount', () => {
  test('an interest-free advance divides evenly', () => {
    expect(
      computeInstallmentAmount({
        principal: 12000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.NONE,
      }),
    ).toBe(1000);
  });

  test('flat interest spreads principal + total interest evenly', () => {
    // 12000 at 10% flat for 1 year = 1200 interest -> 13200/12 = 1100
    expect(
      computeInstallmentAmount({
        principal: 12000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.FLAT,
        interestRatePercent: 10,
      }),
    ).toBe(1100);
  });

  test('reducing balance produces a standard EMI', () => {
    const emi = computeInstallmentAmount({
      principal: 12000,
      tenureMonths: 12,
      interestMethod: INTEREST_METHOD.REDUCING,
      interestRatePercent: 12,
    });

    // Known EMI for 12000 @ 12% p.a. over 12 months.
    expect(emi).toBeCloseTo(1066.19, 1);
    // Always dearer than interest-free, cheaper than the same rate charged flat.
    expect(emi).toBeGreaterThan(1000);
    expect(emi).toBeLessThan(1120);
  });

  test('degrades to zero on nonsense rather than NaN', () => {
    expect(computeInstallmentAmount({ principal: 0, tenureMonths: 12 })).toBe(0);
    expect(computeInstallmentAmount({ principal: 1000, tenureMonths: 0 })).toBe(0);
  });
});

describe('loanSchedule — addMonths', () => {
  test('rolls over the year boundary', () => {
    expect(addMonths(11, 2026, 3)).toEqual({ month: 2, year: 2027 });
    expect(addMonths(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
    expect(addMonths(1, 2026, 0)).toEqual({ month: 1, year: 2026 });
  });

  test('handles spans longer than a year', () => {
    expect(addMonths(6, 2026, 24)).toEqual({ month: 6, year: 2028 });
  });
});

describe('loanSchedule — buildAmortizationSchedule', () => {
  test('produces one row per month of the tenure', () => {
    const built = buildAmortizationSchedule(baseTerms);
    expect(built.schedule).toHaveLength(12);
    expect(built.schedule[0]).toMatchObject({ month: 1, year: 2026 });
    expect(built.schedule[11]).toMatchObject({ month: 12, year: 2026 });
  });

  test('principal components sum to exactly the principal', () => {
    // Without the last-instalment absorption, a rounding remainder leaves the
    // loan permanently 0.01 outstanding and it never auto-completes.
    [
      { principal: 10000, tenureMonths: 3 },
      { principal: 12345.67, tenureMonths: 7 },
      { principal: 999.99, tenureMonths: 11 },
    ].forEach((terms) => {
      const built = buildAmortizationSchedule({ ...baseTerms, ...terms });
      const sum = built.schedule.reduce((s, r) => s + r.principalComponent, 0);
      expect(Math.round(sum * 100) / 100).toBe(
        Math.round(terms.principal * 100) / 100,
      );
    });
  });

  test('the closing balance reaches exactly zero', () => {
    [
      { principal: 10000, tenureMonths: 3 },
      { principal: 50000, tenureMonths: 18, interestMethod: INTEREST_METHOD.REDUCING, interestRatePercent: 9 },
      { principal: 7777, tenureMonths: 5, interestMethod: INTEREST_METHOD.FLAT, interestRatePercent: 6 },
    ].forEach((terms) => {
      const built = buildAmortizationSchedule({ ...baseTerms, ...terms });
      expect(built.schedule[built.schedule.length - 1].closingBalance).toBe(0);
    });
  });

  test('an interest-free advance charges no interest', () => {
    const built = buildAmortizationSchedule(baseTerms);
    expect(built.totalInterest).toBe(0);
    expect(built.totalPayable).toBe(12000);
    built.schedule.forEach((r) => expect(r.interestComponent).toBe(0));
  });

  test('reducing balance charges falling interest each month', () => {
    const built = buildAmortizationSchedule({
      ...baseTerms,
      interestMethod: INTEREST_METHOD.REDUCING,
      interestRatePercent: 12,
    });

    const interests = built.schedule.map((r) => r.interestComponent);
    expect(interests[0]).toBeGreaterThan(interests[11]);
    expect(built.totalInterest).toBeGreaterThan(0);
    expect(built.totalPayable).toBeGreaterThan(12000);
  });

  test('flat interest charges the same amount every month', () => {
    const built = buildAmortizationSchedule({
      ...baseTerms,
      interestMethod: INTEREST_METHOD.FLAT,
      interestRatePercent: 10,
    });

    const interests = built.schedule.slice(0, 11).map((r) => r.interestComponent);
    expect(new Set(interests).size).toBe(1);
  });

  test('a single-instalment loan is the whole principal at once', () => {
    const built = buildAmortizationSchedule({ ...baseTerms, tenureMonths: 1 });
    expect(built.schedule).toHaveLength(1);
    expect(built.schedule[0].principalComponent).toBe(12000);
    expect(built.schedule[0].closingBalance).toBe(0);
  });

  test('invalid terms return errors rather than a broken schedule', () => {
    const built = buildAmortizationSchedule({ ...baseTerms, principal: -1 });
    expect(built.ok).toBe(false);
    expect(built.schedule).toEqual([]);
    expect(built.errors.length).toBeGreaterThan(0);
  });
});

describe('loanSchedule — outstanding and lookups', () => {
  test('outstanding is derived from the repayments, not a stored field', () => {
    const loan = loanFrom({
      repayments: [
        { month: 1, year: 2026, amount: 1000 },
        { month: 2, year: 2026, amount: 1000 },
      ],
    });
    expect(computeOutstanding(loan)).toBe(10000);
  });

  test('outstanding never goes negative on an over-collection', () => {
    const loan = loanFrom({
      repayments: [{ month: 1, year: 2026, amount: 99999 }],
    });
    expect(computeOutstanding(loan)).toBe(0);
  });

  test('findRepayment matches on the period', () => {
    const loan = loanFrom({
      repayments: [{ month: 3, year: 2026, amount: 1000 }],
    });
    expect(findRepayment(loan, 3, 2026)).not.toBeNull();
    expect(findRepayment(loan, 4, 2026)).toBeNull();
    expect(findRepayment(loan, 3, 2027)).toBeNull();
  });

  test('hasStarted respects the start period', () => {
    const loan = loanFrom({ startMonth: 6, startYear: 2026 });
    expect(hasStarted(loan, 5, 2026)).toBe(false);
    expect(hasStarted(loan, 6, 2026)).toBe(true);
    expect(hasStarted(loan, 1, 2027)).toBe(true);
  });
});

describe('loanSchedule — resolveDueInstallment', () => {
  test('an active started loan owes its instalment', () => {
    const result = resolveDueInstallment(loanFrom(), 1, 2026);
    expect(result.due).toBe(1000);
    expect(result.reason).toBe('due');
  });

  test('a loan that has not started owes nothing', () => {
    const loan = loanFrom({ startMonth: 6, startYear: 2026 });
    expect(resolveDueInstallment(loan, 3, 2026)).toMatchObject({
      due: 0,
      reason: 'not_started',
    });
  });

  test('a loan on hold, cancelled or completed owes nothing', () => {
    [
      [LOAN_STATUS.ON_HOLD, 'on_hold'],
      [LOAN_STATUS.CANCELLED, 'cancelled'],
      [LOAN_STATUS.COMPLETED, 'completed'],
    ].forEach(([status, reason]) => {
      const result = resolveDueInstallment(loanFrom({ status }), 1, 2026);
      expect(result.due).toBe(0);
      expect(result.reason).toBe(reason);
    });
  });

  test('a fully repaid loan owes nothing', () => {
    const loan = loanFrom({
      repayments: [{ month: 1, year: 2026, amount: 12000 }],
    });
    expect(resolveDueInstallment(loan, 2, 2026).reason).toBe('settled');
  });

  test('the final instalment is capped at what remains', () => {
    // 11 paid, 1000 left, instalment is 1000 — but if the balance were 400 the
    // collection must be 400, not the full instalment.
    const loan = loanFrom({
      repayments: [{ month: 1, year: 2026, amount: 11600 }],
    });
    expect(resolveDueInstallment(loan, 2, 2026).due).toBe(400);
  });

  test('a period already collected reports as already recovered — this is the idempotency guard', () => {
    const loan = loanFrom({
      repayments: [{ month: 1, year: 2026, amount: 1000 }],
    });

    const result = resolveDueInstallment(loan, 1, 2026);
    expect(result.alreadyRecovered).toBe(true);
    expect(result.reason).toBe('already_recovered');
    // Reported so a re-finalised run reproduces the same row rather than
    // dropping the recovery line.
    expect(result.due).toBe(1000);
  });

  test('a missing loan is handled', () => {
    expect(resolveDueInstallment(null, 1, 2026).due).toBe(0);
  });
});

describe('loanSchedule — splitRepayment', () => {
  test('uses the schedule row for the period', () => {
    const loan = loanFrom({
      interestMethod: INTEREST_METHOD.REDUCING,
      interestRatePercent: 12,
    });
    const split = splitRepayment(loan, 1, 2026, loan.installmentAmount);

    expect(split.interestComponent).toBeGreaterThan(0);
    expect(split.principalComponent + split.interestComponent).toBeCloseTo(
      loan.installmentAmount,
      2,
    );
  });

  test('a partial collection pays interest first', () => {
    const loan = loanFrom({
      interestMethod: INTEREST_METHOD.REDUCING,
      interestRatePercent: 12,
    });
    const split = splitRepayment(loan, 1, 2026, 50);

    expect(split.interestComponent).toBe(50);
    expect(split.principalComponent).toBe(0);
  });

  test('an off-schedule period is treated as all principal', () => {
    const split = splitRepayment(loanFrom(), 9, 2030, 500);
    expect(split.principalComponent).toBe(500);
    expect(split.interestComponent).toBe(0);
  });
});

describe('loanSchedule — allocateRecovery', () => {
  test('collects the full instalment when the salary covers it', () => {
    const result = allocateRecovery({
      loans: [loanFrom()],
      month: 1,
      year: 2026,
      availableForRecovery: 30000,
    });

    expect(result.totalRecovered).toBe(1000);
    expect(result.shortfall).toBe(0);
  });

  test('caps recovery at the affordable amount and reports the shortfall', () => {
    // Recovery must never drive net salary below zero.
    const result = allocateRecovery({
      loans: [loanFrom()],
      month: 1,
      year: 2026,
      availableForRecovery: 300,
    });

    expect(result.totalRecovered).toBe(300);
    expect(result.shortfall).toBe(700);
    expect(result.recoveries[0].shortfall).toBe(700);
  });

  test('collects nothing when there is nothing to take', () => {
    const result = allocateRecovery({
      loans: [loanFrom()],
      month: 1,
      year: 2026,
      availableForRecovery: 0,
    });

    expect(result.totalRecovered).toBe(0);
    expect(result.shortfall).toBe(1000);
  });

  test('splits a limited budget across loans, oldest first', () => {
    const older = loanFrom({ _id: 'older', startMonth: 1, startYear: 2026 });
    const newer = loanFrom({ _id: 'newer', startMonth: 6, startYear: 2026 });

    const result = allocateRecovery({
      loans: [newer, older],
      month: 6,
      year: 2026,
      availableForRecovery: 1500,
    });

    expect(result.recoveries[0].loanId).toBe('older');
    expect(result.recoveries[0].amount).toBe(1000);
    expect(result.recoveries[1].amount).toBe(500);
    expect(result.totalRecovered).toBe(1500);
  });

  test('skips loans that owe nothing this month', () => {
    const result = allocateRecovery({
      loans: [
        loanFrom({ _id: 'held', status: LOAN_STATUS.ON_HOLD }),
        loanFrom({ _id: 'future', startMonth: 11, startYear: 2026 }),
      ],
      month: 1,
      year: 2026,
      availableForRecovery: 30000,
    });

    expect(result.recoveries).toHaveLength(0);
    expect(result.totalRecovered).toBe(0);
  });

  test('an already-collected period is reproduced in full and not re-capped', () => {
    const loan = loanFrom({
      repayments: [{ month: 1, year: 2026, amount: 1000 }],
    });

    const result = allocateRecovery({
      loans: [loan],
      month: 1,
      year: 2026,
      availableForRecovery: 10, // would normally cap it to 10
    });

    expect(result.recoveries[0].alreadyRecovered).toBe(true);
    expect(result.recoveries[0].amount).toBe(1000);
  });

  test('an empty or missing loan list is handled', () => {
    [[], null, undefined].forEach((loans) => {
      const result = allocateRecovery({
        loans,
        month: 1,
        year: 2026,
        availableForRecovery: 5000,
      });
      expect(result.totalRecovered).toBe(0);
      expect(result.recoveries).toEqual([]);
    });
  });
});

describe('loanSchedule — applyRepayment', () => {
  test('appends a new period and updates the balance', () => {
    const loan = loanFrom();
    const applied = applyRepayment(loan, { month: 1, year: 2026, amount: 1000 });

    expect(applied.repayments).toHaveLength(1);
    expect(applied.totalRepaid).toBe(1000);
    expect(applied.outstanding).toBe(11000);
    expect(applied.status).toBe(LOAN_STATUS.ACTIVE);
  });

  test('re-applying the same period replaces rather than appends — no double collection', () => {
    // The approval flow allows a rejected run to be re-submitted, so the same
    // month can be finalised more than once.
    const loan = loanFrom();
    const first = applyRepayment(loan, { month: 1, year: 2026, amount: 1000 });
    const second = applyRepayment(
      { ...loan, repayments: first.repayments },
      { month: 1, year: 2026, amount: 1000 },
    );

    expect(second.repayments).toHaveLength(1);
    expect(second.totalRepaid).toBe(1000);
    expect(second.outstanding).toBe(11000);
  });

  test('does not mutate the input loan', () => {
    const loan = loanFrom();
    applyRepayment(loan, { month: 1, year: 2026, amount: 1000 });
    expect(loan.repayments).toHaveLength(0);
  });

  test('auto-completes when the balance reaches zero', () => {
    // Otherwise a settled loan keeps being recovered until someone remembers
    // to close it — the exact failure this feature exists to prevent.
    const loan = loanFrom();
    const applied = applyRepayment(loan, { month: 1, year: 2026, amount: 12000 });

    expect(applied.outstanding).toBe(0);
    expect(applied.status).toBe(LOAN_STATUS.COMPLETED);
  });

  test('keeps the ledger in period order', () => {
    let repayments = [];
    [
      { month: 3, year: 2026 },
      { month: 1, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
    ].forEach((period) => {
      repayments = applyRepayment(
        { ...loanFrom(), repayments },
        { ...period, amount: 100 },
      ).repayments;
    });

    const order = repayments.map((r) => `${r.year}-${r.month}`);
    expect(order).toEqual(['2026-1', '2026-3', '2026-12', '2027-1']);
  });

  test('does not resurrect a cancelled loan', () => {
    const loan = loanFrom({ status: LOAN_STATUS.CANCELLED });
    const applied = applyRepayment(loan, { month: 1, year: 2026, amount: 100 });
    expect(applied.status).toBe(LOAN_STATUS.CANCELLED);
  });
});

describe('loanSchedule — canTransitionStatus', () => {
  test('an active loan can be held, cancelled or completed', () => {
    expect(canTransitionStatus(LOAN_STATUS.ACTIVE, LOAN_STATUS.ON_HOLD)).toBe(true);
    expect(canTransitionStatus(LOAN_STATUS.ACTIVE, LOAN_STATUS.CANCELLED)).toBe(true);
    expect(canTransitionStatus(LOAN_STATUS.ACTIVE, LOAN_STATUS.COMPLETED)).toBe(true);
  });

  test('a held loan can resume or be cancelled, but not jump to completed', () => {
    expect(canTransitionStatus(LOAN_STATUS.ON_HOLD, LOAN_STATUS.ACTIVE)).toBe(true);
    expect(canTransitionStatus(LOAN_STATUS.ON_HOLD, LOAN_STATUS.CANCELLED)).toBe(true);
    expect(canTransitionStatus(LOAN_STATUS.ON_HOLD, LOAN_STATUS.COMPLETED)).toBe(false);
  });

  test('completed and cancelled are terminal', () => {
    // Reopening a settled loan would let an employer resume collecting against
    // a balance of zero.
    [LOAN_STATUS.COMPLETED, LOAN_STATUS.CANCELLED].forEach((terminal) => {
      Object.values(LOAN_STATUS)
        .filter((s) => s !== terminal)
        .forEach((target) => {
          expect(canTransitionStatus(terminal, target)).toBe(false);
        });
    });
  });

  test('a no-op transition is allowed', () => {
    Object.values(LOAN_STATUS).forEach((status) => {
      expect(canTransitionStatus(status, status)).toBe(true);
    });
  });
});
