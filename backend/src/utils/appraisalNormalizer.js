/**
 * Cohort-level appraisal calibration: normalisation, forced distribution and
 * increment budget fitting.
 *
 * Pure functions — no database access — for the same reason `appraisalScorer.js`
 * is pure: these decide what somebody is paid next year, and that arithmetic
 * has to be testable against its boundaries in isolation (#1158).
 *
 * `appraisalScorer.js` scores one review at a time. `calculateFinalScore()`
 * weights goals at 70% and the manager's qualitative rating at 30%, and
 * `suggestIncrement()` maps the result onto a fixed band. Nothing looks across
 * a cohort, and three things follow from that:
 *
 *   - A manager who rates their whole team 4.5/5 produces a team of "exceeds
 *     expectations" scores, and a strict manager's equally strong team lands a
 *     band lower. The score is comparable within a manager and meaningless
 *     across them — yet it is what drives the increment.
 *   - There is no forced distribution, so a cycle cannot be fitted to a target
 *     rating spread.
 *   - `suggestIncrement()` hands out 15% to everyone scoring 90+ with no view
 *     of what that costs, so the total is only discovered by exporting the
 *     reviews and adding them up — after the ratings have been communicated.
 *
 * This module is the cohort view those three need.
 */

'use strict';

/**
 * The conventional five-band spread, as percentages of headcount.
 *
 * Order matters: bands are listed best-first, and the ranking in
 * `applyForcedDistribution` fills them in this order. `minScore` is advisory —
 * it is what the band means on the 0-100 scale — and is not what decides
 * membership under a forced distribution, where rank does.
 */
const DEFAULT_DISTRIBUTION = [
  {
    band: 'Outstanding',
    targetPercent: 10,
    minScore: 90,
    incrementPercent: 15,
  },
  {
    band: 'Exceeds Expectations',
    targetPercent: 20,
    minScore: 80,
    incrementPercent: 12,
  },
  {
    band: 'Meets Expectations',
    targetPercent: 40,
    minScore: 70,
    incrementPercent: 8,
  },
  {
    band: 'Needs Improvement',
    targetPercent: 20,
    minScore: 60,
    incrementPercent: 4,
  },
  {
    band: 'Underperformer',
    targetPercent: 10,
    minScore: 0,
    incrementPercent: 0,
  },
];

/**
 * Below this, a cohort is too small to normalise.
 *
 * Rescaling four scores against their own mean and standard deviation does not
 * remove manager bias, it manufactures a spread out of noise — and the result
 * is presented to an employee as an objective correction. Small cohorts are
 * reported as not normalisable and left exactly as they were.
 */
const MIN_COHORT_SIZE = 5;

/**
 * Below this, a manager's own mean is not a usable baseline.
 *
 * A manager with two reports has no distribution to speak of; centring their
 * scores on their own mean would move both to the company average regardless
 * of how they actually performed. Those reviews are normalised against the
 * company baseline instead.
 */
const MIN_MANAGER_COHORT_SIZE = 3;

/** Scores live on a 0-100 scale and normalisation must not take them off it. */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Hold a score on the scale it is defined on.
 *
 * @param {number} value
 * @returns {number}
 */
function clampScore(value) {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, value));
}

/**
 * A review's manager as a string key.
 *
 * Mongoose gives an ObjectId, a populated document, or a plain string
 * depending on how the review was loaded. Grouping on the raw value would put
 * the same manager in three different cohorts.
 *
 * @param {object} review
 * @returns {string}
 */
function managerKeyOf(review) {
  const manager = review?.managerId;
  if (!manager) return 'unassigned';
  if (typeof manager === 'string') return manager;
  if (manager._id) return String(manager._id);
  return String(manager);
}

/**
 * A review's own identity as a string key. Used only to break ranking ties.
 *
 * @param {object} review
 * @returns {string}
 */
function reviewKeyOf(review) {
  return String(review?._id ?? review?.id ?? review?.employeeId ?? '');
}

/**
 * The score a review is calibrated from.
 *
 * @param {object} review
 * @returns {number}
 */
function scoreOf(review) {
  const score = Number(review?.finalScore);
  return Number.isFinite(score) ? score : 0;
}

/**
 * Mean of a list of numbers, or 0 for an empty list.
 *
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Population standard deviation.
 *
 * Population rather than sample: a review cycle is the whole cohort being
 * calibrated, not a sample drawn from a larger one, so there is no degree of
 * freedom to give back.
 *
 * @param {number[]} values
 * @returns {number}
 */
function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

/**
 * Median, interpolating between the middle two for an even count.
 *
 * @param {number[]} values
 * @returns {number}
 */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Cohort statistics, and the per-manager leniency the whole feature is about.
 *
 * `leniencyDelta` is a manager's mean minus the company mean: positive means
 * they rate above the company, negative below. It is the number HR needs in a
 * calibration meeting, and it does not exist anywhere today.
 *
 * @param {object[]} reviews
 * @returns {object}
 */
function computeCohortStatistics(reviews) {
  const list = Array.isArray(reviews) ? reviews : [];
  const scores = list.map(scoreOf);

  const companyMean = mean(scores);
  const companySd = standardDeviation(scores);

  const groups = new Map();

  for (const review of list) {
    const key = managerKeyOf(review);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(review);
  }

  const byManager = [...groups.entries()]
    .map(([managerId, group]) => {
      const groupScores = group.map(scoreOf);
      const groupMean = mean(groupScores);

      return {
        managerId,
        count: group.length,
        mean: round2(groupMean),
        standardDeviation: round2(standardDeviation(groupScores)),
        min: round2(Math.min(...groupScores)),
        max: round2(Math.max(...groupScores)),
        leniencyDelta: round2(groupMean - companyMean),
        // Reported so the caller can explain why a manager's team was left
        // alone rather than silently treating it as normalised.
        isBaselineUsable: group.length >= MIN_MANAGER_COHORT_SIZE,
      };
    })
    .sort((a, b) => b.leniencyDelta - a.leniencyDelta);

  return {
    count: list.length,
    mean: round2(companyMean),
    standardDeviation: round2(companySd),
    median: round2(median(scores)),
    min: scores.length ? round2(Math.min(...scores)) : 0,
    max: scores.length ? round2(Math.max(...scores)) : 0,
    managerCount: byManager.length,
    byManager,
    // Two independent reasons a cohort cannot be normalised, reported
    // separately so the caller can say which one applies.
    isNormalizable: list.length >= MIN_COHORT_SIZE && companySd > 0,
    tooSmall: list.length < MIN_COHORT_SIZE,
    hasNoSpread: list.length > 0 && companySd === 0,
  };
}

/**
 * Rescale each score against its manager's cohort so scores are comparable
 * company-wide.
 *
 * Each review is expressed as a z-score within its manager's team and placed
 * back on the company distribution. The *ordering* within a team is untouched,
 * because a z-score transform is linear.
 *
 * ## Why the spread is not rescaled by default
 *
 * The textbook z-transform maps a team onto the company standard deviation.
 * That is wrong here, and visibly so. Take a four-person team a lenient
 * manager scored 95/92/90/88 inside a company averaging 78. Their spread is
 * narrow (sd ≈ 2.6) against a company sd of ≈ 13.5, so stretching them to the
 * company spread hands the top performer 97.7 — a *higher* score than the 95
 * their lenient manager gave them. A leniency correction that raises the
 * score of the most generously-rated person in the company is not a
 * correction.
 *
 * The narrow spread is not evidence the manager compressed their ratings; on a
 * four-person team it is mostly evidence that four people are four people.
 * So `scaleCorrection` defaults to 0, which removes the between-manager *bias*
 * — the leniency shift — and leaves each team's internal spread exactly as its
 * manager set it. That is the part of the score that is genuinely not
 * comparable across managers, and it is the part employees can be shown a
 * defensible explanation for.
 *
 * A caller who does want the full stretch can pass `scaleCorrection: 1`, and
 * anything between blends the two.
 *
 * ## Left alone rather than adjusted, and said so
 *
 *   - a cohort below `MIN_COHORT_SIZE`, or one with no spread at all;
 *   - a manager below `MIN_MANAGER_COHORT_SIZE`, whose reviews keep their
 *     score rather than being centred on a mean drawn from two data points;
 *   - a manager whose team all scored identically — there is no z to compute,
 *     so the leniency shift is applied without any scale term.
 *
 * @param {object[]} reviews
 * @param {object} [options]
 * @param {number} [options.scaleCorrection=0] 0 removes leniency only, 1 also
 *   stretches each team to the company spread
 * @param {number} [options.maxShift=15] the furthest a single score may move
 * @returns {object}
 */
function applyZScoreNormalization(reviews, options = {}) {
  const list = Array.isArray(reviews) ? reviews : [];
  const stats = computeCohortStatistics(list);

  if (!stats.isNormalizable) {
    return {
      ok: true,
      applied: false,
      reason: stats.tooSmall
        ? `Cohort of ${stats.count} is below the minimum of ${MIN_COHORT_SIZE} required to normalise`
        : 'Cohort has no score spread, so there is nothing to normalise',
      statistics: stats,
      reviews: list.map((review) => ({
        reviewId: reviewKeyOf(review),
        employeeId: review.employeeId ? String(review.employeeId) : null,
        managerId: managerKeyOf(review),
        originalScore: round2(scoreOf(review)),
        normalizedScore: round2(scoreOf(review)),
        delta: 0,
        normalized: false,
      })),
    };
  }

  // How far the rescale is allowed to move a single score. A z-score transform
  // on a lopsided cohort can otherwise move somebody twenty points, which is
  // not a correction anybody can explain to the employee it lands on.
  const maxShift = Number.isFinite(Number(options.maxShift))
    ? Math.abs(Number(options.maxShift))
    : 15;

  // 0 = remove leniency only, 1 = also stretch each team to the company
  // spread. See the note above for why 0 is the default.
  const scaleCorrection = Number.isFinite(Number(options.scaleCorrection))
    ? Math.min(1, Math.max(0, Number(options.scaleCorrection)))
    : 0;

  const byManager = new Map(
    stats.byManager.map((entry) => [entry.managerId, entry]),
  );

  const normalized = list.map((review) => {
    const original = scoreOf(review);
    const managerId = managerKeyOf(review);
    const managerStats = byManager.get(managerId);

    let target;
    let wasNormalized = true;
    let note = null;

    if (!managerStats || !managerStats.isBaselineUsable) {
      // Too few reports to draw a baseline from — leave the score where it is
      // rather than inventing a correction from two data points.
      target = original;
      wasNormalized = false;
      note = `Manager cohort below ${MIN_MANAGER_COHORT_SIZE}; score left uncorrected`;
    } else if (managerStats.standardDeviation === 0) {
      // Every report scored the same. There is no z to compute, so only the
      // leniency shift is removed and the team keeps its (flat) shape.
      target = stats.mean + (original - managerStats.mean);
      note =
        'Manager gave an identical score to every report; leniency shift only';
    } else {
      // Blend the team's own spread towards the company's. At the default
      // scaleCorrection of 0 this is `managerStats.standardDeviation`, the two
      // cancel, and the whole expression reduces to the leniency shift
      // `original - leniencyDelta`.
      const targetSd =
        managerStats.standardDeviation +
        scaleCorrection *
          (stats.standardDeviation - managerStats.standardDeviation);

      const z = (original - managerStats.mean) / managerStats.standardDeviation;
      target = stats.mean + z * targetSd;
    }

    const bounded = clampScore(
      Math.min(original + maxShift, Math.max(original - maxShift, target)),
    );

    return {
      reviewId: reviewKeyOf(review),
      employeeId: review.employeeId ? String(review.employeeId) : null,
      managerId,
      originalScore: round2(original),
      normalizedScore: round2(bounded),
      delta: round2(bounded - original),
      normalized: wasNormalized,
      note,
    };
  });

  return {
    ok: true,
    applied: true,
    reason: null,
    statistics: stats,
    maxShift,
    scaleCorrection,
    reviews: normalized,
  };
}

/**
 * Split a headcount across target percentages so the parts sum to exactly the
 * headcount.
 *
 * Largest-remainder allocation. Rounding each band independently is what makes
 * a 7-person cohort come out as 1 + 1 + 3 + 1 + 1 = 7 on a good day and 8 on a
 * bad one, and a distribution that does not sum to the headcount either drops
 * somebody or double-counts them.
 *
 * @param {number} headcount
 * @param {object[]} distribution
 * @returns {object[]} the distribution with a `targetCount` on each band
 */
function allocateBandCounts(headcount, distribution = DEFAULT_DISTRIBUTION) {
  const bands =
    Array.isArray(distribution) && distribution.length
      ? distribution
      : DEFAULT_DISTRIBUTION;

  const total = Math.max(0, Math.floor(Number(headcount) || 0));

  if (total === 0) {
    return bands.map((band) => ({ ...band, targetCount: 0 }));
  }

  const exact = bands.map(
    (band) => ((Number(band.targetPercent) || 0) * total) / 100,
  );
  const floors = exact.map((value) => Math.floor(value));

  let remaining = total - floors.reduce((sum, value) => sum + value, 0);

  // Hand the leftovers out by largest fractional part. Ties fall to the band
  // listed first, which is why DEFAULT_DISTRIBUTION is ordered best-first —
  // an unavoidable rounding decision goes in the employee's favour.
  const order = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const counts = [...floors];

  for (const entry of order) {
    if (remaining <= 0) break;
    counts[entry.index] += 1;
    remaining -= 1;
  }

  return bands.map((band, index) => ({ ...band, targetCount: counts[index] }));
}

/**
 * Rank the cohort and fit it to the target band sizes.
 *
 * Rank decides membership, not the raw score: that is what "forced" means. A
 * cohort where everybody scored above 90 still yields one underperformer,
 * which is the point of the exercise and also its most-argued-about property —
 * so the score each employee was ranked on is carried through onto the result
 * for the calibration meeting to look at.
 *
 * Ties break on the employee key so the same input always produces the same
 * output. Without it, two people on identical scores swap bands between runs
 * and the preview does not match what gets saved.
 *
 * @param {object[]} entries results from `applyZScoreNormalization`, or plain
 *   `{reviewId, normalizedScore}` rows
 * @param {object[]} [distribution]
 * @returns {object}
 */
function applyForcedDistribution(entries, distribution = DEFAULT_DISTRIBUTION) {
  const list = Array.isArray(entries) ? entries : [];

  const bands = allocateBandCounts(list.length, distribution);

  const ranked = [...list].sort((a, b) => {
    const scoreA = Number(a.normalizedScore ?? a.originalScore ?? 0);
    const scoreB = Number(b.normalizedScore ?? b.originalScore ?? 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return String(a.reviewId ?? '').localeCompare(String(b.reviewId ?? ''));
  });

  const assigned = [];
  let cursor = 0;

  for (const band of bands) {
    for (let i = 0; i < band.targetCount && cursor < ranked.length; i += 1) {
      const entry = ranked[cursor];

      assigned.push({
        ...entry,
        rank: cursor + 1,
        band: band.band,
        bandIncrementPercent: Number(band.incrementPercent) || 0,
        // What the band would have been on score alone. Where this disagrees
        // with `band`, the forced fit moved somebody — and that is exactly
        // what a calibration meeting needs to see.
        scoreImpliedBand: bandForScore(
          Number(entry.normalizedScore ?? entry.originalScore ?? 0),
          distribution,
        ),
      });

      cursor += 1;
    }
  }

  // Anything left over — only reachable if a caller passes a distribution whose
  // percentages sum below 100 — lands in the lowest band rather than vanishing.
  const lowest = bands[bands.length - 1];

  while (cursor < ranked.length) {
    assigned.push({
      ...ranked[cursor],
      rank: cursor + 1,
      band: lowest.band,
      bandIncrementPercent: Number(lowest.incrementPercent) || 0,
      scoreImpliedBand: bandForScore(
        Number(
          ranked[cursor].normalizedScore ?? ranked[cursor].originalScore ?? 0,
        ),
        distribution,
      ),
    });
    cursor += 1;
  }

  const movedCount = assigned.filter(
    (entry) => entry.band !== entry.scoreImpliedBand,
  ).length;

  return {
    ok: true,
    headcount: list.length,
    bands,
    assignments: assigned,
    movedCount,
  };
}

/**
 * The band a score falls in on its own, ignoring the forced fit.
 *
 * @param {number} score
 * @param {object[]} [distribution]
 * @returns {string}
 */
function bandForScore(score, distribution = DEFAULT_DISTRIBUTION) {
  const bands =
    Array.isArray(distribution) && distribution.length
      ? distribution
      : DEFAULT_DISTRIBUTION;

  const value = Number(score) || 0;

  for (const band of bands) {
    if (value >= (Number(band.minScore) || 0)) return band.band;
  }

  return bands[bands.length - 1].band;
}

/**
 * Report the cycle's actual spread against the target.
 *
 * @param {object[]} assignments
 * @param {object[]} [distribution]
 * @returns {object}
 */
function buildDistributionReport(
  assignments,
  distribution = DEFAULT_DISTRIBUTION,
) {
  const list = Array.isArray(assignments) ? assignments : [];
  const bands = allocateBandCounts(list.length, distribution);

  const actualCounts = new Map();

  for (const entry of list) {
    const band =
      entry.band ||
      bandForScore(entry.normalizedScore ?? entry.originalScore, distribution);
    actualCounts.set(band, (actualCounts.get(band) || 0) + 1);
  }

  const rows = bands.map((band) => {
    const actualCount = actualCounts.get(band.band) || 0;

    return {
      band: band.band,
      targetPercent: band.targetPercent,
      targetCount: band.targetCount,
      actualCount,
      actualPercent: list.length
        ? round2((actualCount / list.length) * 100)
        : 0,
      variance: actualCount - band.targetCount,
    };
  });

  return {
    headcount: list.length,
    rows,
    // Zero when the cohort already sits on the target spread.
    totalVariance: rows.reduce((sum, row) => sum + Math.abs(row.variance), 0),
    isOnTarget: rows.every((row) => row.variance === 0),
  };
}

/**
 * Scale recommended increments to fit a total budget.
 *
 * The cost of an increment is annual: a percentage of monthly salary, twelve
 * times over. Costing it as a single month is the mistake that makes a cycle
 * look affordable and lands twelve times over budget.
 *
 * Scaling is uniform, so the ordering of the recommendations survives — the
 * alternative, trimming the top of the range until it fits, silently rewrites
 * the calibration decision that was just made.
 *
 * @param {object[]} assignments rows carrying `bandIncrementPercent` and a
 *   `monthlySalary`
 * @param {object} [options]
 * @param {number} [options.totalBudget] the annual envelope; omitted, nothing
 *   is scaled and the cost is simply reported
 * @returns {object}
 */
function calibrateIncrementBudget(assignments, options = {}) {
  const list = Array.isArray(assignments) ? assignments : [];

  const priced = list.map((entry) => {
    const monthlySalary = Number(entry.monthlySalary) || 0;
    const percent =
      Number(entry.bandIncrementPercent ?? entry.recommendedIncrementPercent) ||
      0;

    return {
      ...entry,
      monthlySalary: round2(monthlySalary),
      recommendedIncrementPercent: round2(percent),
      annualCost: round2((monthlySalary * percent * 12) / 100),
    };
  });

  const requestedCost = round2(
    priced.reduce((sum, entry) => sum + entry.annualCost, 0),
  );

  const budget = Number(options.totalBudget);

  if (!Number.isFinite(budget) || budget < 0) {
    return {
      ok: true,
      scaled: false,
      reason:
        'No budget supplied; increments reported at their recommended level',
      totalBudget: null,
      requestedCost,
      approvedCost: requestedCost,
      scalingFactor: 1,
      assignments: priced.map((entry) => ({
        ...entry,
        approvedIncrementPercent: entry.recommendedIncrementPercent,
        approvedCost: entry.annualCost,
      })),
    };
  }

  if (requestedCost <= budget || requestedCost === 0) {
    return {
      ok: true,
      scaled: false,
      reason: 'Recommended increments already fit the budget',
      totalBudget: round2(budget),
      requestedCost,
      approvedCost: requestedCost,
      scalingFactor: 1,
      headroom: round2(budget - requestedCost),
      assignments: priced.map((entry) => ({
        ...entry,
        approvedIncrementPercent: entry.recommendedIncrementPercent,
        approvedCost: entry.annualCost,
      })),
    };
  }

  const factor = budget / requestedCost;

  const scaled = priced.map((entry) => {
    const approvedPercent = round2(entry.recommendedIncrementPercent * factor);

    return {
      ...entry,
      approvedIncrementPercent: approvedPercent,
      approvedCost: round2((entry.monthlySalary * approvedPercent * 12) / 100),
    };
  });

  return {
    ok: true,
    scaled: true,
    reason: `Recommended increments cost ${requestedCost}, which exceeds the budget of ${round2(budget)}`,
    totalBudget: round2(budget),
    requestedCost,
    // Recomputed from the rounded percentages rather than taken as
    // `budget`, so the figure reported is the one the payroll will actually
    // cost. Per-employee rounding means it lands a little under, never over.
    approvedCost: round2(
      scaled.reduce((sum, entry) => sum + entry.approvedCost, 0),
    ),
    scalingFactor: round2(factor * 10000) / 10000,
    assignments: scaled,
  };
}

module.exports = {
  DEFAULT_DISTRIBUTION,
  MIN_COHORT_SIZE,
  MIN_MANAGER_COHORT_SIZE,
  round2,
  clampScore,
  managerKeyOf,
  mean,
  standardDeviation,
  median,
  computeCohortStatistics,
  applyZScoreNormalization,
  allocateBandCounts,
  bandForScore,
  applyForcedDistribution,
  buildDistributionReport,
  calibrateIncrementBudget,
};
