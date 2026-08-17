/**
 * Early closure of a salary advance or loan: foreclosure quotes, part
 * prepayment, schedule re-amortisation and exit clearance.
 *
 * Pure functions — no database access — for the same reason `loanSchedule.js`
 * is pure: the money arithmetic here decides what an employee is charged to
 * close a loan, and that has to be testable against its boundaries in
 * isolation (#1155).
 *
 * `loanSchedule.js` builds a table at issue time and collects one row of it per
 * payroll month. It has no notion of stopping early. The two things that
 * follow from that are both wrong in the employee's disfavour:
 *
 *   - `computeOutstanding()` returns `totalPayable - repaid`, and `totalPayable`
 *     includes interest for every month of the original tenure. Quoting that
 *     to close a 12-month loan in month 3 charges nine months of interest on
 *     money that will not be outstanding for those nine months.
 *   - `recordManualRepayment` appends a lump sum to the ledger and leaves the
 *     stored `schedule` untouched, so `splitRepayment()` keeps apportioning
 *     later recoveries against rows that no longer describe the loan.
 *
 * This module fixes the first by pricing closure from the principal, and the
 * second by rebuilding the remaining rows.
 */

const {
  INTEREST_METHOD,
  LOAN_STATUS,
  buildAmortizationSchedule,
  addMonths,
  round2,
} = require('./loanSchedule');

/**
 * What a part-prepayment does to the rest of the loan.
 *
 * Both are conventional and neither is a safe default for the other: shortening
 * the tenure is what a borrower closing out early usually wants, lowering the
 * instalment is what somebody easing monthly pressure wants. The caller says
 * which.
 */
const PREPAYMENT_STRATEGY = {
  /** Keep the instalment, finish sooner. */
  REDUCE_TENURE: 'reduce_tenure',
  /** Keep the tenure, collect less each month. */
  REDUCE_INSTALLMENT: 'reduce_installment',
};

/**
 * A ceiling on the closure fee, so a policy value entered as `50` meaning
 * "fifty rupees" cannot be applied as fifty percent of the principal.
 */
const MAX_FORECLOSURE_CHARGE_PERCENT = 5;

/** Terminal states. Nothing here can be closed, prepaid or re-amortised. */
const TERMINAL_STATUSES = [
  LOAN_STATUS.COMPLETED,
  LOAN_STATUS.CANCELLED,
  LOAN_STATUS.FORECLOSED,
];

/**
 * A {month, year} pair as one comparable number.
 *
 * Same device `loanSchedule.js` uses for `hasStarted()`. Comparing the parts
 * separately is where off-by-one-year bugs come from.
 *
 * @param {number} month 1-12
 * @param {number} year
 * @returns {number}
 */
function periodPoint(month, year) {
  return Number(year) * 12 + Number(month);
}

/**
 * The repayment ledger as an array, whatever shape it arrived in.
 *
 * Mongoose gives a DocumentArray, a unit test gives a plain array, and a loan
 * that has never been collected against gives `undefined`.
 *
 * @param {object} loan
 * @returns {object[]}
 */
function ledgerOf(loan) {
  return Array.isArray(loan?.repayments) ? loan.repayments : [];
}

/**
 * The projected schedule as an array.
 *
 * @param {object} loan
 * @returns {object[]}
 */
function scheduleOf(loan) {
  return Array.isArray(loan?.schedule) ? loan.schedule : [];
}

/**
 * How much of the principal has actually been repaid.
 *
 * Reads `principalComponent` where the ledger has one and falls back to the
 * gross amount where it does not. Rows written before `splitRepayment()`
 * existed carry only `amount`, and treating those as pure interest would
 * report a principal balance that never moves.
 *
 * @param {object} loan
 * @returns {number}
 */
function computePrincipalRepaid(loan) {
  return round2(
    ledgerOf(loan).reduce((sum, entry) => {
      const split = Number(entry?.principalComponent);
      if (Number.isFinite(split)) return sum + split;
      return sum + (Number(entry?.amount) || 0);
    }, 0),
  );
}

/**
 * How much interest has actually been collected.
 *
 * @param {object} loan
 * @returns {number}
 */
function computeInterestPaid(loan) {
  return round2(
    ledgerOf(loan).reduce(
      (sum, entry) => sum + (Number(entry?.interestComponent) || 0),
      0,
    ),
  );
}

/**
 * The principal still owed.
 *
 * This — not `computeOutstanding()` — is what closure is priced from. The
 * difference between the two is exactly the unaccrued interest this module
 * exists to rebate.
 *
 * @param {object} loan
 * @returns {number}
 */
function computePrincipalOutstanding(loan) {
  const principal = Number(loan?.principal) || 0;
  return round2(Math.max(principal - computePrincipalRepaid(loan), 0));
}

/**
 * Interest the schedule says has accrued up to and including a period.
 *
 * Derived from the frozen schedule rather than recomputed, so the quote and
 * the instalments the employee has already been charged are describing the
 * same loan. Recomputing would drift from it by the rounding the schedule
 * absorbed at issue time.
 *
 * @param {object} loan
 * @param {number} month
 * @param {number} year
 * @returns {number}
 */
function computeAccruedInterest(loan, month, year) {
  const cutoff = periodPoint(month, year);

  return round2(
    scheduleOf(loan)
      .filter((row) => periodPoint(row.month, row.year) <= cutoff)
      .reduce((sum, row) => sum + (Number(row.interestComponent) || 0), 0),
  );
}

/**
 * Reject a closure that cannot legally or arithmetically happen.
 *
 * Collects every problem rather than returning at the first, so a controller
 * can answer with all of them at once — the convention `validateLoanInput()`
 * already set.
 *
 * @param {object} loan
 * @param {object} [options]
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateForeclosureRequest(loan, options = {}) {
  const errors = [];

  if (!loan) {
    return { ok: false, errors: ['Loan not found'] };
  }

  if (TERMINAL_STATUSES.includes(loan.status)) {
    errors.push(`A loan that is "${loan.status}" cannot be foreclosed`);
  }

  if (computePrincipalOutstanding(loan) <= 0) {
    errors.push('Loan has no outstanding principal to foreclose');
  }

  const charge = Number(options.foreclosureChargePercent ?? 0);
  if (!Number.isFinite(charge) || charge < 0) {
    errors.push('Foreclosure charge percent must be zero or a positive number');
  } else if (charge > MAX_FORECLOSURE_CHARGE_PERCENT) {
    errors.push(
      `Foreclosure charge cannot exceed ${MAX_FORECLOSURE_CHARGE_PERCENT}%`,
    );
  }

  const { asOfMonth, asOfYear } = resolveAsOfPeriod(loan, options);

  if (!Number.isInteger(asOfMonth) || asOfMonth < 1 || asOfMonth > 12) {
    errors.push('As-of month must be an integer between 1 and 12');
  }

  if (!Number.isInteger(asOfYear) || asOfYear < 2000 || asOfYear > 2100) {
    errors.push('As-of year must be a valid year');
  }

  // Closing before the loan has disbursed is not an early closure, it is a
  // cancellation — a different act with a different terminal status.
  if (
    loan.startMonth &&
    loan.startYear &&
    periodPoint(asOfMonth, asOfYear) <
      periodPoint(loan.startMonth, loan.startYear)
  ) {
    errors.push('Cannot foreclose before the loan has started');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * The period a quote is priced as at, defaulting to the last period the loan
 * was actually collected for.
 *
 * Defaulting to "today" would be wrong for a loan whose recovery is a month
 * behind: it would charge a month of interest that has not been billed.
 *
 * @param {object} loan
 * @param {object} [options]
 * @returns {{asOfMonth: number, asOfYear: number}}
 */
function resolveAsOfPeriod(loan, options = {}) {
  if (options.asOfMonth !== undefined && options.asOfYear !== undefined) {
    return {
      asOfMonth: Number(options.asOfMonth),
      asOfYear: Number(options.asOfYear),
    };
  }

  const ledger = ledgerOf(loan);

  if (ledger.length) {
    const latest = ledger.reduce((acc, entry) =>
      periodPoint(entry.month, entry.year) > periodPoint(acc.month, acc.year)
        ? entry
        : acc,
    );
    return { asOfMonth: Number(latest.month), asOfYear: Number(latest.year) };
  }

  // Nothing collected yet: price as at the first scheduled instalment.
  return {
    asOfMonth: Number(loan?.startMonth) || 1,
    asOfYear: Number(loan?.startYear) || 2000,
  };
}

/**
 * Price the closure of a loan.
 *
 * The quote is built from the principal outstanding plus interest that has
 * genuinely accrued, so interest for months the money will not be outstanding
 * is rebated rather than charged. For an interest-free advance the rebate is
 * zero and the quote is simply the principal left.
 *
 * `naiveOutstanding` is returned alongside deliberately: it is what
 * `computeOutstanding()` would have quoted, and the difference between the two
 * is the number this feature exists to stop charging.
 *
 * @param {object} loan
 * @param {object} [options]
 * @param {number} [options.asOfMonth]
 * @param {number} [options.asOfYear]
 * @param {number} [options.foreclosureChargePercent=0]
 * @returns {object} the priced quote
 */
function computeForeclosureQuote(loan, options = {}) {
  const validation = validateForeclosureRequest(loan, options);

  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const { asOfMonth, asOfYear } = resolveAsOfPeriod(loan, options);

  const principalOutstanding = computePrincipalOutstanding(loan);
  const interestPaid = computeInterestPaid(loan);
  const accruedInterest = computeAccruedInterest(loan, asOfMonth, asOfYear);

  // Interest that has accrued but has not yet been collected — the part-month
  // between the last recovery and the closure date.
  const interestDueNow = round2(Math.max(accruedInterest - interestPaid, 0));

  const totalInterest = Number(loan.totalInterest) || 0;
  const interestRebate = round2(Math.max(totalInterest - accruedInterest, 0));

  const chargePercent = Number(options.foreclosureChargePercent ?? 0) || 0;
  const foreclosureCharge = round2(
    (principalOutstanding * chargePercent) / 100,
  );

  const netPayable = round2(
    principalOutstanding + interestDueNow + foreclosureCharge,
  );

  const totalRepaid = round2(
    ledgerOf(loan).reduce(
      (sum, entry) => sum + (Number(entry?.amount) || 0),
      0,
    ),
  );
  const naiveOutstanding = round2(
    Math.max((Number(loan.totalPayable) || 0) - totalRepaid, 0),
  );

  return {
    ok: true,
    errors: [],
    asOfMonth,
    asOfYear,
    principal: round2(Number(loan.principal) || 0),
    principalRepaid: computePrincipalRepaid(loan),
    principalOutstanding,
    interestPaid,
    accruedInterest,
    interestDueNow,
    interestRebate,
    foreclosureChargePercent: chargePercent,
    foreclosureCharge,
    netPayable,
    // What the old arithmetic would have asked for, and what it saves.
    naiveOutstanding,
    savingVsNaive: round2(Math.max(naiveOutstanding - netPayable, 0)),
    isInterestBearing:
      (loan.interestMethod || INTEREST_METHOD.NONE) !== INTEREST_METHOD.NONE,
  };
}

/**
 * The smallest whole number of months that clears a balance at a given
 * instalment.
 *
 * For a reducing-balance loan this is the standard NPER inversion. An
 * instalment that does not cover the first month's interest never clears the
 * balance at all, so it is rejected rather than returned as `Infinity`.
 *
 * @param {number} principal
 * @param {number} installment
 * @param {number} monthlyRate
 * @returns {number} months, or 0 when the balance can never be cleared
 */
function solveTenureMonths(principal, installment, monthlyRate) {
  if (!(principal > 0) || !(installment > 0)) return 0;

  if (!monthlyRate) {
    return Math.ceil(principal / installment);
  }

  const firstMonthInterest = principal * monthlyRate;
  if (installment <= firstMonthInterest) return 0;

  const months =
    -Math.log(1 - (principal * monthlyRate) / installment) /
    Math.log(1 + monthlyRate);

  return Math.max(1, Math.ceil(months - 1e-9));
}

/**
 * Rebuild the remaining instalments after a part-prepayment.
 *
 * The rebuilt table starts at the month *after* the prepayment: the period the
 * lump sum landed in has already been settled and re-issuing a row for it would
 * have `splitRepayment()` apportion the same period twice.
 *
 * Delegates the table itself to `buildAmortizationSchedule()` rather than
 * assembling rows here, so the rebuilt schedule carries the same last-row
 * rounding absorption as the original and the principal components still sum to
 * exactly the balance.
 *
 * @param {object} loan
 * @param {object} params
 * @param {number} params.prepaymentAmount
 * @param {number} params.effectiveMonth
 * @param {number} params.effectiveYear
 * @param {string} [params.strategy]
 * @returns {object}
 */
function reamortizeSchedule(loan, params = {}) {
  const {
    prepaymentAmount,
    effectiveMonth,
    effectiveYear,
    strategy = PREPAYMENT_STRATEGY.REDUCE_TENURE,
  } = params;

  const errors = [];

  if (!loan) errors.push('Loan not found');
  else if (TERMINAL_STATUSES.includes(loan.status)) {
    errors.push(`A loan that is "${loan.status}" cannot be re-amortised`);
  }

  if (!Object.values(PREPAYMENT_STRATEGY).includes(strategy)) {
    errors.push(
      `Strategy must be one of: ${Object.values(PREPAYMENT_STRATEGY).join(', ')}`,
    );
  }

  const amount = Number(prepaymentAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('Prepayment amount must be a positive number');
  }

  if (
    !Number.isInteger(Number(effectiveMonth)) ||
    effectiveMonth < 1 ||
    effectiveMonth > 12
  ) {
    errors.push('Effective month must be an integer between 1 and 12');
  }

  if (
    !Number.isInteger(Number(effectiveYear)) ||
    effectiveYear < 2000 ||
    effectiveYear > 2100
  ) {
    errors.push('Effective year must be a valid year');
  }

  if (errors.length) {
    return { ok: false, errors, schedule: [] };
  }

  const principalOutstanding = computePrincipalOutstanding(loan);

  if (amount > principalOutstanding) {
    // Above the principal this is a foreclosure, not a prepayment, and the two
    // price differently — the caller has to say which one they meant.
    return {
      ok: false,
      errors: [
        `Prepayment of ${round2(amount)} exceeds the outstanding principal of ${principalOutstanding}. Use foreclosure to close the loan.`,
      ],
      schedule: [],
      principalOutstanding,
    };
  }

  const remainingPrincipal = round2(principalOutstanding - amount);

  // Fully repaid by the lump sum: nothing left to schedule.
  if (remainingPrincipal <= 0) {
    return {
      ok: true,
      errors: [],
      strategy,
      principalOutstanding,
      prepaymentAmount: round2(amount),
      remainingPrincipal: 0,
      schedule: [],
      installmentAmount: 0,
      revisedTenureMonths: 0,
      totalPayable: 0,
      totalInterest: 0,
      closesLoan: true,
    };
  }

  const interestMethod = loan.interestMethod || INTEREST_METHOD.NONE;
  const interestRatePercent = Number(loan.interestRatePercent) || 0;
  const monthlyRate =
    interestMethod === INTEREST_METHOD.REDUCING
      ? interestRatePercent / 100 / 12
      : 0;

  // The rebuilt table starts the month after the lump sum landed.
  const next = addMonths(Number(effectiveMonth), Number(effectiveYear), 1);

  // How many instalments the original schedule still had left to run — the
  // ceiling for the reduce-installment strategy.
  const cutoff = periodPoint(Number(effectiveMonth), Number(effectiveYear));
  const remainingRows = scheduleOf(loan).filter(
    (row) => periodPoint(row.month, row.year) > cutoff,
  ).length;

  let revisedTenureMonths;

  if (strategy === PREPAYMENT_STRATEGY.REDUCE_TENURE) {
    const installment = Number(loan.installmentAmount) || 0;
    revisedTenureMonths = solveTenureMonths(
      remainingPrincipal,
      installment,
      monthlyRate,
    );

    if (revisedTenureMonths <= 0) {
      return {
        ok: false,
        errors: [
          'The existing instalment does not cover the interest on the remaining balance, so the tenure cannot be shortened. Use the reduce_installment strategy.',
        ],
        schedule: [],
      };
    }

    // Shortening cannot lengthen the loan. If the arithmetic says otherwise the
    // instalment was already below the accruing interest.
    revisedTenureMonths = Math.min(
      revisedTenureMonths,
      remainingRows || revisedTenureMonths,
    );
  } else {
    // Keep the tenure the original schedule had left.
    revisedTenureMonths = remainingRows;

    if (revisedTenureMonths <= 0) {
      return {
        ok: false,
        errors: [
          'No instalments remain after the effective period, so there is nothing to re-amortise.',
        ],
        schedule: [],
      };
    }
  }

  const rebuilt = buildAmortizationSchedule({
    principal: remainingPrincipal,
    tenureMonths: revisedTenureMonths,
    interestMethod,
    interestRatePercent,
    startMonth: next.month,
    startYear: next.year,
  });

  if (!rebuilt.ok) {
    return { ok: false, errors: rebuilt.errors, schedule: [] };
  }

  return {
    ok: true,
    errors: [],
    strategy,
    principalOutstanding,
    prepaymentAmount: round2(amount),
    remainingPrincipal,
    revisedTenureMonths,
    previousInstallment: round2(Number(loan.installmentAmount) || 0),
    installmentAmount: rebuilt.installmentAmount,
    totalPayable: rebuilt.totalPayable,
    totalInterest: rebuilt.totalInterest,
    schedule: rebuilt.schedule,
    // Reported so the caller can show what the lump sum bought: months saved
    // under reduce_tenure, a lower instalment under reduce_installment.
    monthsSaved: Math.max(remainingRows - revisedTenureMonths, 0),
    installmentReduction: round2(
      Math.max(
        (Number(loan.installmentAmount) || 0) - rebuilt.installmentAmount,
        0,
      ),
    ),
    closesLoan: false,
  };
}

/**
 * The ledger state a foreclosure leaves behind.
 *
 * Returns a new state rather than mutating, so a caller can price and persist
 * in two separate steps and a failed save leaves nothing half-applied. This is
 * `applyRepayment()`'s contract, kept the same on purpose.
 *
 * The closing entry is recorded against its period like any other repayment,
 * so a re-run for the same period replaces it instead of collecting twice.
 *
 * @param {object} loan
 * @param {object} quote a result from `computeForeclosureQuote`
 * @param {object} [meta]
 * @returns {object}
 */
function applyForeclosure(loan, quote, meta = {}) {
  if (!quote?.ok) {
    return {
      ok: false,
      errors: quote?.errors || ['Invalid foreclosure quote'],
    };
  }

  const month = Number(meta.month ?? quote.asOfMonth);
  const year = Number(meta.year ?? quote.asOfYear);

  const existing = ledgerOf(loan).map((entry) =>
    entry?.toObject ? entry.toObject() : { ...entry },
  );

  const closingEntry = {
    month,
    year,
    amount: quote.netPayable,
    // The closure fee is neither principal nor interest, so it is not folded
    // into either component — that would misstate the principal repaid and
    // leave a balance behind.
    principalComponent: quote.principalOutstanding,
    interestComponent: quote.interestDueNow,
    payrollId: meta.payrollId || null,
  };

  const index = existing.findIndex(
    (entry) => Number(entry.month) === month && Number(entry.year) === year,
  );

  if (index >= 0) existing[index] = closingEntry;
  else existing.push(closingEntry);

  existing.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));

  const totalRepaid = round2(
    existing.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
  );

  return {
    ok: true,
    errors: [],
    repayments: existing,
    totalRepaid,
    outstanding: 0,
    status: LOAN_STATUS.FORECLOSED,
    // The schedule is truncated at the closure period: rows beyond it describe
    // instalments that will never be collected, and leaving them in place has
    // the loan reporting a remaining tenure it does not have.
    schedule: scheduleOf(loan)
      .map((row) => (row?.toObject ? row.toObject() : { ...row }))
      .filter(
        (row) => periodPoint(row.month, row.year) <= periodPoint(month, year),
      ),
    foreclosureCharge: quote.foreclosureCharge,
    interestRebate: quote.interestRebate,
  };
}

/**
 * What an employee owes across every open loan, priced for closure today.
 *
 * This is what full-and-final settlement needs: a leaver's advances have to be
 * recovered from their final payment, and recovering them at
 * `computeOutstanding()` would collect interest for months after they have
 * left the company.
 *
 * Loans that cannot be foreclosed are reported with their reason rather than
 * dropped, so a settlement that cannot be completed says why.
 *
 * @param {object[]} loans
 * @param {object} [options]
 * @returns {object}
 */
function computeExitClearance(loans, options = {}) {
  const list = Array.isArray(loans) ? loans : [];

  const quotes = [];
  const blocked = [];

  for (const loan of list) {
    if (TERMINAL_STATUSES.includes(loan?.status)) continue;

    const quote = computeForeclosureQuote(loan, options);

    if (!quote.ok) {
      blocked.push({
        loanId: loan?._id || loan?.id || null,
        type: loan?.type || null,
        reasons: quote.errors,
      });
      continue;
    }

    quotes.push({
      loanId: loan._id || loan.id || null,
      type: loan.type || null,
      status: loan.status,
      principalOutstanding: quote.principalOutstanding,
      interestDueNow: quote.interestDueNow,
      interestRebate: quote.interestRebate,
      foreclosureCharge: quote.foreclosureCharge,
      netPayable: quote.netPayable,
    });
  }

  const sum = (key) =>
    round2(quotes.reduce((total, quote) => total + quote[key], 0));

  return {
    ok: true,
    loanCount: quotes.length,
    quotes,
    blocked,
    totalPrincipalOutstanding: sum('principalOutstanding'),
    totalInterestDue: sum('interestDueNow'),
    totalInterestRebate: sum('interestRebate'),
    totalForeclosureCharge: sum('foreclosureCharge'),
    totalClearanceAmount: sum('netPayable'),
    // A settlement cannot complete while any loan could not be priced.
    isClearable: blocked.length === 0,
  };
}

module.exports = {
  PREPAYMENT_STRATEGY,
  MAX_FORECLOSURE_CHARGE_PERCENT,
  TERMINAL_STATUSES,
  periodPoint,
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
};
