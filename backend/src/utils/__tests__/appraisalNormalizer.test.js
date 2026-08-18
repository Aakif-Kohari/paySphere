/**
 * Cohort calibration arithmetic (#1158).
 *
 * The properties that matter: a normalisation must not invent a correction out
 * of a cohort too small to have one, a forced distribution must account for
 * every person exactly once, and a budget fit must never approve more than the
 * envelope it was given.
 */

const {
  DEFAULT_DISTRIBUTION,
  MIN_COHORT_SIZE,
  MIN_MANAGER_COHORT_SIZE,
  standardDeviation,
  median,
  computeCohortStatistics,
  applyZScoreNormalization,
  allocateBandCounts,
  bandForScore,
  applyForcedDistribution,
  buildDistributionReport,
  calibrateIncrementBudget,
} = require('../appraisalNormalizer');

/**
 * A finalised review as the appraisal controller would have written it.
 */
function review(id, managerId, finalScore, employeeId = `emp-${id}`) {
  return { _id: id, managerId, employeeId, finalScore };
}

/**
 * A cohort split between a lenient manager and a strict one, both of whose
 * teams are genuinely comparable. This is the situation the whole module
 * exists for: without normalisation every one of the lenient manager's reports
 * outranks every one of the strict manager's.
 */
function biasedCohort() {
  return [
    review('a1', 'lenient', 95),
    review('a2', 'lenient', 92),
    review('a3', 'lenient', 90),
    review('a4', 'lenient', 88),
    review('b1', 'strict', 70),
    review('b2', 'strict', 66),
    review('b3', 'strict', 64),
    review('b4', 'strict', 60),
  ];
}

describe('statistics primitives', () => {
  it('uses population standard deviation, not sample', () => {
    // Population: the cycle is the whole cohort being calibrated, not a sample
    // drawn from a bigger one. Sample sd on [2,4,4,4,5,5,7,9] is ~2.14.
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });

  it('returns zero standard deviation for fewer than two values', () => {
    expect(standardDeviation([])).toBe(0);
    expect(standardDeviation([50])).toBe(0);
  });

  it('interpolates the median across an even count', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([10, 20, 30])).toBe(20);
  });
});

describe('computeCohortStatistics', () => {
  it('reports each manager’s leniency against the company mean', () => {
    const stats = computeCohortStatistics(biasedCohort());

    const lenient = stats.byManager.find((m) => m.managerId === 'lenient');
    const strict = stats.byManager.find((m) => m.managerId === 'strict');

    expect(lenient.leniencyDelta).toBeGreaterThan(0);
    expect(strict.leniencyDelta).toBeLessThan(0);
    // Equal-sized cohorts, so the deltas cancel to within the rounding each
    // one carries.
    expect(lenient.leniencyDelta + strict.leniencyDelta).toBeCloseTo(0, 1);
  });

  it('sorts managers most lenient first', () => {
    const stats = computeCohortStatistics(biasedCohort());

    expect(stats.byManager[0].managerId).toBe('lenient');
  });

  it('groups a populated manager document and a raw id into one cohort', () => {
    // Mongoose returns an ObjectId, a populated doc or a string depending on
    // how the review was loaded. Grouping the raw value puts one manager in
    // three cohorts and every leniency figure comes out wrong.
    const stats = computeCohortStatistics([
      { _id: 'r1', managerId: { _id: 'mgr-1', fullName: 'A' }, finalScore: 80 },
      { _id: 'r2', managerId: 'mgr-1', finalScore: 70 },
    ]);

    expect(stats.managerCount).toBe(1);
    expect(stats.byManager[0].count).toBe(2);
  });

  it('flags a cohort below the minimum as not normalisable', () => {
    const stats = computeCohortStatistics([
      review('a', 'm', 80),
      review('b', 'm', 70),
    ]);

    expect(stats.isNormalizable).toBe(false);
    expect(stats.tooSmall).toBe(true);
  });

  it('flags a cohort with no spread separately from one that is too small', () => {
    const flat = Array.from({ length: 6 }, (_, i) => review(`f${i}`, 'm', 75));

    const stats = computeCohortStatistics(flat);

    expect(stats.tooSmall).toBe(false);
    expect(stats.hasNoSpread).toBe(true);
    expect(stats.isNormalizable).toBe(false);
  });

  it('handles an empty cohort without dividing by zero', () => {
    const stats = computeCohortStatistics([]);

    expect(stats).toMatchObject({ count: 0, mean: 0, standardDeviation: 0 });
    expect(stats.hasNoSpread).toBe(false);
  });
});

describe('applyZScoreNormalization', () => {
  it('pulls a lenient manager’s team down and a strict manager’s team up', () => {
    const result = applyZScoreNormalization(biasedCohort());

    expect(result.applied).toBe(true);

    const lenient = result.reviews.filter((r) => r.managerId === 'lenient');
    const strict = result.reviews.filter((r) => r.managerId === 'strict');

    expect(lenient.every((r) => r.delta < 0)).toBe(true);
    expect(strict.every((r) => r.delta > 0)).toBe(true);
  });

  it('preserves the ordering within a manager’s team', () => {
    // A z-score transform is linear, so it must not reshuffle a team — only
    // move it relative to the others.
    const result = applyZScoreNormalization(biasedCohort());

    const lenient = result.reviews
      .filter((r) => r.managerId === 'lenient')
      .sort((a, b) => b.originalScore - a.originalScore);

    for (let i = 1; i < lenient.length; i += 1) {
      expect(lenient[i - 1].normalizedScore).toBeGreaterThanOrEqual(
        lenient[i].normalizedScore,
      );
    }
  });

  it('is a no-op on a cohort with zero standard deviation', () => {
    // Dividing by it would produce NaN and hand every employee a score of
    // "not a number".
    const flat = Array.from({ length: 6 }, (_, i) => review(`f${i}`, 'm', 75));

    const result = applyZScoreNormalization(flat);

    expect(result.applied).toBe(false);
    expect(result.reviews.every((r) => r.delta === 0)).toBe(true);
    expect(result.reviews.every((r) => r.normalizedScore === 75)).toBe(true);
  });

  it('leaves a cohort below the minimum size untouched and says why', () => {
    const small = [review('a', 'm', 90), review('b', 'm', 60)];

    const result = applyZScoreNormalization(small);

    expect(result.applied).toBe(false);
    expect(result.reason).toContain(String(MIN_COHORT_SIZE));
    expect(result.reviews.every((r) => r.delta === 0)).toBe(true);
  });

  it('does not correct a manager with too few reports to have a baseline', () => {
    const cohort = [
      ...biasedCohort(),
      review('solo', 'one-report-manager', 85),
    ];

    const result = applyZScoreNormalization(cohort);
    const solo = result.reviews.find(
      (r) => r.managerId === 'one-report-manager',
    );

    expect(solo.normalized).toBe(false);
    expect(solo.delta).toBe(0);
    expect(solo.note).toContain(String(MIN_MANAGER_COHORT_SIZE));
  });

  it('applies the leniency shift only when a manager scored everyone alike', () => {
    const cohort = [
      ...biasedCohort(),
      review('c1', 'flat', 100),
      review('c2', 'flat', 100),
      review('c3', 'flat', 100),
    ];

    const result = applyZScoreNormalization(cohort);
    const flat = result.reviews.filter((r) => r.managerId === 'flat');

    expect(flat).toHaveLength(3);
    // No z to compute, so all three move by the same amount and stay level.
    expect(new Set(flat.map((r) => r.normalizedScore)).size).toBe(1);
    expect(flat[0].delta).toBeLessThan(0);
    expect(flat[0].note).toContain('identical score');
  });

  it('removes the leniency shift without touching a team’s internal spread', () => {
    // The default. Every member of a team moves by exactly the same amount,
    // so the gaps their manager set between them survive intact.
    const result = applyZScoreNormalization(biasedCohort());

    const lenient = result.reviews.filter((r) => r.managerId === 'lenient');
    const deltas = new Set(lenient.map((r) => r.delta));

    expect(deltas.size).toBe(1);
    expect([...deltas][0]).toBeCloseTo(-13.13, 1);
  });

  it('does not raise the top scorer in the company when correcting leniency', () => {
    // The failure mode a full z-rescale walks into: a lenient manager's
    // four-person team has a narrow spread, so stretching it to the company
    // spread hands their best performer a *higher* score than the lenient
    // rating being corrected.
    const result = applyZScoreNormalization(biasedCohort());
    const top = result.reviews.find((r) => r.reviewId === 'a1');

    expect(top.normalizedScore).toBeLessThan(top.originalScore);
  });

  it('stretches a team to the company spread when asked explicitly', () => {
    const result = applyZScoreNormalization(biasedCohort(), {
      scaleCorrection: 1,
      maxShift: 100,
    });

    const lenient = result.reviews.filter((r) => r.managerId === 'lenient');

    // Now the deltas differ across the team, because the spread itself moved.
    expect(new Set(lenient.map((r) => r.delta)).size).toBeGreaterThan(1);
    expect(result.scaleCorrection).toBe(1);
  });

  it('caps how far a single score can move', () => {
    const result = applyZScoreNormalization(biasedCohort(), { maxShift: 3 });

    expect(result.reviews.every((r) => Math.abs(r.delta) <= 3)).toBe(true);
  });

  it('never takes a score off the 0-100 scale', () => {
    const extreme = [
      review('x1', 'a', 100),
      review('x2', 'a', 99),
      review('x3', 'a', 98),
      review('x4', 'b', 2),
      review('x5', 'b', 1),
      review('x6', 'b', 0),
    ];

    const result = applyZScoreNormalization(extreme, { maxShift: 100 });

    expect(result.reviews.every((r) => r.normalizedScore >= 0)).toBe(true);
    expect(result.reviews.every((r) => r.normalizedScore <= 100)).toBe(true);
  });
});

describe('allocateBandCounts', () => {
  it('sums to exactly the headcount for a clean multiple', () => {
    const bands = allocateBandCounts(10);

    expect(bands.reduce((sum, b) => sum + b.targetCount, 0)).toBe(10);
    expect(bands.map((b) => b.targetCount)).toEqual([1, 2, 4, 2, 1]);
  });

  it.each([1, 3, 7, 11, 13, 17, 23, 49, 101, 997])(
    'sums to exactly the headcount for %i, which does not divide cleanly',
    (headcount) => {
      // Rounding each band independently is what makes a 7-person cohort come
      // out as 8 and either drop somebody or count them twice.
      const bands = allocateBandCounts(headcount);

      expect(bands.reduce((sum, b) => sum + b.targetCount, 0)).toBe(headcount);
    },
  );

  it('puts a lone employee in the largest band rather than the top one', () => {
    // Largest remainder, so the single seat goes to the 40% band. Handing a
    // cohort of one an "Outstanding" by default would be a rating nobody
    // earned.
    const bands = allocateBandCounts(1);

    expect(bands.reduce((sum, b) => sum + b.targetCount, 0)).toBe(1);
    expect(bands.find((b) => b.targetCount === 1).band).toBe(
      'Meets Expectations',
    );
  });

  it('breaks an exact remainder tie in favour of the better band', () => {
    // The one rounding decision that is genuinely arbitrary goes the
    // employee's way, which is why the distribution is ordered best-first.
    const even = [
      { band: 'Upper', targetPercent: 50, minScore: 50, incrementPercent: 10 },
      { band: 'Lower', targetPercent: 50, minScore: 0, incrementPercent: 5 },
    ];

    const bands = allocateBandCounts(1, even);

    expect(bands[0].targetCount).toBe(1);
    expect(bands[1].targetCount).toBe(0);
  });

  it('handles a headcount of zero', () => {
    const bands = allocateBandCounts(0);

    expect(bands.every((b) => b.targetCount === 0)).toBe(true);
  });

  it('falls back to the default when handed an empty distribution', () => {
    expect(allocateBandCounts(10, [])).toHaveLength(
      DEFAULT_DISTRIBUTION.length,
    );
  });
});

describe('bandForScore', () => {
  it.each([
    [95, 'Outstanding'],
    [90, 'Outstanding'],
    [85, 'Exceeds Expectations'],
    [70, 'Meets Expectations'],
    [60, 'Needs Improvement'],
    [0, 'Underperformer'],
  ])('maps %i to %s', (score, expected) => {
    expect(bandForScore(score)).toBe(expected);
  });
});

describe('applyForcedDistribution', () => {
  const entries = (count) =>
    Array.from({ length: count }, (_, i) => ({
      reviewId: `r${String(i).padStart(3, '0')}`,
      normalizedScore: 100 - i,
    }));

  it('assigns every person exactly once', () => {
    const result = applyForcedDistribution(entries(10));

    expect(result.assignments).toHaveLength(10);
    expect(new Set(result.assignments.map((a) => a.reviewId)).size).toBe(10);
  });

  it('fills bands best-first by rank', () => {
    const result = applyForcedDistribution(entries(10));

    expect(result.assignments[0]).toMatchObject({
      rank: 1,
      band: 'Outstanding',
    });
    expect(result.assignments[9]).toMatchObject({
      rank: 10,
      band: 'Underperformer',
    });
  });

  it('produces an underperformer even when everybody scored above 90', () => {
    // The most-argued-about property of a forced distribution, and the whole
    // reason it is called forced.
    const strong = Array.from({ length: 10 }, (_, i) => ({
      reviewId: `r${i}`,
      normalizedScore: 99 - i * 0.1,
    }));

    const result = applyForcedDistribution(strong);

    expect(result.assignments.some((a) => a.band === 'Underperformer')).toBe(
      true,
    );
    expect(result.movedCount).toBeGreaterThan(0);
  });

  it('records the band the score alone would have implied', () => {
    const strong = Array.from({ length: 10 }, (_, i) => ({
      reviewId: `r${i}`,
      normalizedScore: 99 - i * 0.1,
    }));

    const result = applyForcedDistribution(strong);
    const last = result.assignments[9];

    expect(last.band).toBe('Underperformer');
    expect(last.scoreImpliedBand).toBe('Outstanding');
  });

  it('breaks ties deterministically', () => {
    // Without a tie-break, two people on identical scores swap bands between
    // runs and the preview does not match what gets saved.
    const tied = [
      { reviewId: 'zzz', normalizedScore: 80 },
      { reviewId: 'aaa', normalizedScore: 80 },
      { reviewId: 'mmm', normalizedScore: 80 },
    ];

    const first = applyForcedDistribution(tied).assignments.map(
      (a) => a.reviewId,
    );
    const second = applyForcedDistribution([...tied].reverse()).assignments.map(
      (a) => a.reviewId,
    );

    expect(first).toEqual(second);
    expect(first[0]).toBe('aaa');
  });

  it('falls back to the original score when there is no normalised one', () => {
    const result = applyForcedDistribution([
      { reviewId: 'a', originalScore: 90 },
      { reviewId: 'b', originalScore: 50 },
    ]);

    expect(result.assignments[0].reviewId).toBe('a');
  });

  it('places the leftovers of an under-100 distribution rather than dropping them', () => {
    const short = [
      { band: 'Top', targetPercent: 10, minScore: 90, incrementPercent: 10 },
      { band: 'Rest', targetPercent: 40, minScore: 0, incrementPercent: 5 },
    ];

    const result = applyForcedDistribution(entries(10), short);

    expect(result.assignments).toHaveLength(10);
    expect(result.assignments.every((a) => a.band)).toBe(true);
  });

  it('handles an empty cohort', () => {
    const result = applyForcedDistribution([]);

    expect(result.headcount).toBe(0);
    expect(result.assignments).toHaveLength(0);
  });
});

describe('buildDistributionReport', () => {
  it('reports zero variance for a cohort already on target', () => {
    const result = applyForcedDistribution(
      Array.from({ length: 10 }, (_, i) => ({
        reviewId: `r${i}`,
        normalizedScore: 100 - i,
      })),
    );

    const report = buildDistributionReport(result.assignments);

    expect(report.isOnTarget).toBe(true);
    expect(report.totalVariance).toBe(0);
  });

  it('reports the gap when a cycle is top-heavy', () => {
    // Ten reviews rated by score alone, all of them above 90.
    const topHeavy = Array.from({ length: 10 }, (_, i) => ({
      reviewId: `r${i}`,
      normalizedScore: 95,
      band: 'Outstanding',
    }));

    const report = buildDistributionReport(topHeavy);

    expect(report.isOnTarget).toBe(false);
    expect(report.rows.find((r) => r.band === 'Outstanding').variance).toBe(9);
    expect(report.rows.find((r) => r.band === 'Underperformer').variance).toBe(
      -1,
    );
  });

  it('reports actual percentages that sum to 100', () => {
    const report = buildDistributionReport(
      Array.from({ length: 8 }, (_, i) => ({
        reviewId: `r${i}`,
        band: i < 3 ? 'Outstanding' : 'Meets Expectations',
      })),
    );

    const total = report.rows.reduce((sum, r) => sum + r.actualPercent, 0);

    expect(total).toBeCloseTo(100, 1);
  });
});

describe('calibrateIncrementBudget', () => {
  const staff = [
    { reviewId: 'a', monthlySalary: 100000, bandIncrementPercent: 15 },
    { reviewId: 'b', monthlySalary: 80000, bandIncrementPercent: 12 },
    { reviewId: 'c', monthlySalary: 60000, bandIncrementPercent: 8 },
  ];

  it('costs an increment annually, not monthly', () => {
    // Costing it as a single month is what makes a cycle look affordable and
    // land twelve times over budget.
    const result = calibrateIncrementBudget([staff[0]]);

    expect(result.requestedCost).toBe(180000); // 100000 * 15% * 12
  });

  it('leaves increments alone when they already fit', () => {
    const result = calibrateIncrementBudget(staff, { totalBudget: 10000000 });

    expect(result.scaled).toBe(false);
    expect(result.headroom).toBeGreaterThan(0);
    expect(result.assignments[0].approvedIncrementPercent).toBe(15);
  });

  it('never approves more than the envelope', () => {
    const result = calibrateIncrementBudget(staff, { totalBudget: 200000 });

    expect(result.scaled).toBe(true);
    expect(result.approvedCost).toBeLessThanOrEqual(200000);
  });

  it('preserves the relative ordering of the recommendations', () => {
    // Trimming the top of the range until it fits would silently rewrite the
    // calibration decision that was just made.
    const result = calibrateIncrementBudget(staff, { totalBudget: 150000 });

    const percents = result.assignments.map((a) => a.approvedIncrementPercent);

    expect(percents[0]).toBeGreaterThan(percents[1]);
    expect(percents[1]).toBeGreaterThan(percents[2]);
  });

  it('reports the cost without scaling when no budget is supplied', () => {
    const result = calibrateIncrementBudget(staff);

    expect(result.scaled).toBe(false);
    expect(result.totalBudget).toBeNull();
    expect(result.approvedCost).toBe(result.requestedCost);
  });

  it('recomputes the approved cost from the rounded percentages', () => {
    // Reporting `budget` directly would overstate what payroll will actually
    // cost, because each percentage is rounded to two places on the way.
    const result = calibrateIncrementBudget(staff, { totalBudget: 150000 });

    const recomputed = result.assignments.reduce(
      (sum, a) =>
        sum + (a.monthlySalary * a.approvedIncrementPercent * 12) / 100,
      0,
    );

    expect(result.approvedCost).toBeCloseTo(recomputed, 1);
  });

  it('handles a zero-cost cycle without dividing by zero', () => {
    const result = calibrateIncrementBudget(
      [{ reviewId: 'a', monthlySalary: 50000, bandIncrementPercent: 0 }],
      { totalBudget: 0 },
    );

    expect(result.scaled).toBe(false);
    expect(result.approvedCost).toBe(0);
    expect(Number.isFinite(result.scalingFactor)).toBe(true);
  });

  it('handles an empty cohort', () => {
    const result = calibrateIncrementBudget([], { totalBudget: 100000 });

    expect(result.requestedCost).toBe(0);
    expect(result.assignments).toHaveLength(0);
  });
});
