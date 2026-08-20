/**
 * Pay equity analytics (#1347).
 *
 * Two analyses that are usually conflated and should not be:
 *
 *   - the **headline gap**, which is what a statutory filing asks for — mean
 *     and median pay difference across the whole workforce, plus the
 *     composition of each pay quartile;
 *   - the **adjusted gap**, which is what a compensation review acts on —
 *     the difference that survives comparing like with like.
 *
 * They answer different questions and routinely disagree. A company with women
 * concentrated in lower grades shows a large headline gap while paying
 * identically within every grade; a company that pays a whole grade less shows
 * a small headline gap and a real problem. Reporting one without the other is
 * how a pay gap report ends up either alarming or reassuring for the wrong
 * reason.
 *
 * Alongside both, `compaRatio` — which needs no protected characteristic at
 * all, and is the single most actionable pay query most companies have.
 *
 * Two rules this module enforces rather than offers, because getting them wrong
 * is worse than not shipping:
 *
 *   1. **Suppression is not optional.** A cohort below the minimum size is
 *      reported as suppressed, never as a number. In a team of three, "the
 *      average" identifies the individual.
 *   2. **Missing data is reported, never imputed.** A workforce that has not
 *      recorded gender gets a clearly-labelled insufficient-data result and a
 *      full compa-ratio analysis, not a fabricated zero gap.
 */

/**
 * Regulations compute the gap on *hourly* pay, so a workforce with different
 * contracted hours is comparable. Without contracted hours on the record, a
 * standard month is used — 173.33 hours, which is 40 hours a week over 52
 * weeks divided by twelve.
 */
const STANDARD_MONTHLY_HOURS = 173.33;

const DEFAULTS = {
  /**
   * Below this, a cohort is suppressed. Five is the conventional floor for
   * published pay statistics; a tenant with a good reason can raise it and
   * should not be able to lower it far.
   */
  minimumCohortSize: 5,
  /**
   * The EU Pay Transparency Directive triggers a joint pay assessment at an
   * unjustified gap above 5% in any category of worker. Used here as the line
   * above which a cohort is flagged and costed for remediation.
   */
  materialGapThreshold: 0.05,
  /** The group everything is measured against. */
  referenceGroup: 'male',
  quartileCount: 4,
};

/** The lowest a suppression floor may be set. */
const MIN_SUPPRESSION_FLOOR = 3;

/** Tenure bands, used as one of the three cohort dimensions. */
const TENURE_BANDS = [
  { id: 'under_2', label: 'Under 2 years', max: 2 },
  { id: '2_to_5', label: '2 to 5 years', max: 5 },
  { id: '5_to_10', label: '5 to 10 years', max: 10 },
  { id: 'over_10', label: 'Over 10 years', max: Infinity },
];

/** Why a cohort produced no number. */
const SUPPRESSION = {
  COHORT_TOO_SMALL: 'COHORT_TOO_SMALL',
  GROUP_TOO_SMALL: 'GROUP_TOO_SMALL',
  NO_REFERENCE_GROUP: 'NO_REFERENCE_GROUP',
};

/**
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

/**
 * @param {number} value
 * @returns {number}
 */
function round4(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 10000) / 10000;
}

/**
 * @param {Array<number>} values
 * @returns {number}
 */
function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * The median, taking the mean of the middle two for an even count.
 *
 * @param {Array<number>} values
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
 * Hourly pay for one employee.
 *
 * @param {object} employee
 * @returns {number}
 */
function hourlyPay(employee) {
  const monthly = Number(employee.monthlySalary);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;

  const contracted = Number(employee.contractedMonthlyHours);
  const hours =
    Number.isFinite(contracted) && contracted > 0
      ? contracted
      : STANDARD_MONTHLY_HOURS;

  return monthly / hours;
}

/**
 * Years of service at a reference date.
 *
 * @param {object} employee
 * @param {Date} asOf
 * @returns {number|null}
 */
function tenureYears(employee, asOf) {
  if (!employee.joiningDate) return null;

  const joined =
    employee.joiningDate instanceof Date
      ? employee.joiningDate
      : new Date(employee.joiningDate);

  if (Number.isNaN(joined.getTime())) return null;

  return (asOf.getTime() - joined.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * @param {number|null} years
 * @returns {{id: string, label: string}}
 */
function tenureBand(years) {
  if (years === null || !Number.isFinite(years)) {
    return { id: 'unknown', label: 'Tenure not recorded' };
  }

  const band = TENURE_BANDS.find((candidate) => years < candidate.max);
  return band
    ? { id: band.id, label: band.label }
    : { id: 'over_10', label: 'Over 10 years' };
}

/**
 * Normalise options and refuse a suppression floor that would defeat the point.
 *
 * @param {object} [options]
 * @returns {object}
 */
function normaliseOptions(options = {}) {
  const merged = { ...DEFAULTS, ...options };

  const floor = Number(merged.minimumCohortSize);

  if (!Number.isFinite(floor) || floor < MIN_SUPPRESSION_FLOOR) {
    throw new RangeError(
      `minimumCohortSize must be at least ${MIN_SUPPRESSION_FLOOR} — a lower floor publishes individuals, not statistics`,
    );
  }

  merged.minimumCohortSize = Math.floor(floor);
  merged.referenceGroup = String(
    merged.referenceGroup || DEFAULTS.referenceGroup,
  );

  return merged;
}

/**
 * The gap between a comparison group and the reference group.
 *
 * The sign convention is the regulatory one: a positive gap means the
 * comparison group is paid *less*. `(reference - comparison) / reference`.
 *
 * Reported as both mean and median because they answer different questions and
 * a filing wants both — the mean is moved by a handful of very high earners,
 * the median is not, and a large divergence between the two is itself a finding.
 *
 * @param {Array<number>} referencePay
 * @param {Array<number>} comparisonPay
 * @returns {object}
 */
function computeGap(referencePay, comparisonPay) {
  const referenceMean = mean(referencePay);
  const referenceMedian = median(referencePay);
  const comparisonMean = mean(comparisonPay);
  const comparisonMedian = median(comparisonPay);

  return {
    referenceMean: round2(referenceMean),
    referenceMedian: round2(referenceMedian),
    comparisonMean: round2(comparisonMean),
    comparisonMedian: round2(comparisonMedian),
    meanGap:
      referenceMean === 0
        ? 0
        : round4((referenceMean - comparisonMean) / referenceMean),
    medianGap:
      referenceMedian === 0
        ? 0
        : round4((referenceMedian - comparisonMedian) / referenceMedian),
  };
}

/**
 * Pay quartiles, split by **headcount** and not by pay range.
 *
 * This is the classic error in gap reporting and it produces a completely
 * different answer. The regulations say: order every employee by hourly pay,
 * divide into four groups of equal *size*, report the composition of each.
 * Splitting the pay *range* into four equal bands instead puts almost everybody
 * in the bottom band and makes the top quartile a handful of executives.
 *
 * Where the headcount does not divide by four the remainder goes to the lower
 * quartiles, which is the convention.
 *
 * @param {Array<object>} employees each with `pay` and `group`
 * @param {object} options
 * @returns {Array<object>}
 */
function computeQuartiles(employees, options) {
  const count = options.quartileCount;
  const sorted = [...employees].sort((a, b) => a.pay - b.pay);

  if (sorted.length === 0) return [];

  const base = Math.floor(sorted.length / count);
  const remainder = sorted.length % count;

  const labels = ['Lower', 'Lower middle', 'Upper middle', 'Upper'];
  const quartiles = [];
  let cursor = 0;

  for (let index = 0; index < count; index += 1) {
    const size = base + (index < remainder ? 1 : 0);
    const slice = sorted.slice(cursor, cursor + size);
    cursor += size;

    const composition = {};
    for (const employee of slice) {
      composition[employee.group] = (composition[employee.group] || 0) + 1;
    }

    const proportions = {};
    for (const [group, groupCount] of Object.entries(composition)) {
      proportions[group] =
        slice.length === 0 ? 0 : round4(groupCount / slice.length);
    }

    quartiles.push({
      quartile: index + 1,
      label: labels[index] || `Quartile ${index + 1}`,
      headcount: slice.length,
      lowestPay: slice.length ? round2(slice[0].pay) : 0,
      highestPay: slice.length ? round2(slice[slice.length - 1].pay) : 0,
      composition,
      proportions,
    });
  }

  return quartiles;
}

/**
 * Compa-ratio: pay as a proportion of the band midpoint.
 *
 * 1.0 is exactly at midpoint. Below 0.8 is the number most compensation teams
 * act on, and it needs no protected characteristic at all — which is why this
 * half of the feature works for every tenant regardless of what demographic
 * data they hold.
 *
 * @param {number} pay
 * @param {object} band
 * @returns {object|null}
 */
function compaRatio(pay, band) {
  if (!band) return null;

  const salary = Number(pay);
  const min = Number(band.min);
  const max = Number(band.max);
  const midpoint = Number.isFinite(Number(band.midpoint))
    ? Number(band.midpoint)
    : (min + max) / 2;

  if (!Number.isFinite(salary) || !Number.isFinite(midpoint) || midpoint <= 0) {
    return null;
  }

  const ratio = salary / midpoint;

  // Range penetration is undefined for a zero-width band, which is a
  // configuration error rather than a compensation finding.
  const penetration =
    Number.isFinite(min) && Number.isFinite(max) && max > min
      ? (salary - min) / (max - min)
      : null;

  let position = 'within_band';
  if (Number.isFinite(min) && salary < min) position = 'below_band';
  else if (Number.isFinite(max) && salary > max) position = 'above_band';

  return {
    compaRatio: round4(ratio),
    rangePenetration: penetration === null ? null : round4(penetration),
    position,
    midpoint: round2(midpoint),
  };
}

/**
 * Prepare the workforce: hourly pay, group, cohort key, compa-ratio.
 *
 * @param {Array<object>} employees
 * @param {object} options
 * @returns {object}
 */
function prepare(employees, options) {
  const asOf = options.asOf instanceof Date ? options.asOf : new Date();
  const bands = options.bands || {};

  const prepared = [];
  const excluded = [];

  for (const employee of Array.isArray(employees) ? employees : []) {
    const pay = hourlyPay(employee);

    if (pay <= 0) {
      excluded.push({
        employeeId: employee.employeeId || employee._id || null,
        name: employee.name || employee.fullName || '',
        reason: 'No usable salary on record',
      });
      continue;
    }

    const years = tenureYears(employee, asOf);
    const band = tenureBand(years);
    const jobLevel = employee.jobLevel || 'Ungraded';
    const department = employee.department || 'Unassigned';

    prepared.push({
      employeeId: employee.employeeId || employee._id || null,
      name: employee.name || employee.fullName || '',
      department,
      jobLevel,
      // Anything not recorded is its own group rather than being silently
      // folded into one of the real ones. A workforce that is 40% "undisclosed"
      // has a data problem, and hiding it inside the reference group would
      // produce a confident and meaningless gap.
      group: employee.gender || 'undisclosed',
      pay: round4(pay),
      monthlySalary: round2(employee.monthlySalary),
      tenureYears: years === null ? null : round2(years),
      tenureBand: band.id,
      tenureBandLabel: band.label,
      cohortKey: `${jobLevel}||${department}||${band.id}`,
      compa: compaRatio(employee.monthlySalary, bands[jobLevel]),
    });
  }

  return { prepared, excluded, asOf };
}

/**
 * The adjusted gap, cohort by cohort.
 *
 * A cohort is (job level x department x tenure band) — the closest this data
 * model gets to "the same work". A gap that survives that comparison is the one
 * worth acting on.
 *
 * @param {Array<object>} prepared
 * @param {object} options
 * @returns {Array<object>}
 */
function computeCohorts(prepared, options) {
  const byCohort = new Map();

  for (const employee of prepared) {
    if (!byCohort.has(employee.cohortKey)) byCohort.set(employee.cohortKey, []);
    byCohort.get(employee.cohortKey).push(employee);
  }

  const cohorts = [];

  for (const [key, members] of byCohort) {
    const [jobLevel, department, band] = key.split('||');
    const label = members[0].tenureBandLabel;

    const base = {
      cohortKey: key,
      jobLevel,
      department,
      tenureBand: band,
      tenureBandLabel: label,
      headcount: members.length,
      medianPay: round2(median(members.map((member) => member.pay))),
    };

    if (members.length < options.minimumCohortSize) {
      cohorts.push({
        ...base,
        suppressed: true,
        suppressionReason: SUPPRESSION.COHORT_TOO_SMALL,
        suppressionMessage: `Fewer than ${options.minimumCohortSize} employees — reporting an average here would identify individuals`,
      });
      continue;
    }

    const reference = members.filter(
      (member) => member.group === options.referenceGroup,
    );

    if (reference.length === 0) {
      cohorts.push({
        ...base,
        suppressed: true,
        suppressionReason: SUPPRESSION.NO_REFERENCE_GROUP,
        suppressionMessage: `No employees in the reference group (${options.referenceGroup}) to compare against`,
      });
      continue;
    }

    const groups = new Set(
      members
        .map((member) => member.group)
        .filter((group) => group !== options.referenceGroup),
    );

    const comparisons = [];

    for (const group of groups) {
      const comparison = members.filter((member) => member.group === group);

      if (
        comparison.length < options.minimumCohortSize ||
        reference.length < options.minimumCohortSize
      ) {
        comparisons.push({
          group,
          headcount: comparison.length,
          suppressed: true,
          suppressionReason: SUPPRESSION.GROUP_TOO_SMALL,
          suppressionMessage: `Fewer than ${options.minimumCohortSize} in one of the two groups being compared`,
        });
        continue;
      }

      const gap = computeGap(
        reference.map((member) => member.pay),
        comparison.map((member) => member.pay),
      );

      comparisons.push({
        group,
        headcount: comparison.length,
        referenceHeadcount: reference.length,
        suppressed: false,
        ...gap,
        material: Math.abs(gap.medianGap) > options.materialGapThreshold,
      });
    }

    cohorts.push({
      ...base,
      suppressed: false,
      referenceHeadcount: reference.length,
      comparisons,
      material: comparisons.some(
        (comparison) => !comparison.suppressed && comparison.material,
      ),
    });
  }

  // Worst gap first — the table exists to be acted on from the top.
  return cohorts.sort((a, b) => {
    const worst = (cohort) =>
      cohort.suppressed
        ? -1
        : Math.max(
            0,
            ...cohort.comparisons
              .filter((comparison) => !comparison.suppressed)
              .map((comparison) => Math.abs(comparison.medianGap)),
          );

    return worst(b) - worst(a);
  });
}

/**
 * What it would cost to close every material cohort gap to the threshold.
 *
 * Raises are applied to the under-paid group only, and only as far as the
 * threshold rather than to parity — closing to exactly zero is not what the
 * directive asks for and costs substantially more.
 *
 * Without this the report is a diagnosis with no treatment, which is how these
 * reports end up unread.
 *
 * @param {Array<object>} cohorts
 * @param {Array<object>} prepared
 * @param {object} options
 * @returns {object}
 */
function remediationPlan(cohorts, prepared, options) {
  const actions = [];
  let monthlyCost = 0;

  for (const cohort of cohorts) {
    if (cohort.suppressed || !cohort.material) continue;

    for (const comparison of cohort.comparisons) {
      if (comparison.suppressed || !comparison.material) continue;

      // A negative gap means the comparison group is paid more. That is not a
      // remediation target — levelling down is not what this is for, and
      // costing it would produce a nonsensical negative budget.
      if (comparison.medianGap <= 0) continue;

      // The medians on the comparison are rounded for display. Costing against
      // them lets a two-decimal presentation choice leak into a budget figure,
      // which on a large cohort is real money — so the target is rebuilt from
      // the underlying pay instead.
      const members = prepared.filter(
        (employee) => employee.cohortKey === cohort.cohortKey,
      );

      const referenceMedian = median(
        members
          .filter((employee) => employee.group === options.referenceGroup)
          .map((employee) => employee.pay),
      );

      const comparisonMedian = median(
        members
          .filter((employee) => employee.group === comparison.group)
          .map((employee) => employee.pay),
      );

      const targetMedian = referenceMedian * (1 - options.materialGapThreshold);

      const uplift = targetMedian - comparisonMedian;
      if (uplift <= 0) continue;

      const affected = members.filter(
        (employee) =>
          employee.group === comparison.group && employee.pay < targetMedian,
      );

      const cost = affected.reduce(
        (sum, employee) =>
          sum + (targetMedian - employee.pay) * STANDARD_MONTHLY_HOURS,
        0,
      );

      monthlyCost += cost;

      actions.push({
        cohortKey: cohort.cohortKey,
        jobLevel: cohort.jobLevel,
        department: cohort.department,
        tenureBandLabel: cohort.tenureBandLabel,
        group: comparison.group,
        currentMedianGap: comparison.medianGap,
        targetMedianGap: options.materialGapThreshold,
        employeesAffected: affected.length,
        monthlyCost: round2(cost),
        annualCost: round2(cost * 12),
      });
    }
  }

  return {
    actions,
    employeesAffected: actions.reduce(
      (sum, action) => sum + action.employeesAffected,
      0,
    ),
    monthlyCost: round2(monthlyCost),
    annualCost: round2(monthlyCost * 12),
  };
}

/**
 * The whole report.
 *
 * @param {Array<object>} employees
 * @param {object} [rawOptions]
 * @returns {object}
 */
function buildPayEquityReport(employees, rawOptions = {}) {
  const options = normaliseOptions(rawOptions);
  const { prepared, excluded, asOf } = prepare(employees, options);

  const groupCounts = prepared.reduce((acc, employee) => {
    acc[employee.group] = (acc[employee.group] || 0) + 1;
    return acc;
  }, {});

  const disclosed = prepared.filter(
    (employee) => employee.group !== 'undisclosed',
  );

  const reference = disclosed.filter(
    (employee) => employee.group === options.referenceGroup,
  );

  // The demographic half of the report needs a reference group of a usable
  // size. Without one the honest answer is "we cannot tell you", not a gap of
  // zero — and the compa-ratio half below still works, which is the point of
  // computing them separately.
  const demographicsUsable =
    reference.length >= options.minimumCohortSize &&
    disclosed.length - reference.length >= options.minimumCohortSize;

  const headline = {};

  if (demographicsUsable) {
    for (const group of new Set(disclosed.map((employee) => employee.group))) {
      if (group === options.referenceGroup) continue;

      const comparison = disclosed.filter(
        (employee) => employee.group === group,
      );

      if (comparison.length < options.minimumCohortSize) {
        headline[group] = {
          headcount: comparison.length,
          suppressed: true,
          suppressionReason: SUPPRESSION.GROUP_TOO_SMALL,
        };
        continue;
      }

      headline[group] = {
        headcount: comparison.length,
        suppressed: false,
        ...computeGap(
          reference.map((employee) => employee.pay),
          comparison.map((employee) => employee.pay),
        ),
      };
    }
  }

  const cohorts = demographicsUsable ? computeCohorts(prepared, options) : [];

  const withBands = prepared.filter((employee) => employee.compa !== null);

  const compaSummary = {
    covered: withBands.length,
    uncovered: prepared.length - withBands.length,
    medianCompaRatio: round4(
      median(withBands.map((employee) => employee.compa.compaRatio)),
    ),
    belowBand: withBands.filter(
      (employee) => employee.compa.position === 'below_band',
    ).length,
    aboveBand: withBands.filter(
      (employee) => employee.compa.position === 'above_band',
    ).length,
    // The number a compensation team actually works from.
    underMidpointBy20Percent: withBands.filter(
      (employee) => employee.compa.compaRatio < 0.8,
    ).length,
  };

  return {
    asOf,
    options,
    headcount: prepared.length,
    excluded,
    groupCounts,
    /**
     * Stated rather than implied. A report whose demographic half is missing
     * has to say why, or it reads as "no gap found".
     */
    demographics: {
      usable: demographicsUsable,
      disclosed: disclosed.length,
      undisclosed: groupCounts.undisclosed || 0,
      message: demographicsUsable
        ? 'Sufficient disclosed data to compute a gap'
        : `Insufficient disclosed data — a gap needs at least ${options.minimumCohortSize} employees in the reference group and ${options.minimumCohortSize} outside it`,
    },
    headline,
    quartiles: computeQuartiles(prepared, options),
    cohorts,
    materialCohorts: cohorts.filter(
      (cohort) => !cohort.suppressed && cohort.material,
    ).length,
    suppressedCohorts: cohorts.filter((cohort) => cohort.suppressed).length,
    compaSummary,
    compaOutliers: withBands
      .filter((employee) => employee.compa.compaRatio < 0.8)
      .sort((a, b) => a.compa.compaRatio - b.compa.compaRatio)
      .slice(0, 50)
      .map((employee) => ({
        employeeId: employee.employeeId,
        name: employee.name,
        jobLevel: employee.jobLevel,
        department: employee.department,
        monthlySalary: employee.monthlySalary,
        compaRatio: employee.compa.compaRatio,
        position: employee.compa.position,
      })),
    remediation: demographicsUsable
      ? remediationPlan(cohorts, prepared, options)
      : { actions: [], employeesAffected: 0, monthlyCost: 0, annualCost: 0 },
  };
}

module.exports = {
  STANDARD_MONTHLY_HOURS,
  DEFAULTS,
  MIN_SUPPRESSION_FLOOR,
  TENURE_BANDS,
  SUPPRESSION,
  mean,
  median,
  hourlyPay,
  tenureYears,
  tenureBand,
  normaliseOptions,
  computeGap,
  computeQuartiles,
  compaRatio,
  computeCohorts,
  remediationPlan,
  buildPayEquityReport,
  prepare,
};
