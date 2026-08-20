/**
 * The actuarial boundaries, exercised without a database (#1344).
 *
 * These are the places a gratuity valuation goes wrong quietly. None of them
 * throws when it is wrong — the report still renders, the number is just not
 * the obligation — so each one gets an assertion of its own rather than being
 * covered incidentally by a total.
 */

const {
  DEFAULT_ASSUMPTIONS,
  completedYears,
  statutoryBenefit,
  projectWage,
  discountFactor,
  normaliseAssumptions,
  exitScenarios,
  computeEmployeeObligation,
  computeValuation,
  rollForward,
  computeFundedStatus,
  computeSensitivities,
  buildValuationReport,
} = require('../gratuityValuation');

const { GRATUITY } = require('../../config/employment');

const VALUATION_DATE = new Date('2026-03-31T00:00:00.000Z');

/** Someone with a known joining date and age, so the maths is checkable by hand. */
function employee(overrides = {}) {
  return {
    employeeId: 'emp-1',
    name: 'Test Employee',
    department: 'Engineering',
    joiningDate: new Date('2016-04-01T00:00:00.000Z'),
    dateOfBirth: new Date('1991-04-01T00:00:00.000Z'),
    monthlySalary: 100000,
    ...overrides,
  };
}

describe('completedYears — section 4(2) rounding', () => {
  it('disregards a part-year below six months', () => {
    expect(completedYears(7.4)).toBe(7);
  });

  it('rounds a part-year of exactly six months up', () => {
    expect(completedYears(7.5)).toBe(8);
  });

  it('rounds a part-year above six months up', () => {
    expect(completedYears(7.9)).toBe(8);
  });

  it('treats a negative or absent service length as nil', () => {
    expect(completedYears(-2)).toBe(0);
    expect(completedYears(undefined)).toBe(0);
  });
});

describe('statutoryBenefit', () => {
  it('pays nothing below the five-year cliff', () => {
    const result = statutoryBenefit(50000, GRATUITY.ELIGIBILITY_YEARS - 1);

    expect(result.eligible).toBe(false);
    expect(result.amount).toBe(0);
  });

  it('applies the 15/26 formula at the cliff', () => {
    // 15/26 × 26,000 × 5 = 75,000 exactly, chosen so the divisor cancels.
    const result = statutoryBenefit(26000, 5);

    expect(result.eligible).toBe(true);
    expect(result.amount).toBe(75000);
    expect(result.capped).toBe(false);
  });

  it('caps at the statutory maximum', () => {
    const result = statutoryBenefit(500000, 30);

    expect(result.amount).toBe(GRATUITY.CEILING);
    expect(result.capped).toBe(true);
  });

  it('refuses a non-numeric wage rather than returning NaN', () => {
    expect(statutoryBenefit('not a number', 10).amount).toBe(0);
  });
});

describe('projectWage and discountFactor', () => {
  it('compounds salary forward at the escalation rate', () => {
    expect(projectWage(100, 2, 0.1)).toBeCloseTo(121, 6);
  });

  it('leaves a wage untouched at year zero', () => {
    expect(projectWage(100, 0, 0.1)).toBe(100);
  });

  it('discounts a future rupee below one', () => {
    expect(discountFactor(1, 0.1)).toBeCloseTo(1 / 1.1, 6);
    expect(discountFactor(0, 0.1)).toBe(1);
  });
});

describe('normaliseAssumptions', () => {
  it('fills the defaults', () => {
    expect(normaliseAssumptions().discountRate).toBe(
      DEFAULT_ASSUMPTIONS.discountRate,
    );
  });

  it('lets a caller override one assumption without losing the rest', () => {
    const merged = normaliseAssumptions({ discountRate: 0.08 });

    expect(merged.discountRate).toBe(0.08);
    expect(merged.attritionRate).toBe(DEFAULT_ASSUMPTIONS.attritionRate);
  });

  it('refuses a discount rate that would divide by zero', () => {
    expect(() => normaliseAssumptions({ discountRate: -1 })).toThrow(
      RangeError,
    );
  });

  it('refuses an implausible retirement age rather than valuing against it', () => {
    expect(() => normaliseAssumptions({ retirementAge: 12 })).toThrow(
      RangeError,
    );
  });

  it('refuses a wage ratio of zero, which would value every employee at nil', () => {
    expect(() => normaliseAssumptions({ gratuityWageRatio: 0 })).toThrow(
      RangeError,
    );
  });
});

describe('exitScenarios', () => {
  it('sums to a probability of one', () => {
    const total = exitScenarios(20, 0.12).reduce(
      (sum, scenario) => sum + scenario.probability,
      0,
    );

    expect(total).toBeCloseTo(1, 10);
  });

  it('puts everyone in the retirement scenario when attrition is nil', () => {
    const scenarios = exitScenarios(10, 0);
    const retirement = scenarios.find((s) => s.mode === 'retirement');

    expect(retirement.probability).toBeCloseTo(1, 10);
  });

  it('front-loads withdrawals — an early exit is likelier than a late one', () => {
    const scenarios = exitScenarios(10, 0.2).filter(
      (s) => s.mode === 'withdrawal',
    );

    expect(scenarios[0].probability).toBeGreaterThan(scenarios[9].probability);
  });

  it('yields a single retirement scenario for an employee already at retirement age', () => {
    const scenarios = exitScenarios(0, 0.12);

    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].mode).toBe('retirement');
  });
});

describe('computeEmployeeObligation', () => {
  const assumptions = normaliseAssumptions();

  it('carries an obligation for an employee past the cliff', () => {
    const row = computeEmployeeObligation(
      employee(),
      VALUATION_DATE,
      assumptions,
    );

    expect(row.vested).toBe(true);
    expect(row.definedBenefitObligation).toBeGreaterThan(0);
    expect(row.currentServiceCost).toBeGreaterThan(0);
  });

  it('carries an obligation for an employee short of the cliff', () => {
    // Two years of service. No vested benefit, and still a real obligation —
    // the scenarios where they stay past five years are not all impossible.
    // Dropping these employees is the most common way a valuation understates.
    const row = computeEmployeeObligation(
      employee({ joiningDate: new Date('2024-04-01T00:00:00.000Z') }),
      VALUATION_DATE,
      assumptions,
    );

    expect(row.vested).toBe(false);
    expect(row.definedBenefitObligation).toBeGreaterThan(0);
  });

  it('values a longer-serving employee above a shorter-serving twin', () => {
    const senior = computeEmployeeObligation(
      employee({ joiningDate: new Date('2006-04-01T00:00:00.000Z') }),
      VALUATION_DATE,
      assumptions,
    );
    const junior = computeEmployeeObligation(
      employee({ joiningDate: new Date('2021-04-01T00:00:00.000Z') }),
      VALUATION_DATE,
      assumptions,
    );

    expect(senior.definedBenefitObligation).toBeGreaterThan(
      junior.definedBenefitObligation,
    );
  });

  it('applies the wage ratio — the obligation is on basic + DA, not on CTC', () => {
    const half = computeEmployeeObligation(
      employee(),
      VALUATION_DATE,
      assumptions,
    );
    const whole = computeEmployeeObligation(
      employee(),
      VALUATION_DATE,
      normaliseAssumptions({ gratuityWageRatio: 1 }),
    );

    expect(whole.definedBenefitObligation).toBeGreaterThan(
      half.definedBenefitObligation,
    );
  });

  it('flags a record valued on an assumed age rather than silently guessing', () => {
    const row = computeEmployeeObligation(
      employee({ dateOfBirth: null }),
      VALUATION_DATE,
      assumptions,
    );

    expect(row.ageAssumed).toBe(true);
    expect(row.ageYears).toBeNull();
  });

  it('returns null for a record with no joining date', () => {
    expect(
      computeEmployeeObligation(
        employee({ joiningDate: null }),
        VALUATION_DATE,
        assumptions,
      ),
    ).toBeNull();
  });

  it('does not produce Infinity for someone who joined today', () => {
    const row = computeEmployeeObligation(
      employee({ joiningDate: VALUATION_DATE }),
      VALUATION_DATE,
      assumptions,
    );

    expect(Number.isFinite(row.definedBenefitObligation)).toBe(true);
    expect(Number.isFinite(row.currentServiceCost)).toBe(true);
  });

  it('caps the projected benefit, not the accrued one', () => {
    // A senior employee whose projected benefit at retirement blows through the
    // ceiling. Capping the accrued figure instead would change nothing here and
    // would leave the obligation overstated by the whole excess.
    const row = computeEmployeeObligation(
      employee({
        monthlySalary: 1200000,
        joiningDate: new Date('1996-04-01T00:00:00.000Z'),
        dateOfBirth: new Date('1974-04-01T00:00:00.000Z'),
      }),
      VALUATION_DATE,
      assumptions,
    );

    expect(row.ceilingApplied).toBe(true);
    expect(row.definedBenefitObligation).toBeLessThanOrEqual(GRATUITY.CEILING);
  });
});

describe('computeValuation', () => {
  const roster = [
    employee(),
    employee({
      employeeId: 'emp-2',
      joiningDate: new Date('2019-07-01T00:00:00.000Z'),
    }),
    employee({ employeeId: 'emp-3', monthlySalary: 40000 }),
  ];

  it('totals the schedule', () => {
    const result = computeValuation(roster, { valuationDate: VALUATION_DATE });

    const summed = result.schedule.reduce(
      (sum, row) => sum + row.definedBenefitObligation,
      0,
    );

    expect(result.headcountValued).toBe(3);
    expect(result.definedBenefitObligation).toBeCloseTo(summed, 1);
  });

  it('splits vested from unvested', () => {
    const result = computeValuation(roster, { valuationDate: VALUATION_DATE });

    expect(result.vestedObligation + result.unvestedObligation).toBeCloseTo(
      result.definedBenefitObligation,
      1,
    );
  });

  it('reports what it could not value instead of dropping it', () => {
    const result = computeValuation(
      [
        ...roster,
        { employeeId: 'emp-4', name: 'No dates', monthlySalary: 50000 },
      ],
      { valuationDate: VALUATION_DATE },
    );

    expect(result.headcountSkipped).toBe(1);
    expect(result.skipped[0].reason).toMatch(/joining date/i);
  });

  it('snapshots the assumptions it used', () => {
    const result = computeValuation(roster, {
      valuationDate: VALUATION_DATE,
      assumptions: { discountRate: 0.069 },
    });

    expect(result.assumptions.discountRate).toBe(0.069);
  });

  it('returns a coherent nil valuation for an empty workforce', () => {
    const result = computeValuation([], { valuationDate: VALUATION_DATE });

    expect(result.definedBenefitObligation).toBe(0);
    expect(result.schedule).toEqual([]);
  });

  it('falls in value as the discount rate rises', () => {
    const low = computeValuation(roster, {
      valuationDate: VALUATION_DATE,
      assumptions: { discountRate: 0.06 },
    });
    const high = computeValuation(roster, {
      valuationDate: VALUATION_DATE,
      assumptions: { discountRate: 0.09 },
    });

    expect(high.definedBenefitObligation).toBeLessThan(
      low.definedBenefitObligation,
    );
  });

  it('rises as salary escalation rises', () => {
    const low = computeValuation(roster, {
      valuationDate: VALUATION_DATE,
      assumptions: { salaryEscalationRate: 0.05 },
    });
    const high = computeValuation(roster, {
      valuationDate: VALUATION_DATE,
      assumptions: { salaryEscalationRate: 0.11 },
    });

    expect(high.definedBenefitObligation).toBeGreaterThan(
      low.definedBenefitObligation,
    );
  });

  /**
   * Attrition does not push the obligation in one direction, and the fact that
   * it does not is worth pinning down — it is the assumption most likely to be
   * "corrected" by somebody who expects a monotonic answer.
   *
   * Below the five-year cliff, a leaver takes their whole accrual with them, so
   * more churn means a smaller obligation. Past the cliff the benefit is vested
   * and leaving early only means paying it *sooner*, which is less discounting
   * and a larger present value. The two populations move opposite ways and the
   * net effect on a real workforce depends on its service profile.
   */
  it('falls with attrition for service below the cliff', () => {
    const unvested = [
      employee({ joiningDate: new Date('2024-04-01T00:00:00.000Z') }),
    ];

    const stable = computeValuation(unvested, {
      valuationDate: VALUATION_DATE,
      assumptions: { attritionRate: 0.02 },
    });
    const churny = computeValuation(unvested, {
      valuationDate: VALUATION_DATE,
      assumptions: { attritionRate: 0.35 },
    });

    expect(churny.definedBenefitObligation).toBeLessThan(
      stable.definedBenefitObligation,
    );
  });

  it('rises with attrition for vested service, because the benefit is paid sooner', () => {
    const vested = [
      employee({ joiningDate: new Date('2010-04-01T00:00:00.000Z') }),
    ];

    const stable = computeValuation(vested, {
      valuationDate: VALUATION_DATE,
      assumptions: { attritionRate: 0.02 },
    });
    const churny = computeValuation(vested, {
      valuationDate: VALUATION_DATE,
      assumptions: { attritionRate: 0.35 },
    });

    expect(churny.definedBenefitObligation).toBeGreaterThan(
      stable.definedBenefitObligation,
    );
  });
});

describe('rollForward', () => {
  it('balances the identity', () => {
    const roll = rollForward({
      openingDbo: 1000000,
      currentServiceCost: 150000,
      closingDbo: 1300000,
      discountRate: 0.07,
      benefitsPaid: 50000,
    });

    const rebuilt =
      roll.openingDbo +
      roll.currentServiceCost +
      roll.pastServiceCost +
      roll.interestCost -
      roll.benefitsPaid +
      roll.actuarialGainLoss;

    expect(rebuilt).toBeCloseTo(roll.closingDbo, 2);
  });

  it('unwinds interest on the opening obligation', () => {
    const roll = rollForward({
      openingDbo: 1000000,
      currentServiceCost: 0,
      closingDbo: 1070000,
      discountRate: 0.07,
    });

    expect(roll.interestCost).toBeCloseTo(70000, 0);
    expect(roll.actuarialGainLoss).toBeCloseTo(0, 0);
  });

  it('names a higher-than-expected obligation a loss', () => {
    const roll = rollForward({
      openingDbo: 1000000,
      currentServiceCost: 100000,
      closingDbo: 1400000,
      discountRate: 0.07,
    });

    expect(roll.outcome).toBe('loss');
    expect(roll.actuarialGainLoss).toBeGreaterThan(0);
  });

  it('names a lower-than-expected obligation a gain', () => {
    const roll = rollForward({
      openingDbo: 1000000,
      currentServiceCost: 100000,
      closingDbo: 1050000,
      discountRate: 0.07,
    });

    expect(roll.outcome).toBe('gain');
    expect(roll.actuarialGainLoss).toBeLessThan(0);
  });

  it('leaves the gain/loss unsplit when there is nothing to split it against', () => {
    const roll = rollForward({
      openingDbo: 1000000,
      currentServiceCost: 100000,
      closingDbo: 1200000,
      discountRate: 0.07,
    });

    expect(roll.experienceAdjustment).toBeNull();
    expect(roll.assumptionChange).toBeNull();
  });

  it('splits experience from the assumption change when given the prior-basis closing figure', () => {
    const roll = rollForward({
      openingDbo: 1000000,
      currentServiceCost: 100000,
      closingDbo: 1300000,
      discountRate: 0.07,
      priorAssumptionsClosingDbo: 1220000,
    });

    expect(roll.experienceAdjustment + roll.assumptionChange).toBeCloseTo(
      roll.actuarialGainLoss,
      2,
    );
    expect(roll.assumptionChange).toBeCloseTo(80000, 2);
  });
});

describe('computeFundedStatus', () => {
  it('reports the whole obligation as the net liability for an unfunded scheme', () => {
    const status = computeFundedStatus({ definedBenefitObligation: 900000 });

    expect(status.funded).toBe(false);
    expect(status.netLiability).toBe(900000);
    expect(status.status).toBe('deficit');
  });

  it('nets plan assets off the obligation', () => {
    const status = computeFundedStatus({
      definedBenefitObligation: 1000000,
      openingPlanAssets: 800000,
      contributions: 100000,
      expectedReturnRate: 0.075,
    });

    expect(status.closingPlanAssets).toBeGreaterThan(900000);
    expect(status.netLiability).toBeLessThan(200000);
  });

  it('calls an over-funded scheme a surplus', () => {
    const status = computeFundedStatus({
      definedBenefitObligation: 500000,
      openingPlanAssets: 900000,
      expectedReturnRate: 0,
    });

    expect(status.status).toBe('surplus');
    expect(status.netLiability).toBeLessThan(0);
  });

  it('separates the actual return on assets from the expected one', () => {
    const status = computeFundedStatus({
      definedBenefitObligation: 1000000,
      openingPlanAssets: 1000000,
      expectedReturnRate: 0.075,
      actualClosingPlanAssets: 1040000,
    });

    expect(status.expectedReturn).toBeCloseTo(75000, 0);
    expect(status.actualReturn).toBeCloseTo(40000, 0);
    expect(status.actuarialGainOnAssets).toBeCloseTo(-35000, 0);
  });
});

describe('computeSensitivities', () => {
  const roster = [
    employee(),
    employee({ employeeId: 'emp-2', monthlySalary: 60000 }),
  ];

  it('produces one row per shift per direction', () => {
    const rows = computeSensitivities(roster, {
      valuationDate: VALUATION_DATE,
    });

    expect(rows).toHaveLength(4);
  });

  it('moves the obligation the right way — up on the discount rate is down on the DBO', () => {
    const rows = computeSensitivities(roster, {
      valuationDate: VALUATION_DATE,
    });

    const discountUp = rows.find(
      (row) =>
        row.assumption === 'discountRate' && row.direction === 'increase',
    );
    const escalationUp = rows.find(
      (row) =>
        row.assumption === 'salaryEscalationRate' &&
        row.direction === 'increase',
    );

    expect(discountUp.change).toBeLessThan(0);
    expect(escalationUp.change).toBeGreaterThan(0);
  });

  it('does not divide by zero for an empty workforce', () => {
    const rows = computeSensitivities([], { valuationDate: VALUATION_DATE });

    expect(rows.every((row) => row.changePercent === 0)).toBe(true);
  });
});

describe('buildValuationReport', () => {
  const roster = [
    employee(),
    employee({
      employeeId: 'emp-2',
      joiningDate: new Date('2013-01-15T00:00:00.000Z'),
    }),
  ];

  it('assembles the obligation, roll-forward, funded status and sensitivities', () => {
    const report = buildValuationReport(roster, {
      valuationDate: VALUATION_DATE,
    });

    expect(report.definedBenefitObligation).toBeGreaterThan(0);
    expect(report.rollForward.closingDbo).toBe(report.definedBenefitObligation);
    expect(report.fundedStatus.definedBenefitObligation).toBe(
      report.definedBenefitObligation,
    );
    expect(report.sensitivities).toHaveLength(4);
  });

  it('rolls forward from the prior valuation when one is supplied', () => {
    const report = buildValuationReport(roster, {
      valuationDate: VALUATION_DATE,
      prior: {
        definedBenefitObligation: 500000,
        currentServiceCost: 90000,
        discountRate: 0.0725,
      },
      benefitsPaid: 20000,
    });

    expect(report.rollForward.openingDbo).toBe(500000);
    expect(report.rollForward.benefitsPaid).toBe(20000);
    expect(report.rollForward.interestCost).toBeGreaterThan(0);
  });

  it('splits the gain/loss when the prior assumptions are supplied too', () => {
    const report = buildValuationReport(roster, {
      valuationDate: VALUATION_DATE,
      prior: {
        definedBenefitObligation: 500000,
        currentServiceCost: 90000,
        discountRate: 0.0725,
        assumptions: { discountRate: 0.0725 },
      },
    });

    expect(report.rollForward.experienceAdjustment).not.toBeNull();
    expect(report.rollForward.assumptionChange).not.toBeNull();
  });

  it('recognises an expense for the period', () => {
    const report = buildValuationReport(roster, {
      valuationDate: VALUATION_DATE,
      prior: { definedBenefitObligation: 500000, currentServiceCost: 90000 },
    });

    expect(report.expenseForPeriod).toBeGreaterThan(0);
  });

  it('reduces the expense by the expected return on a funded scheme', () => {
    const unfunded = buildValuationReport(roster, {
      valuationDate: VALUATION_DATE,
      prior: { definedBenefitObligation: 500000, currentServiceCost: 90000 },
    });

    const funded = buildValuationReport(roster, {
      valuationDate: VALUATION_DATE,
      prior: { definedBenefitObligation: 500000, currentServiceCost: 90000 },
      openingPlanAssets: 400000,
    });

    expect(funded.expenseForPeriod).toBeLessThan(unfunded.expenseForPeriod);
  });
});
