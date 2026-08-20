/**
 * Assignment tax mechanics (#1348).
 *
 * Three of these have a wrong answer that is not obviously wrong: equalization
 * implemented as protection (an employee windfall the employer did not agree
 * to), a gross-up solved in closed form across a slab boundary (understated),
 * and a day count that misses the arrival and departure days (undercounted by
 * two per trip). None of them throws.
 */

const {
  TAX_APPROACH,
  TREATY_DAY_THRESHOLD,
  GROSS_UP_MAX_ITERATIONS,
  taxOnIncome,
  marginalRate,
  stayAtHomeCompensation,
  computeHypotheticalTax,
  settleTaxPosition,
  grossUp,
  countPresenceDays,
  assessTreatyExposure,
  projectAssignmentCost,
  buildAssignmentAssessment,
} = require('../taxEqualization');

/** A progressive table with two boundaries, so slicing is observable. */
const TABLE = [
  { upTo: 300000, rate: 0 },
  { upTo: 700000, rate: 0.05 },
  { upTo: 1000000, rate: 0.1 },
  { upTo: 1200000, rate: 0.15 },
  { upTo: 1500000, rate: 0.2 },
  { rate: 0.3 },
];

const assignment = (overrides = {}) => ({
  homeBaseSalary: 2400000,
  homeBonus: 400000,
  taxApproach: TAX_APPROACH.EQUALIZATION,
  allowances: {
    costOfLiving: 600000,
    housing: 1800000,
    hardship: 240000,
    mobilityPremium: 240000,
  },
  ...overrides,
});

describe('taxOnIncome', () => {
  it('slices income at the slab boundaries', () => {
    // 0 on the first 300k, 5% on the next 400k = 20,000.
    expect(taxOnIncome(700000, TABLE)).toBe(20000);
  });

  it('does not apply the top rate to the whole income', () => {
    // The #616 bug in another module's clothing. Bracket-times-everything would
    // give 750,000 here. Slicing gives 440,000:
    //   0 on the first 300k, 5% on 400k, 10% on 300k, 15% on 200k,
    //   20% on 300k, 30% on the remaining 1,000,000.
    expect(taxOnIncome(2500000, TABLE)).toBe(440000);
    expect(taxOnIncome(2500000, TABLE)).toBeLessThan(2500000 * 0.3);
  });

  it('is nil below the first threshold', () => {
    expect(taxOnIncome(250000, TABLE)).toBe(0);
  });

  it('returns nil for a nonsense income or an empty table', () => {
    expect(taxOnIncome(-100, TABLE)).toBe(0);
    expect(taxOnIncome(500000, [])).toBe(0);
  });
});

describe('marginalRate', () => {
  it('is the rate the next rupee is taxed at', () => {
    expect(marginalRate(500000, TABLE)).toBe(0.05);
    expect(marginalRate(2500000, TABLE)).toBe(0.3);
  });

  it('falls back to the top rate above every boundary', () => {
    expect(marginalRate(99999999, TABLE)).toBe(0.3);
  });
});

describe('stayAtHomeCompensation', () => {
  it('excludes every allowance that exists because of the assignment', () => {
    // Including housing here would raise the hypo tax and leave the employee
    // worse off than staying at home, which is the one thing the arrangement
    // promises will not happen.
    const stayAtHome = stayAtHomeCompensation(assignment());

    expect(stayAtHome.total).toBe(2800000);
    expect(stayAtHome.excludedFromHypo).toBe(2880000);
  });

  it('handles an assignment with no allowances at all', () => {
    expect(stayAtHomeCompensation({ homeBaseSalary: 1000000 }).total).toBe(
      1000000,
    );
  });
});

describe('computeHypotheticalTax', () => {
  it('taxes the stay-at-home package at home rates', () => {
    const hypo = computeHypotheticalTax(assignment(), { homeTaxTable: TABLE });

    expect(hypo.hypoTaxableIncome).toBe(2800000);
    expect(hypo.hypotheticalTax).toBe(taxOnIncome(2800000, TABLE));
    expect(hypo.stayAtHomeNet).toBe(2800000 - hypo.hypotheticalTax);
  });

  it('applies hypo deductions before taxing', () => {
    const hypo = computeHypotheticalTax(assignment(), {
      homeTaxTable: TABLE,
      hypoDeductions: 300000,
    });

    expect(hypo.hypoTaxableIncome).toBe(2500000);
  });

  it('does not go negative when deductions exceed the package', () => {
    const hypo = computeHypotheticalTax(
      { homeBaseSalary: 100000 },
      { homeTaxTable: TABLE, hypoDeductions: 500000 },
    );

    expect(hypo.hypoTaxableIncome).toBe(0);
    expect(hypo.hypotheticalTax).toBe(0);
  });
});

describe('settleTaxPosition', () => {
  const hypo = 400000;

  it('leaves the employee bearing exactly the hypo tax under equalization', () => {
    const settlement = settleTaxPosition({
      approach: TAX_APPROACH.EQUALIZATION,
      hypotheticalTax: hypo,
      actualHomeTax: 100000,
      actualHostTax: 700000,
    });

    expect(settlement.employeeBears).toBe(hypo);
    expect(settlement.employerBears).toBe(400000);
  });

  it('gives the employer the saving under equalization when the host is cheaper', () => {
    // The distinction that separates equalization from protection. Getting this
    // wrong hands the employee a windfall the company never agreed to.
    const settlement = settleTaxPosition({
      approach: TAX_APPROACH.EQUALIZATION,
      hypotheticalTax: hypo,
      actualHostTax: 150000,
    });

    expect(settlement.employeeBears).toBe(hypo);
    expect(settlement.employerBears).toBe(-250000);
    expect(settlement.note).toMatch(/accrues to the employer/);
  });

  it('gives the employee the saving under protection', () => {
    const settlement = settleTaxPosition({
      approach: TAX_APPROACH.PROTECTION,
      hypotheticalTax: hypo,
      actualHostTax: 150000,
    });

    expect(settlement.employeeBears).toBe(150000);
    expect(settlement.employerBears).toBe(0);
    expect(settlement.note).toMatch(/stays with the employee/);
  });

  it('tops the employee up under protection when the host is dearer', () => {
    const settlement = settleTaxPosition({
      approach: TAX_APPROACH.PROTECTION,
      hypotheticalTax: hypo,
      actualHostTax: 900000,
    });

    expect(settlement.employeeBears).toBe(hypo);
    expect(settlement.employerBears).toBe(500000);
  });

  it('leaves the employee with the whole actual tax under laissez-faire', () => {
    const settlement = settleTaxPosition({
      approach: TAX_APPROACH.LAISSEZ_FAIRE,
      hypotheticalTax: hypo,
      actualHomeTax: 50000,
      actualHostTax: 900000,
    });

    expect(settlement.employeeBears).toBe(950000);
    expect(settlement.employerBears).toBe(0);
  });

  it('reconciles what was withheld against what is owed, and names the direction', () => {
    const owes = settleTaxPosition({
      approach: TAX_APPROACH.EQUALIZATION,
      hypotheticalTax: 400000,
      hypoTaxWithheld: 350000,
      actualHostTax: 600000,
    });

    expect(owes.settlement).toBe(50000);
    expect(owes.settlementDirection).toBe('employee_owes_company');

    const refund = settleTaxPosition({
      approach: TAX_APPROACH.EQUALIZATION,
      hypotheticalTax: 400000,
      hypoTaxWithheld: 470000,
      actualHostTax: 600000,
    });

    expect(refund.settlement).toBe(-70000);
    expect(refund.settlementDirection).toBe('company_owes_employee');
  });

  it('defaults to equalization when no approach is named', () => {
    expect(
      settleTaxPosition({ hypotheticalTax: hypo, actualHostTax: 500000 })
        .employeeBears,
    ).toBe(hypo);
  });
});

describe('grossUp', () => {
  it('solves the fixed point — the gross less its own tax is the net', () => {
    const result = grossUp(100000, { taxTable: TABLE, baseIncome: 2000000 });

    expect(result.grossedUp - result.taxOnBenefit).toBeCloseTo(100000, 0);
    expect(result.converged).toBe(true);
  });

  it('matches the closed form inside a single slab', () => {
    // Wholly within the 30% band, so `net / (1 - 0.3)` is exact and the
    // iteration must agree with it.
    const result = grossUp(70000, { taxTable: TABLE, baseIncome: 3000000 });

    expect(result.grossedUp).toBeCloseTo(100000, 0);
  });

  it('exceeds the closed form when the benefit crosses a slab boundary', () => {
    // The reason this is iterative. Seeding from the marginal rate at the base
    // income understates a benefit that pushes into a higher band.
    const base = 1400000;
    const net = 400000;

    const result = grossUp(net, { taxTable: TABLE, baseIncome: base });
    const closedFormAtBaseRate = net / (1 - marginalRate(base, TABLE));

    expect(result.grossedUp).toBeGreaterThan(closedFormAtBaseRate);
    expect(result.grossedUp - result.taxOnBenefit).toBeCloseTo(net, 0);
  });

  it('is a no-op for a nil benefit', () => {
    const result = grossUp(0, { taxTable: TABLE });

    expect(result.grossedUp).toBe(0);
    expect(result.iterations).toBe(0);
  });

  it('reports non-convergence instead of spinning on an impossible table', () => {
    // A rate of 1 or above has no fixed point. Without the iteration cap this
    // runs forever; with it, a misconfigured table surfaces as a flagged figure
    // rather than as a hung request.
    const result = grossUp(100000, { taxTable: [{ rate: 1.2 }] });

    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(GROSS_UP_MAX_ITERATIONS);
  });
});

describe('countPresenceDays', () => {
  it('counts both the arrival and the departure day', () => {
    // Any part of a day is a day. Counting nights gives 4 here; counting whole
    // days gives 4; the treaty answer is 6.
    const result = countPresenceDays([
      { arrival: '2026-03-01', departure: '2026-03-06' },
    ]);

    expect(result.days).toBe(6);
  });

  it('counts a same-day trip as one day', () => {
    expect(
      countPresenceDays([{ arrival: '2026-03-01', departure: '2026-03-01' }])
        .days,
    ).toBe(1);
  });

  it('treats a trip with no departure as a single day', () => {
    expect(countPresenceDays([{ arrival: '2026-03-01' }]).days).toBe(1);
  });

  it('collapses overlapping trips — a day is a day however many rows claim it', () => {
    const result = countPresenceDays([
      { arrival: '2026-03-01', departure: '2026-03-10' },
      { arrival: '2026-03-05', departure: '2026-03-12' },
    ]);

    expect(result.days).toBe(12);
  });

  it('adds up the arrival and departure days across many short trips', () => {
    // Twenty commuter trips of three nights each. Nights would give 60;
    // the treaty count is 80, which is the difference between a comfortable
    // margin and none.
    const trips = Array.from({ length: 20 }, (unused, index) => ({
      arrival: `2026-01-${String(index + 1).padStart(2, '0')}`,
      departure: `2026-01-${String(index + 1).padStart(2, '0')}`,
    }));

    expect(countPresenceDays(trips).days).toBe(20);
  });

  it('respects a measurement window', () => {
    const result = countPresenceDays(
      [{ arrival: '2025-12-28', departure: '2026-01-05' }],
      { from: new Date('2026-01-01T00:00:00.000Z') },
    );

    expect(result.days).toBe(5);
  });

  it('reports a trip it could not read rather than dropping it silently', () => {
    const result = countPresenceDays([
      { arrival: 'nonsense', departure: '2026-03-06' },
      { arrival: '2026-04-10', departure: '2026-04-01' },
    ]);

    expect(result.days).toBe(0);
    expect(result.ignored).toHaveLength(2);
  });
});

describe('assessTreatyExposure', () => {
  it('is within the threshold well below it', () => {
    expect(assessTreatyExposure(100).status).toBe('within');
  });

  it('warns before the threshold rather than after it', () => {
    // After it there is nothing left to decide — the filing obligation exists.
    const exposure = assessTreatyExposure(160);

    expect(exposure.status).toBe('approaching');
    expect(exposure.remaining).toBe(TREATY_DAY_THRESHOLD - 160);
  });

  it('reports an exceeded threshold', () => {
    const exposure = assessTreatyExposure(200);

    expect(exposure.status).toBe('exceeded');
    expect(exposure.message).toMatch(/taxing right/);
  });

  it('treats exactly the threshold as not yet exceeded', () => {
    expect(assessTreatyExposure(TREATY_DAY_THRESHOLD).status).toBe(
      'approaching',
    );
  });

  it('accepts a treaty-specific threshold', () => {
    expect(assessTreatyExposure(100, { threshold: 90 }).status).toBe(
      'exceeded',
    );
  });
});

describe('projectAssignmentCost', () => {
  it('credits the hypo tax rather than ignoring it', () => {
    // Leaving it out overstates the cost by the whole hypo, which on a senior
    // assignment is not a rounding error.
    const cost = projectAssignmentCost(assignment(), {
      homeTaxTable: TABLE,
      estimatedHomeTax: 200000,
      estimatedHostTax: 900000,
    });

    const credit = cost.lines.find(
      (line) => line.component === 'hypotheticalTaxCredit',
    );

    expect(credit.amount).toBeLessThan(0);
    expect(cost.hypotheticalTaxCredit).toBeGreaterThan(0);
  });

  it('reports the cost as a multiple of base salary', () => {
    const cost = projectAssignmentCost(assignment(), {
      homeTaxTable: TABLE,
      estimatedHostTax: 900000,
    });

    expect(cost.costMultiple).toBeGreaterThan(2);
  });

  it('drops both tax lines for an unarranged assignment', () => {
    // Under laissez-faire the employer bears no tax and collects no hypo.
    // Including either would make an unarranged assignment look equalized on
    // the cost sheet.
    const cost = projectAssignmentCost(
      assignment({ taxApproach: TAX_APPROACH.LAISSEZ_FAIRE }),
      { homeTaxTable: TABLE, estimatedHostTax: 900000 },
    );

    expect(cost.employerBorneTax).toBe(0);
    expect(cost.hypotheticalTaxCredit).toBe(0);
    expect(
      cost.lines.some((line) => line.component === 'hypotheticalTaxCredit'),
    ).toBe(false);
  });

  it('does not divide by zero when there is no base salary', () => {
    expect(projectAssignmentCost({ homeBaseSalary: 0 }, {}).costMultiple).toBe(
      0,
    );
  });
});

describe('buildAssignmentAssessment', () => {
  it('assembles the hypo, settlement, day count, exposure and cost', () => {
    const assessment = buildAssignmentAssessment(assignment(), {
      homeTaxTable: TABLE,
      hostTaxTable: TABLE,
      actualHomeTax: 150000,
      actualHostTax: 800000,
      estimatedHostTax: 800000,
      trips: [{ arrival: '2026-01-05', departure: '2026-08-31' }],
      grossUpBenefits: [{ component: 'schoolFees', amount: 600000 }],
    });

    expect(assessment.hypo.hypotheticalTax).toBeGreaterThan(0);
    expect(assessment.settlement.employerBears).toBeGreaterThan(0);
    expect(assessment.exposure.status).toBe('exceeded');
    expect(assessment.cost.totalCost).toBeGreaterThan(0);
    expect(assessment.grossUps[0].grossedUp).toBeGreaterThan(600000);
  });

  it('produces a coherent assessment with no trips recorded', () => {
    const assessment = buildAssignmentAssessment(assignment(), {
      homeTaxTable: TABLE,
    });

    expect(assessment.presence.days).toBe(0);
    expect(assessment.exposure.status).toBe('within');
    expect(assessment.grossUps).toEqual([]);
  });
});
