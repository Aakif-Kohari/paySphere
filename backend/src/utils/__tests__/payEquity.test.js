/**
 * Pay equity, and the two rules that must not be optional (#1347).
 *
 * Suppression and the honest handling of missing data are the ones with
 * consequences beyond a wrong number: a report that identifies individuals is a
 * data protection incident, and a fabricated zero gap is worse than no report.
 * Both get more tests than the arithmetic does.
 */

const {
  STANDARD_MONTHLY_HOURS,
  MIN_SUPPRESSION_FLOOR,
  mean,
  median,
  hourlyPay,
  tenureBand,
  normaliseOptions,
  computeGap,
  computeQuartiles,
  compaRatio,
  computeCohorts,
  buildPayEquityReport,
  prepare,
} = require('../payEquity');

const AS_OF = new Date('2026-04-01T00:00:00.000Z');

/**
 * A workforce generator, so a test can say "eight men and eight women in L3
 * Engineering, the women paid 10% less" without twenty lines of literal.
 */
function cohortOf({
  count,
  gender,
  salary,
  jobLevel = 'L3',
  department = 'Engineering',
  joiningDate = '2022-01-01',
  prefix = 'e',
}) {
  return Array.from({ length: count }, (unused, index) => ({
    employeeId: `${prefix}-${gender}-${jobLevel}-${index}`,
    name: `${gender} ${jobLevel} ${index}`,
    gender,
    jobLevel,
    department,
    monthlySalary: salary,
    joiningDate,
  }));
}

describe('mean and median', () => {
  it('takes the mean of the middle two for an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('takes the middle for an odd count', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('returns nil for an empty set rather than NaN', () => {
    expect(median([])).toBe(0);
    expect(mean([])).toBe(0);
  });
});

describe('hourlyPay', () => {
  it('uses a standard month when contracted hours are not recorded', () => {
    expect(
      hourlyPay({ monthlySalary: STANDARD_MONTHLY_HOURS * 100 }),
    ).toBeCloseTo(100, 6);
  });

  it('makes part-time and full-time comparable', () => {
    // The whole reason regulations compute on hourly pay. Two people on the
    // same rate working different hours must not show as a pay gap.
    const fullTime = hourlyPay({
      monthlySalary: 100000,
      contractedMonthlyHours: 173,
    });
    const partTime = hourlyPay({
      monthlySalary: 50000,
      contractedMonthlyHours: 86.5,
    });

    expect(fullTime).toBeCloseTo(partTime, 6);
  });

  it('returns nil for an unusable salary', () => {
    expect(hourlyPay({ monthlySalary: 0 })).toBe(0);
    expect(hourlyPay({})).toBe(0);
  });
});

describe('tenureBand', () => {
  it('bands by years of service', () => {
    expect(tenureBand(1).id).toBe('under_2');
    expect(tenureBand(3).id).toBe('2_to_5');
    expect(tenureBand(7).id).toBe('5_to_10');
    expect(tenureBand(20).id).toBe('over_10');
  });

  it('has a band for a missing joining date rather than guessing one', () => {
    expect(tenureBand(null).id).toBe('unknown');
  });
});

describe('normaliseOptions', () => {
  it('refuses a suppression floor that would publish individuals', () => {
    expect(() =>
      normaliseOptions({ minimumCohortSize: MIN_SUPPRESSION_FLOOR - 1 }),
    ).toThrow(RangeError);
  });

  it('allows a tenant to raise the floor', () => {
    expect(normaliseOptions({ minimumCohortSize: 10 }).minimumCohortSize).toBe(
      10,
    );
  });
});

describe('computeGap', () => {
  it('reports a positive gap when the comparison group is paid less', () => {
    const gap = computeGap([100, 100, 100], [90, 90, 90]);

    expect(gap.meanGap).toBeCloseTo(0.1, 4);
    expect(gap.medianGap).toBeCloseTo(0.1, 4);
  });

  it('reports a negative gap when the comparison group is paid more', () => {
    expect(computeGap([100, 100], [110, 110]).meanGap).toBeCloseTo(-0.1, 4);
  });

  it('separates the mean from the median, which is the point of reporting both', () => {
    // One very high earner moves the mean and leaves the median alone. A
    // divergence between the two is itself a finding, and a report that gives
    // only one of them hides it.
    const gap = computeGap([100, 100, 100, 1000], [100, 100, 100, 100]);

    expect(gap.medianGap).toBeCloseTo(0, 4);
    expect(gap.meanGap).toBeGreaterThan(0.5);
  });

  it('does not divide by zero when the reference group has no pay', () => {
    expect(computeGap([], [100]).meanGap).toBe(0);
  });
});

describe('computeQuartiles', () => {
  const options = normaliseOptions();

  it('splits by headcount, not by pay range', () => {
    // The classic error. Eleven people on 100 and one on 10,000: splitting the
    // pay *range* into four bands puts eleven of them in the bottom band and
    // one alone at the top. Splitting by headcount gives four groups of three.
    const employees = [
      ...Array.from({ length: 11 }, (unused, i) => ({
        pay: 100 + i,
        group: 'male',
      })),
      { pay: 10000, group: 'female' },
    ];

    const quartiles = computeQuartiles(employees, options);

    expect(quartiles.map((q) => q.headcount)).toEqual([3, 3, 3, 3]);
  });

  it('gives the remainder to the lower quartiles', () => {
    const employees = Array.from({ length: 10 }, (unused, i) => ({
      pay: i,
      group: 'male',
    }));

    expect(
      computeQuartiles(employees, options).map((q) => q.headcount),
    ).toEqual([3, 3, 2, 2]);
  });

  it('reports the composition of each quartile', () => {
    const employees = [
      ...Array.from({ length: 4 }, (unused, i) => ({
        pay: i,
        group: 'female',
      })),
      ...Array.from({ length: 4 }, (unused, i) => ({
        pay: 100 + i,
        group: 'male',
      })),
    ];

    const quartiles = computeQuartiles(employees, options);

    expect(quartiles[0].composition).toEqual({ female: 2 });
    expect(quartiles[3].composition).toEqual({ male: 2 });
    expect(quartiles[0].proportions.female).toBe(1);
  });

  it('handles an empty workforce', () => {
    expect(computeQuartiles([], options)).toEqual([]);
  });
});

describe('compaRatio', () => {
  const band = { min: 80000, max: 120000, midpoint: 100000 };

  it('is 1.0 at the midpoint', () => {
    expect(compaRatio(100000, band).compaRatio).toBe(1);
  });

  it('reports range penetration across the band', () => {
    expect(compaRatio(80000, band).rangePenetration).toBe(0);
    expect(compaRatio(120000, band).rangePenetration).toBe(1);
    expect(compaRatio(100000, band).rangePenetration).toBe(0.5);
  });

  it('names a position outside the band', () => {
    expect(compaRatio(70000, band).position).toBe('below_band');
    expect(compaRatio(130000, band).position).toBe('above_band');
    expect(compaRatio(90000, band).position).toBe('within_band');
  });

  it('derives the midpoint when one is not given', () => {
    expect(compaRatio(100000, { min: 80000, max: 120000 }).compaRatio).toBe(1);
  });

  it('returns null rather than Infinity for a zero-width band', () => {
    expect(
      compaRatio(100000, { min: 100000, max: 100000 }).rangePenetration,
    ).toBeNull();
  });

  it('returns null when there is no band at all', () => {
    expect(compaRatio(100000, null)).toBeNull();
  });
});

describe('computeCohorts — suppression', () => {
  const options = normaliseOptions({ minimumCohortSize: 5 });

  it('suppresses a cohort below the minimum size', () => {
    const { prepared } = prepare(
      [
        ...cohortOf({ count: 2, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 1, gender: 'female', salary: 80000 }),
      ],
      options,
    );

    const cohorts = computeCohorts(prepared, options);

    expect(cohorts[0].suppressed).toBe(true);
    expect(cohorts[0].suppressionReason).toBe('COHORT_TOO_SMALL');
    expect(cohorts[0].comparisons).toBeUndefined();
  });

  it('suppresses a comparison where one side is too small', () => {
    const { prepared } = prepare(
      [
        ...cohortOf({ count: 8, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 2, gender: 'female', salary: 80000 }),
      ],
      options,
    );

    const cohort = computeCohorts(prepared, options)[0];

    expect(cohort.suppressed).toBe(false);
    expect(cohort.comparisons[0].suppressed).toBe(true);
    expect(cohort.comparisons[0].medianGap).toBeUndefined();
  });

  it('suppresses a cohort with nobody in the reference group', () => {
    const { prepared } = prepare(
      cohortOf({ count: 8, gender: 'female', salary: 80000 }),
      options,
    );

    expect(computeCohorts(prepared, options)[0].suppressionReason).toBe(
      'NO_REFERENCE_GROUP',
    );
  });

  it('reports a cohort that is large enough on both sides', () => {
    const { prepared } = prepare(
      [
        ...cohortOf({ count: 6, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 6, gender: 'female', salary: 90000 }),
      ],
      options,
    );

    const cohort = computeCohorts(prepared, options)[0];

    expect(cohort.suppressed).toBe(false);
    expect(cohort.comparisons[0].medianGap).toBeCloseTo(0.1, 4);
    expect(cohort.comparisons[0].material).toBe(true);
  });

  it('does not flag a gap under the threshold as material', () => {
    const { prepared } = prepare(
      [
        ...cohortOf({ count: 6, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 6, gender: 'female', salary: 98000 }),
      ],
      options,
    );

    expect(computeCohorts(prepared, options)[0].comparisons[0].material).toBe(
      false,
    );
  });

  it('splits cohorts by job level, department and tenure band', () => {
    const { prepared } = prepare(
      [
        ...cohortOf({
          count: 6,
          gender: 'male',
          salary: 100000,
          jobLevel: 'L3',
        }),
        ...cohortOf({
          count: 6,
          gender: 'male',
          salary: 150000,
          jobLevel: 'L4',
        }),
      ],
      options,
    );

    expect(computeCohorts(prepared, options)).toHaveLength(2);
  });
});

describe('buildPayEquityReport', () => {
  /**
   * A workforce where the headline gap and the adjusted gap disagree, which is
   * the case the whole feature exists for: identical pay within every grade,
   * and a large headline gap purely because the grades are not evenly composed.
   */
  const occupationallySegregated = [
    ...cohortOf({ count: 12, gender: 'male', salary: 200000, jobLevel: 'L5' }),
    ...cohortOf({ count: 2, gender: 'female', salary: 200000, jobLevel: 'L5' }),
    ...cohortOf({ count: 2, gender: 'male', salary: 60000, jobLevel: 'L1' }),
    ...cohortOf({ count: 12, gender: 'female', salary: 60000, jobLevel: 'L1' }),
  ];

  it('shows a large headline gap where the grades are unevenly composed', () => {
    const report = buildPayEquityReport(occupationallySegregated, {
      asOf: AS_OF,
    });

    expect(report.headline.female.medianGap).toBeGreaterThan(0.5);
  });

  it('and finds no material cohort gap, because nobody is paid differently for the same work', () => {
    const report = buildPayEquityReport(occupationallySegregated, {
      asOf: AS_OF,
    });

    const reported = report.cohorts.filter((cohort) => !cohort.suppressed);

    for (const cohort of reported) {
      for (const comparison of cohort.comparisons) {
        if (comparison.suppressed) continue;
        expect(comparison.material).toBe(false);
      }
    }

    expect(report.materialCohorts).toBe(0);
  });

  it('finds the reverse case — a small headline gap hiding a real within-grade gap', () => {
    const report = buildPayEquityReport(
      [
        ...cohortOf({
          count: 8,
          gender: 'male',
          salary: 100000,
          jobLevel: 'L3',
        }),
        ...cohortOf({
          count: 8,
          gender: 'female',
          salary: 85000,
          jobLevel: 'L3',
        }),
      ],
      { asOf: AS_OF },
    );

    expect(report.materialCohorts).toBe(1);
  });

  it('says it cannot tell rather than reporting a zero gap when nothing is disclosed', () => {
    const report = buildPayEquityReport(
      cohortOf({ count: 20, gender: null, salary: 100000 }).map((employee) => ({
        ...employee,
        gender: undefined,
      })),
      { asOf: AS_OF },
    );

    expect(report.demographics.usable).toBe(false);
    expect(report.demographics.message).toMatch(/insufficient/i);
    expect(report.headline).toEqual({});
    expect(report.cohorts).toEqual([]);
  });

  it('still produces the compa-ratio analysis when demographics are unusable', () => {
    // The half of the feature that needs no protected characteristic at all,
    // and the reason the two are computed separately.
    const report = buildPayEquityReport(
      cohortOf({ count: 20, gender: undefined, salary: 70000 }),
      {
        asOf: AS_OF,
        bands: { L3: { min: 80000, max: 120000, midpoint: 100000 } },
      },
    );

    expect(report.demographics.usable).toBe(false);
    expect(report.compaSummary.covered).toBe(20);
    expect(report.compaSummary.belowBand).toBe(20);
    expect(report.compaSummary.underMidpointBy20Percent).toBe(20);
  });

  it('counts undisclosed as its own group rather than folding it into the reference', () => {
    const report = buildPayEquityReport(
      [
        ...cohortOf({ count: 8, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 8, gender: 'female', salary: 100000 }),
        ...cohortOf({
          count: 8,
          gender: undefined,
          salary: 40000,
          prefix: 'u',
        }),
      ],
      { asOf: AS_OF },
    );

    expect(report.groupCounts.undisclosed).toBe(8);
    expect(report.demographics.undisclosed).toBe(8);
    // The undisclosed group is paid far less and must not drag the reference
    // group's average down.
    expect(report.headline.female.medianGap).toBeCloseTo(0, 4);
  });

  it('reports employees it could not place rather than dropping them', () => {
    const report = buildPayEquityReport(
      [
        ...cohortOf({ count: 8, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 8, gender: 'female', salary: 100000 }),
        { employeeId: 'broken', name: 'No salary', gender: 'female' },
      ],
      { asOf: AS_OF },
    );

    expect(report.excluded).toHaveLength(1);
    expect(report.excluded[0].reason).toMatch(/salary/i);
  });

  it('costs the remediation to the threshold, not to parity', () => {
    const report = buildPayEquityReport(
      [
        ...cohortOf({ count: 8, gender: 'male', salary: 100000 }),
        ...cohortOf({ count: 8, gender: 'female', salary: 80000 }),
      ],
      { asOf: AS_OF },
    );

    const action = report.remediation.actions[0];

    expect(action.employeesAffected).toBe(8);
    expect(action.targetMedianGap).toBe(0.05);

    // Closing a 20% gap to 5% on eight salaries of 80,000 is 15% of 100,000
    // each — 15,000 a head, 120,000 a month. Closing to parity would be
    // 160,000, and is not what the directive asks for.
    // Within a rupee or two: the cost is built from hourly pay and multiplied
    // back by the standard-hours divisor, so a sub-paisa residual per head is
    // expected and is not worth pretending away with an exact assertion.
    expect(action.monthlyCost).toBeCloseTo(120000, -1);
    expect(report.remediation.annualCost).toBeCloseTo(1440000, -1);
  });

  it('does not cost a cohort where the comparison group is paid more', () => {
    // Levelling down is not what this is for, and costing it would produce a
    // nonsensical negative budget.
    const report = buildPayEquityReport(
      [
        ...cohortOf({ count: 8, gender: 'male', salary: 80000 }),
        ...cohortOf({ count: 8, gender: 'female', salary: 100000 }),
      ],
      { asOf: AS_OF },
    );

    expect(report.remediation.actions).toEqual([]);
    expect(report.remediation.annualCost).toBe(0);
  });

  it('lists the worst compa-ratio outliers first', () => {
    const report = buildPayEquityReport(
      [
        ...cohortOf({ count: 4, gender: 'male', salary: 60000, prefix: 'low' }),
        ...cohortOf({ count: 4, gender: 'male', salary: 75000, prefix: 'mid' }),
      ],
      {
        asOf: AS_OF,
        bands: { L3: { min: 80000, max: 120000, midpoint: 100000 } },
      },
    );

    expect(report.compaOutliers[0].compaRatio).toBeLessThan(
      report.compaOutliers[report.compaOutliers.length - 1].compaRatio,
    );
  });

  it('handles an empty workforce without throwing', () => {
    const report = buildPayEquityReport([], { asOf: AS_OF });

    expect(report.headcount).toBe(0);
    expect(report.quartiles).toEqual([]);
    expect(report.demographics.usable).toBe(false);
  });
});
