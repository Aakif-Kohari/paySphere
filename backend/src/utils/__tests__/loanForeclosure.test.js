/**
 * Early-closure arithmetic (#1155).
 *
 * The property that matters throughout is that closure is priced from the
 * *principal*: an employee closing a 12-month loan in month 3 must not be
 * charged the nine months of interest the original schedule projected. Every
 * assertion below is ultimately about that, or about the rounding invariant
 * that lets a rebuilt schedule still close at exactly zero.
 */

const {
  PREPAYMENT_STRATEGY,
  MAX_FORECLOSURE_CHARGE_PERCENT,
  computePrincipalRepaid,
  computeInterestPaid,
  computePrincipalOutstanding,
  computeAccruedInterest,
  resolveAsOfPeriod,
  validateForeclosureRequest,
  computeForeclosureQuote,
  solveTenureMonths,
  reamortizeSchedule,
  applyForeclosure,
  computeExitClearance,
} = require('../loanForeclosure');

const {
  LOAN_STATUS,
  INTEREST_METHOD,
  buildAmortizationSchedule,
} = require('../loanSchedule');

/**
 * A loan document as the service would have written it, with `paidUpto`
 * instalments already collected against it.
 *
 * Built through `buildAmortizationSchedule` rather than hand-written so the
 * fixture and production agree on the table — a hand-written schedule would
 * pass tests that the real one fails.
 */
function makeLoan({
  principal = 120000,
  tenureMonths = 12,
  interestMethod = INTEREST_METHOD.REDUCING,
  interestRatePercent = 12,
  startMonth = 1,
  startYear = 2026,
  paidUpto = 0,
  status = LOAN_STATUS.ACTIVE,
} = {}) {
  const built = buildAmortizationSchedule({
    principal,
    tenureMonths,
    interestMethod,
    interestRatePercent,
    startMonth,
    startYear,
  });

  const repayments = built.schedule.slice(0, paidUpto).map((row) => ({
    month: row.month,
    year: row.year,
    amount: row.amount,
    principalComponent: row.principalComponent,
    interestComponent: row.interestComponent,
  }));

  return {
    _id: 'loan-1',
    principal,
    tenureMonths,
    interestMethod,
    interestRatePercent,
    startMonth,
    startYear,
    installmentAmount: built.installmentAmount,
    totalPayable: built.totalPayable,
    totalInterest: built.totalInterest,
    schedule: built.schedule,
    repayments,
    totalRepaid: repayments.reduce((sum, r) => sum + r.amount, 0),
    status,
  };
}

describe('ledger derivation', () => {
  it('sums principal and interest components separately', () => {
    const loan = makeLoan({ paidUpto: 3 });

    const expectedPrincipal = loan.schedule
      .slice(0, 3)
      .reduce((sum, row) => sum + row.principalComponent, 0);

    expect(computePrincipalRepaid(loan)).toBeCloseTo(expectedPrincipal, 2);
    expect(computeInterestPaid(loan)).toBeGreaterThan(0);
  });

  it('treats a legacy repayment with no split as pure principal', () => {
    // Rows written before splitRepayment() existed carry only `amount`.
    // Counting those as interest would leave a principal balance that never
    // moves, and the employee would be quoted the full principal for ever.
    const loan = makeLoan({ paidUpto: 0 });
    loan.repayments = [{ month: 1, year: 2026, amount: 10000 }];

    expect(computePrincipalRepaid(loan)).toBe(10000);
    expect(computeInterestPaid(loan)).toBe(0);
  });

  it('never reports a negative principal outstanding', () => {
    const loan = makeLoan({ principal: 1000, paidUpto: 0 });
    loan.repayments = [{ month: 1, year: 2026, amount: 5000 }];

    expect(computePrincipalOutstanding(loan)).toBe(0);
  });

  it('accrues interest only up to the as-of period', () => {
    const loan = makeLoan({ paidUpto: 0 });

    const throughMonth3 = computeAccruedInterest(loan, 3, 2026);
    const throughMonth12 = computeAccruedInterest(loan, 12, 2026);

    expect(throughMonth3).toBeGreaterThan(0);
    expect(throughMonth3).toBeLessThan(throughMonth12);
    expect(throughMonth12).toBeCloseTo(loan.totalInterest, 2);
  });
});

describe('resolveAsOfPeriod', () => {
  it('defaults to the last period actually collected', () => {
    // Not "today": a loan whose recovery is a month behind would otherwise be
    // charged a month of interest that has never been billed.
    const loan = makeLoan({ paidUpto: 4 });

    expect(resolveAsOfPeriod(loan)).toEqual({ asOfMonth: 4, asOfYear: 2026 });
  });

  it('falls back to the loan start when nothing has been collected', () => {
    const loan = makeLoan({ paidUpto: 0, startMonth: 7, startYear: 2026 });

    expect(resolveAsOfPeriod(loan)).toEqual({ asOfMonth: 7, asOfYear: 2026 });
  });

  it('honours an explicit period', () => {
    const loan = makeLoan({ paidUpto: 4 });

    expect(resolveAsOfPeriod(loan, { asOfMonth: 9, asOfYear: 2027 })).toEqual({
      asOfMonth: 9,
      asOfYear: 2027,
    });
  });
});

describe('validateForeclosureRequest', () => {
  it.each([
    LOAN_STATUS.COMPLETED,
    LOAN_STATUS.CANCELLED,
    LOAN_STATUS.FORECLOSED,
  ])('refuses a loan that is already %s', (status) => {
    const result = validateForeclosureRequest(
      makeLoan({ status, paidUpto: 2 }),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(status);
  });

  it('refuses a loan with no principal left', () => {
    const loan = makeLoan({ tenureMonths: 3, paidUpto: 3 });

    const result = validateForeclosureRequest(loan);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Loan has no outstanding principal to foreclose',
    );
  });

  it('caps the foreclosure charge', () => {
    const result = validateForeclosureRequest(makeLoan({ paidUpto: 2 }), {
      foreclosureChargePercent: MAX_FORECLOSURE_CHARGE_PERCENT + 1,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('cannot exceed');
  });

  it('refuses closure before the loan has started', () => {
    const loan = makeLoan({ paidUpto: 0, startMonth: 6, startYear: 2026 });

    const result = validateForeclosureRequest(loan, {
      asOfMonth: 3,
      asOfYear: 2026,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Cannot foreclose before the loan has started',
    );
  });

  it('reports every problem at once rather than the first', () => {
    const loan = makeLoan({ status: LOAN_STATUS.CANCELLED, paidUpto: 2 });

    const result = validateForeclosureRequest(loan, {
      foreclosureChargePercent: 90,
    });

    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('computeForeclosureQuote', () => {
  it('rebates the interest on months the money will not be outstanding', () => {
    // The whole point of #1155. computeOutstanding() would quote
    // totalPayable - repaid, which carries nine months of unearned interest.
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const quote = computeForeclosureQuote(loan);

    expect(quote.ok).toBe(true);
    expect(quote.interestRebate).toBeGreaterThan(0);
    expect(quote.netPayable).toBeLessThan(quote.naiveOutstanding);
    expect(quote.savingVsNaive).toBeCloseTo(
      quote.naiveOutstanding - quote.netPayable,
      2,
    );
  });

  it('prices an interest-free advance at exactly the principal left', () => {
    const loan = makeLoan({
      principal: 60000,
      tenureMonths: 6,
      interestMethod: INTEREST_METHOD.NONE,
      interestRatePercent: 0,
      paidUpto: 2,
    });

    const quote = computeForeclosureQuote(loan);

    expect(quote.isInterestBearing).toBe(false);
    expect(quote.interestRebate).toBe(0);
    expect(quote.netPayable).toBe(quote.principalOutstanding);
    // Nothing to rebate, so the old arithmetic happened to be right here.
    expect(quote.netPayable).toBeCloseTo(quote.naiveOutstanding, 2);
  });

  it('charges accrued-but-uncollected interest', () => {
    // Priced two months past the last recovery: the interest for those months
    // has accrued and has not been billed, so it is owed.
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const atLastRecovery = computeForeclosureQuote(loan);
    const twoMonthsLater = computeForeclosureQuote(loan, {
      asOfMonth: 5,
      asOfYear: 2026,
    });

    expect(atLastRecovery.interestDueNow).toBe(0);
    expect(twoMonthsLater.interestDueNow).toBeGreaterThan(0);
    expect(twoMonthsLater.netPayable).toBeGreaterThan(
      atLastRecovery.netPayable,
    );
  });

  it('applies the foreclosure charge to the principal outstanding', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const free = computeForeclosureQuote(loan);
    const charged = computeForeclosureQuote(loan, {
      foreclosureChargePercent: 2,
    });

    expect(charged.foreclosureCharge).toBeCloseTo(
      (free.principalOutstanding * 2) / 100,
      2,
    );
    expect(charged.netPayable).toBeCloseTo(
      free.netPayable + charged.foreclosureCharge,
      2,
    );
  });

  it('returns the validation errors rather than a price when it cannot quote', () => {
    const quote = computeForeclosureQuote(
      makeLoan({ status: LOAN_STATUS.CANCELLED, paidUpto: 1 }),
    );

    expect(quote.ok).toBe(false);
    expect(quote.netPayable).toBeUndefined();
    expect(quote.errors.length).toBeGreaterThan(0);
  });
});

describe('solveTenureMonths', () => {
  it('divides evenly when there is no interest', () => {
    expect(solveTenureMonths(10000, 2500, 0)).toBe(4);
  });

  it('rounds a part month up rather than dropping it', () => {
    expect(solveTenureMonths(10000, 3000, 0)).toBe(4);
  });

  it('refuses an instalment that does not cover the first month of interest', () => {
    // Otherwise the balance grows for ever and the inversion returns NaN.
    expect(solveTenureMonths(100000, 500, 0.01)).toBe(0);
  });

  it('needs more months with interest than without', () => {
    const withoutInterest = solveTenureMonths(120000, 11000, 0);
    const withInterest = solveTenureMonths(120000, 11000, 0.01);

    expect(withInterest).toBeGreaterThanOrEqual(withoutInterest);
  });
});

describe('reamortizeSchedule', () => {
  const effective = { effectiveMonth: 4, effectiveYear: 2026 };

  it('shortens the tenure and keeps the instalment under reduce_tenure', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const result = reamortizeSchedule(loan, {
      ...effective,
      prepaymentAmount: 30000,
      strategy: PREPAYMENT_STRATEGY.REDUCE_TENURE,
    });

    expect(result.ok).toBe(true);
    // Eight instalments were still to run (May–Dec); the lump sum buys some of
    // them back.
    expect(result.schedule.length).toBeLessThan(8);
    expect(result.monthsSaved).toBeGreaterThan(0);
    expect(result.installmentAmount).toBeLessThanOrEqual(
      loan.installmentAmount,
    );
  });

  it('keeps the tenure and lowers the instalment under reduce_installment', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const result = reamortizeSchedule(loan, {
      ...effective,
      prepaymentAmount: 30000,
      strategy: PREPAYMENT_STRATEGY.REDUCE_INSTALLMENT,
    });

    expect(result.ok).toBe(true);
    // Eight instalments were still to run (May–Dec); all eight survive, each
    // for less.
    expect(result.schedule).toHaveLength(8);
    expect(result.monthsSaved).toBe(0);
    expect(result.installmentReduction).toBeGreaterThan(0);
  });

  it('rebuilds a table whose principal components still sum to the balance', () => {
    // The invariant buildAmortizationSchedule() exists to hold: without the
    // last row absorbing the drift, a rebuilt schedule leaves paise
    // outstanding for ever and the loan never auto-completes.
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const result = reamortizeSchedule(loan, {
      ...effective,
      prepaymentAmount: 17777.77,
      strategy: PREPAYMENT_STRATEGY.REDUCE_INSTALLMENT,
    });

    const principalSum = result.schedule.reduce(
      (sum, row) => sum + row.principalComponent,
      0,
    );

    expect(principalSum).toBeCloseTo(result.remainingPrincipal, 2);
    expect(result.schedule[result.schedule.length - 1].closingBalance).toBe(0);
  });

  it('starts the rebuilt table the month after the lump sum', () => {
    // Re-issuing the effective period would have splitRepayment() apportion it
    // twice.
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const result = reamortizeSchedule(loan, {
      ...effective,
      prepaymentAmount: 20000,
      strategy: PREPAYMENT_STRATEGY.REDUCE_INSTALLMENT,
    });

    expect(result.schedule[0]).toMatchObject({ month: 5, year: 2026 });
  });

  it('rolls the year over when the lump sum lands in December', () => {
    const loan = makeLoan({ tenureMonths: 24, paidUpto: 11 });

    const result = reamortizeSchedule(loan, {
      effectiveMonth: 12,
      effectiveYear: 2026,
      prepaymentAmount: 10000,
      strategy: PREPAYMENT_STRATEGY.REDUCE_INSTALLMENT,
    });

    expect(result.schedule[0]).toMatchObject({ month: 1, year: 2027 });
  });

  it('refuses a prepayment above the principal outstanding', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });

    const result = reamortizeSchedule(loan, {
      ...effective,
      prepaymentAmount: 500000,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Use foreclosure');
  });

  it('closes the loan when the lump sum clears the principal exactly', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });
    const outstanding = computePrincipalOutstanding(loan);

    const result = reamortizeSchedule(loan, {
      ...effective,
      prepaymentAmount: outstanding,
    });

    expect(result.ok).toBe(true);
    expect(result.closesLoan).toBe(true);
    expect(result.schedule).toHaveLength(0);
  });

  it('rejects an unknown strategy', () => {
    const result = reamortizeSchedule(makeLoan({ paidUpto: 3 }), {
      ...effective,
      prepaymentAmount: 1000,
      strategy: 'whatever',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Strategy must be one of');
  });

  it('refuses to re-amortise a terminal loan', () => {
    const result = reamortizeSchedule(
      makeLoan({ status: LOAN_STATUS.COMPLETED, paidUpto: 3 }),
      { ...effective, prepaymentAmount: 1000 },
    );

    expect(result.ok).toBe(false);
  });
});

describe('applyForeclosure', () => {
  it('closes the balance and truncates the schedule', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });
    const quote = computeForeclosureQuote(loan);

    const applied = applyForeclosure(loan, quote);

    expect(applied.ok).toBe(true);
    expect(applied.outstanding).toBe(0);
    expect(applied.status).toBe(LOAN_STATUS.FORECLOSED);
    // Rows past the closure period describe instalments that will never be
    // collected.
    expect(applied.schedule).toHaveLength(3);
  });

  it('replaces rather than appends when the closure period is already in the ledger', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });
    const quote = computeForeclosureQuote(loan);

    const applied = applyForeclosure(loan, quote);

    // Three instalments, the last of which became the closing entry.
    expect(applied.repayments).toHaveLength(3);
    expect(applied.repayments[2].amount).toBe(quote.netPayable);
  });

  it('does not fold the closure charge into principal or interest', () => {
    // Folding it in would overstate the principal repaid on a loan whose
    // principal was, by definition, exactly cleared.
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });
    const quote = computeForeclosureQuote(loan, {
      foreclosureChargePercent: 2,
    });

    const applied = applyForeclosure(loan, quote);
    const closing = applied.repayments[applied.repayments.length - 1];

    expect(closing.principalComponent).toBe(quote.principalOutstanding);
    expect(closing.interestComponent).toBe(quote.interestDueNow);
    expect(closing.amount).toBeCloseTo(
      closing.principalComponent +
        closing.interestComponent +
        quote.foreclosureCharge,
      2,
    );
  });

  it('does not mutate the loan it was given', () => {
    const loan = makeLoan({ tenureMonths: 12, paidUpto: 3 });
    const before = loan.repayments.length;

    applyForeclosure(loan, computeForeclosureQuote(loan));

    expect(loan.repayments).toHaveLength(before);
    expect(loan.status).toBe(LOAN_STATUS.ACTIVE);
  });

  it('refuses to apply a quote that failed to price', () => {
    const loan = makeLoan({ status: LOAN_STATUS.CANCELLED, paidUpto: 1 });

    const applied = applyForeclosure(loan, computeForeclosureQuote(loan));

    expect(applied.ok).toBe(false);
  });
});

describe('computeExitClearance', () => {
  it('totals the closure figure across a leaver’s open loans', () => {
    const loans = [
      makeLoan({ principal: 120000, tenureMonths: 12, paidUpto: 3 }),
      makeLoan({
        principal: 60000,
        tenureMonths: 6,
        interestMethod: INTEREST_METHOD.NONE,
        interestRatePercent: 0,
        paidUpto: 2,
      }),
    ];

    const clearance = computeExitClearance(loans);

    expect(clearance.loanCount).toBe(2);
    expect(clearance.isClearable).toBe(true);
    expect(clearance.totalClearanceAmount).toBeCloseTo(
      clearance.quotes.reduce((sum, q) => sum + q.netPayable, 0),
      2,
    );
  });

  it('skips loans that are already closed', () => {
    const clearance = computeExitClearance([
      makeLoan({ status: LOAN_STATUS.COMPLETED, paidUpto: 3 }),
      makeLoan({ status: LOAN_STATUS.FORECLOSED, paidUpto: 3 }),
    ]);

    expect(clearance.loanCount).toBe(0);
    expect(clearance.blocked).toHaveLength(0);
    expect(clearance.isClearable).toBe(true);
  });

  it('reports a loan it could not price rather than dropping it', () => {
    // A settlement that cannot be completed has to say why; silently omitting
    // the loan would under-recover the leaver's balance.
    const unpriceable = makeLoan({ tenureMonths: 3, paidUpto: 3 });
    unpriceable.status = LOAN_STATUS.ACTIVE;

    const clearance = computeExitClearance([unpriceable]);

    expect(clearance.isClearable).toBe(false);
    expect(clearance.blocked).toHaveLength(1);
    expect(clearance.blocked[0].reasons.length).toBeGreaterThan(0);
  });

  it('handles an employee with no loans', () => {
    const clearance = computeExitClearance([]);

    expect(clearance.loanCount).toBe(0);
    expect(clearance.totalClearanceAmount).toBe(0);
    expect(clearance.isClearable).toBe(true);
  });
});
