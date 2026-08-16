/**
 * @fileoverview Recruitment pipeline state machine, scorecards and funnel metrics.
 * @description Pure functions — no Mongoose, no I/O, no clock. Issue: #1074
 *
 * PaySphere covered an employee's life from the offer letter onwards
 * (`contract.model.js` issues offers, `onboarding.model.js` runs the joining
 * checklist) and nothing before it. The seam shows in the code that already
 * exists: `OfferLetterBuilder.jsx` posts a name, an email and a salary typed in
 * by hand, because there is no candidate record to draw them from.
 *
 * Three things in here are the reason this is a module and not a few fields on
 * a schema:
 *
 *   - **Stages are a state machine, not a string.** A free-text stage field
 *     lets a candidate go from `Applied` straight to `Hired` with no interview,
 *     and lets a rejected candidate quietly reappear in the funnel. The legal
 *     transitions are declared once, here, and every mover goes through them.
 *
 *   - **Funnel conversion counts who *reached* a stage, not who is sitting in
 *     it.** Those are different numbers and only the first one is meaningful:
 *     everyone who was ever offered has since moved on to hired or declined, so
 *     counting current occupancy reports an offer stage of zero and a
 *     conversion rate of zero for a team that is hiring fine.
 *
 *   - **Time-to-hire excludes candidates who have not been hired.** Treating an
 *     in-flight candidate as zero days drags the median towards zero, which
 *     makes a slow process look fast — the exact opposite of what the metric is
 *     for.
 */

'use strict';

/**
 * Pipeline stages and the transitions each one permits.
 *
 * `Rejected`, `Hired`, `OfferDeclined` and `Withdrawn` are terminal: their
 * arrays are empty, and that is the whole enforcement. Reopening a candidate is
 * done by creating a new application against the requisition, which keeps the
 * first application's history intact and honest.
 *
 * `Rejected` and `OfferDeclined` are deliberately separate. "We said no" and
 * "they said no" are different outcomes, and a funnel that conflates them
 * cannot tell a screening problem from a compensation problem.
 */
const PIPELINE_STAGES = Object.freeze({
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEWING: 'Interviewing',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  OFFER_DECLINED: 'OfferDeclined',
  WITHDRAWN: 'Withdrawn',
});

const STAGE_TRANSITIONS = Object.freeze({
  [PIPELINE_STAGES.APPLIED]: [
    PIPELINE_STAGES.SCREENING,
    PIPELINE_STAGES.REJECTED,
    PIPELINE_STAGES.WITHDRAWN,
  ],
  [PIPELINE_STAGES.SCREENING]: [
    PIPELINE_STAGES.INTERVIEWING,
    PIPELINE_STAGES.REJECTED,
    PIPELINE_STAGES.WITHDRAWN,
  ],
  [PIPELINE_STAGES.INTERVIEWING]: [
    PIPELINE_STAGES.OFFERED,
    PIPELINE_STAGES.REJECTED,
    PIPELINE_STAGES.WITHDRAWN,
  ],
  [PIPELINE_STAGES.OFFERED]: [
    PIPELINE_STAGES.HIRED,
    PIPELINE_STAGES.OFFER_DECLINED,
    PIPELINE_STAGES.WITHDRAWN,
  ],
  [PIPELINE_STAGES.HIRED]: [],
  [PIPELINE_STAGES.REJECTED]: [],
  [PIPELINE_STAGES.OFFER_DECLINED]: [],
  [PIPELINE_STAGES.WITHDRAWN]: [],
});

/**
 * The progression stages, in order, for funnel reporting.
 *
 * Excludes the exit stages: a funnel is about how far candidates got, and
 * `Rejected` is not a step further along than `Interviewing`.
 */
const FUNNEL_ORDER = Object.freeze([
  PIPELINE_STAGES.APPLIED,
  PIPELINE_STAGES.SCREENING,
  PIPELINE_STAGES.INTERVIEWING,
  PIPELINE_STAGES.OFFERED,
  PIPELINE_STAGES.HIRED,
]);

const TERMINAL_STAGES = Object.freeze([
  PIPELINE_STAGES.HIRED,
  PIPELINE_STAGES.REJECTED,
  PIPELINE_STAGES.OFFER_DECLINED,
  PIPELINE_STAGES.WITHDRAWN,
]);

const REQUISITION_STATUS = Object.freeze({
  DRAFT: 'Draft',
  OPEN: 'Open',
  ON_HOLD: 'OnHold',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
});

const RECOMMENDATIONS = Object.freeze({
  STRONG_HIRE: 'StrongHire',
  HIRE: 'Hire',
  NO_HIRE: 'NoHire',
  STRONG_NO_HIRE: 'StrongNoHire',
});

/** Numeric weight of each recommendation, for detecting a split panel. */
const RECOMMENDATION_SCORE = Object.freeze({
  [RECOMMENDATIONS.STRONG_HIRE]: 2,
  [RECOMMENDATIONS.HIRE]: 1,
  [RECOMMENDATIONS.NO_HIRE]: -1,
  [RECOMMENDATIONS.STRONG_NO_HIRE]: -2,
});

/**
 * Round to two decimals.
 *
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Whole days between two dates.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number|null} null when either date is unusable
 */
function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Median of a numeric list.
 *
 * Reported alongside the mean because hiring times are skewed: one candidate
 * who took eight months to close moves a mean of ten samples by weeks, and the
 * median is what an interviewer's experience actually looks like.
 *
 * @param {number[]} values
 * @returns {number|null}
 */
function median(values) {
  const sorted = values
    .filter((v) => Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);

  if (sorted.length === 0) return null;

  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round2((sorted[mid - 1] + sorted[mid]) / 2)
    : round2(sorted[mid]);
}

/**
 * Is `to` a legal next stage from `from`?
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function isLegalTransition(from, to) {
  const allowed = STAGE_TRANSITIONS[from];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(to);
}

/**
 * @param {string} stage
 * @returns {boolean}
 */
function isTerminalStage(stage) {
  return TERMINAL_STAGES.includes(stage);
}

/**
 * Apply a stage transition, returning the new stage and the history entry.
 *
 * Returns rather than mutates: the caller decides whether to persist, and a
 * function that half-applies a rejected transition is a function that leaves
 * documents in states nobody designed.
 *
 * The history entry is *appended*. Rewriting the last entry would erase the
 * record of how long a candidate sat in screening, which is the only source
 * `funnelMetrics` and `timeToHire` have.
 *
 * @param {object} candidate
 * @param {string} toStage
 * @param {object} [meta] `{ at, byUserId, note }`
 * @returns {{ok: boolean, error: string|null, allowedNext: string[], stage?: string, historyEntry?: object}}
 */
function applyTransition(candidate, toStage, meta = {}) {
  const from = candidate?.currentStage;
  const allowedNext = STAGE_TRANSITIONS[from] || [];

  if (!STAGE_TRANSITIONS[from]) {
    return {
      ok: false,
      error: `Unknown current stage: ${from}`,
      allowedNext: [],
    };
  }

  if (!STAGE_TRANSITIONS[toStage]) {
    return {
      ok: false,
      error: `Unknown target stage: ${toStage}`,
      allowedNext,
    };
  }

  if (from === toStage) {
    // Distinguished from an illegal move because it is usually a double-submit
    // rather than a mistake, and appending a no-op history entry would corrupt
    // the timings the funnel is derived from.
    return {
      ok: false,
      error: `Candidate is already at ${toStage}`,
      allowedNext,
    };
  }

  if (!isLegalTransition(from, toStage)) {
    const reason = isTerminalStage(from)
      ? `${from} is a terminal stage; create a new application to reconsider this candidate`
      : `Cannot move from ${from} to ${toStage}. Allowed: ${allowedNext.join(', ') || 'none'}`;

    return { ok: false, error: reason, allowedNext };
  }

  return {
    ok: true,
    error: null,
    allowedNext: STAGE_TRANSITIONS[toStage],
    stage: toStage,
    historyEntry: {
      stage: toStage,
      previousStage: from,
      at: meta.at ? new Date(meta.at) : new Date(),
      byUserId: meta.byUserId || null,
      note: meta.note || '',
    },
  };
}

/**
 * Aggregate interview feedback into a scorecard.
 *
 * `weights` maps a competency name to its weight. A competency with no weight
 * defaults to 1 rather than being dropped: silently ignoring feedback because
 * the weights table is out of date is worse than weighting it evenly.
 *
 * `dissent` is the point of the function. A panel averaging 3.5 because two
 * people said 5 and two said 2 has told you something completely different from
 * a panel where everyone said 3.5, and an average alone hides it.
 *
 * @param {Array<object>} feedbackList
 * @param {object} [weights]
 * @param {object} [options] `{ dissentSpread }` on the 1–5 scale
 * @returns {object}
 */
function scoreCard(feedbackList = [], weights = {}, options = {}) {
  const dissentSpread = Number(options.dissentSpread ?? 2);

  const perInterviewer = [];
  const competencyTotals = new Map();

  for (const feedback of feedbackList) {
    const ratings = Array.isArray(feedback?.ratings) ? feedback.ratings : [];
    if (ratings.length === 0) continue;

    let weightedSum = 0;
    let weightSum = 0;

    for (const rating of ratings) {
      const competency = String(rating?.competency || '').trim();
      const score = Number(rating?.score);
      if (!competency || !Number.isFinite(score)) continue;

      const weight = Number(weights[competency] ?? 1);
      weightedSum += score * weight;
      weightSum += weight;

      if (!competencyTotals.has(competency)) {
        competencyTotals.set(competency, { total: 0, count: 0 });
      }
      const entry = competencyTotals.get(competency);
      entry.total += score;
      entry.count += 1;
    }

    if (weightSum === 0) continue;

    perInterviewer.push({
      interviewerId: feedback.interviewerId || null,
      round: feedback.round || null,
      recommendation: feedback.recommendation || null,
      weightedScore: round2(weightedSum / weightSum),
    });
  }

  if (perInterviewer.length === 0) {
    return {
      hasFeedback: false,
      interviewerCount: 0,
      overallScore: null,
      spread: 0,
      dissent: false,
      recommendationSplit: false,
      byCompetency: [],
      perInterviewer: [],
    };
  }

  const scores = perInterviewer.map((entry) => entry.weightedScore);
  const overallScore = round2(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
  const spread = round2(Math.max(...scores) - Math.min(...scores));

  // A split panel: at least one interviewer on each side of the hire/no-hire
  // line. Independent of the numeric spread, because two interviewers can land
  // half a point apart and still disagree about the decision.
  const recommendationValues = perInterviewer
    .map((entry) => RECOMMENDATION_SCORE[entry.recommendation])
    .filter((value) => Number.isFinite(value));

  const recommendationSplit =
    recommendationValues.some((value) => value > 0) &&
    recommendationValues.some((value) => value < 0);

  const byCompetency = [...competencyTotals.entries()]
    .map(([competency, entry]) => ({
      competency,
      averageScore: round2(entry.total / entry.count),
      sampleSize: entry.count,
      weight: Number(weights[competency] ?? 1),
    }))
    .sort((a, b) => a.competency.localeCompare(b.competency));

  return {
    hasFeedback: true,
    interviewerCount: perInterviewer.length,
    overallScore,
    spread,
    dissent: spread >= dissentSpread || recommendationSplit,
    recommendationSplit,
    byCompetency,
    perInterviewer,
  };
}

/**
 * Every stage a candidate has ever reached.
 *
 * Derived from `stageHistory` rather than from `currentStage`, and this is the
 * distinction the whole funnel rests on. A candidate who was offered and then
 * declined is currently at `OfferDeclined`; they *reached* `Offered`, and the
 * offer stage should count them.
 *
 * The initial `Applied` is included whether or not it was written to history,
 * because applying is what created the record.
 *
 * @param {object} candidate
 * @returns {Set<string>}
 */
function stagesReached(candidate) {
  const reached = new Set([PIPELINE_STAGES.APPLIED]);

  for (const entry of candidate?.stageHistory || []) {
    if (entry?.stage) reached.add(entry.stage);
  }

  if (candidate?.currentStage) reached.add(candidate.currentStage);

  return reached;
}

/**
 * Funnel counts and stage-to-stage conversion.
 *
 * Conversion at stage N is `reached(N+1) / reached(N)`, which answers "of the
 * people who got this far, how many got further". Dividing by current
 * occupancy instead would report zero conversion for a team that is hiring
 * perfectly well, because everyone who was offered has since moved on.
 *
 * @param {Array<object>} candidates
 * @returns {object}
 */
function funnelMetrics(candidates = []) {
  const reachedCounts = Object.fromEntries(
    FUNNEL_ORDER.map((stage) => [stage, 0]),
  );
  const currentCounts = {};
  let rejected = 0;
  let declined = 0;
  let withdrawn = 0;

  for (const candidate of candidates) {
    const reached = stagesReached(candidate);

    for (const stage of FUNNEL_ORDER) {
      if (reached.has(stage)) reachedCounts[stage] += 1;
    }

    const current = candidate?.currentStage;
    if (current) currentCounts[current] = (currentCounts[current] || 0) + 1;

    if (reached.has(PIPELINE_STAGES.REJECTED)) rejected += 1;
    if (reached.has(PIPELINE_STAGES.OFFER_DECLINED)) declined += 1;
    if (reached.has(PIPELINE_STAGES.WITHDRAWN)) withdrawn += 1;
  }

  const conversion = [];
  for (let i = 0; i < FUNNEL_ORDER.length - 1; i += 1) {
    const from = FUNNEL_ORDER[i];
    const to = FUNNEL_ORDER[i + 1];
    const denominator = reachedCounts[from];

    conversion.push({
      from,
      to,
      // `null` rather than 0 when nobody reached the earlier stage. A rate of
      // zero says "everyone dropped out"; there is a real difference between
      // that and "nobody has got here yet".
      ratePercent:
        denominator > 0
          ? round2((reachedCounts[to] / denominator) * 100)
          : null,
      reachedFrom: denominator,
      reachedTo: reachedCounts[to],
    });
  }

  const offered = reachedCounts[PIPELINE_STAGES.OFFERED];
  const hired = reachedCounts[PIPELINE_STAGES.HIRED];

  return {
    totalCandidates: candidates.length,
    reached: reachedCounts,
    current: currentCounts,
    conversion,
    rejected,
    offerDeclined: declined,
    withdrawn,
    offerAcceptRatePercent:
      offered > 0 ? round2((hired / offered) * 100) : null,
  };
}

/**
 * Days from application to acceptance, over the candidates who were hired.
 *
 * In-flight and rejected candidates are excluded rather than counted as zero.
 * Counting them drags the median towards zero and makes a slow process look
 * fast, which is the opposite of what the metric is for.
 *
 * @param {Array<object>} candidates
 * @returns {object}
 */
function timeToHire(candidates = []) {
  const durations = [];

  for (const candidate of candidates) {
    const hire = (candidate?.stageHistory || []).find(
      (entry) => entry?.stage === PIPELINE_STAGES.HIRED,
    );
    if (!hire) continue;

    const applied = candidate.appliedAt || candidate.createdAt;
    const days = daysBetween(applied, hire.at);

    // A negative duration means the two dates disagree — a backdated
    // application, usually. Dropped rather than folded in, because a negative
    // time-to-hire is not a number anybody can act on.
    if (days === null || days < 0) continue;

    durations.push(days);
  }

  return {
    sampleSize: durations.length,
    medianDays: median(durations),
    meanDays:
      durations.length > 0
        ? round2(durations.reduce((sum, d) => sum + d, 0) / durations.length)
        : null,
    fastestDays: durations.length > 0 ? Math.min(...durations) : null,
    slowestDays: durations.length > 0 ? Math.max(...durations) : null,
  };
}

/**
 * Effectiveness by application source.
 *
 * Volume alone rewards whichever channel is loudest. The hire rate is what says
 * whether a channel is worth paying for.
 *
 * @param {Array<object>} candidates
 * @returns {Array<object>}
 */
function sourceEffectiveness(candidates = []) {
  const bySource = new Map();

  for (const candidate of candidates) {
    const source = String(candidate?.source || 'Unknown');
    if (!bySource.has(source)) {
      bySource.set(source, { source, applied: 0, interviewed: 0, hired: 0 });
    }

    const entry = bySource.get(source);
    const reached = stagesReached(candidate);

    entry.applied += 1;
    if (reached.has(PIPELINE_STAGES.INTERVIEWING)) entry.interviewed += 1;
    if (reached.has(PIPELINE_STAGES.HIRED)) entry.hired += 1;
  }

  return [...bySource.values()]
    .map((entry) => ({
      ...entry,
      hireRatePercent:
        entry.applied > 0 ? round2((entry.hired / entry.applied) * 100) : 0,
    }))
    .sort((a, b) => b.hired - a.hired || b.applied - a.applied);
}

/**
 * Check an offer against the requisition's approved CTC band.
 *
 * The band is the number finance signed off when the headcount was approved.
 * Offering above it is a real decision somebody should make deliberately, so it
 * is reported with the overage rather than rounded into an approval.
 *
 * Below-band is reported too, and is not an error. It is usually correct — a
 * junior hire against a band sized for a senior one — but it is worth surfacing
 * because the other explanation is a typo with a zero missing.
 *
 * @param {object} requisition
 * @param {number} offeredCtc
 * @returns {object}
 */
function checkOfferAgainstBand(requisition, offeredCtc) {
  const min = Number(requisition?.ctcBandMin);
  const max = Number(requisition?.ctcBandMax);
  const offered = Number(offeredCtc);

  if (!Number.isFinite(offered) || offered <= 0) {
    return {
      status: 'invalid',
      reason: 'Offered CTC must be a positive number',
    };
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return {
      status: 'no-band',
      reason: 'Requisition has no usable approved CTC band',
      offeredCtc: round2(offered),
    };
  }

  if (offered > max) {
    return {
      status: 'above',
      offeredCtc: round2(offered),
      ctcBandMin: round2(min),
      ctcBandMax: round2(max),
      overage: round2(offered - max),
      overagePercent: round2(((offered - max) / max) * 100),
      reason: `Offered CTC exceeds the approved band maximum by ${round2(offered - max)}`,
    };
  }

  if (offered < min) {
    return {
      status: 'below',
      offeredCtc: round2(offered),
      ctcBandMin: round2(min),
      ctcBandMax: round2(max),
      shortfall: round2(min - offered),
      reason: `Offered CTC is below the approved band minimum by ${round2(min - offered)}`,
    };
  }

  return {
    status: 'within',
    offeredCtc: round2(offered),
    ctcBandMin: round2(min),
    ctcBandMax: round2(max),
  };
}

/**
 * How full a requisition is.
 *
 * `hired` is counted from the candidates rather than read off a counter,
 * because a counter and a candidate list drift the first time a hire is
 * corrected — and the requisition is what stops a sixth person being hired
 * against five approved headcount.
 *
 * @param {object} requisition
 * @param {Array<object>} candidates
 * @returns {object}
 */
function requisitionFillState(requisition, candidates = []) {
  const openings = Math.max(0, Math.floor(Number(requisition?.openings) || 0));

  const hired = candidates.filter(
    (candidate) => candidate?.currentStage === PIPELINE_STAGES.HIRED,
  ).length;

  const inFlight = candidates.filter(
    (candidate) => !isTerminalStage(candidate?.currentStage),
  ).length;

  const remaining = Math.max(0, openings - hired);

  return {
    openings,
    hired,
    inFlight,
    remainingOpenings: remaining,
    // Over-hiring is possible through a data correction, so it is reported
    // rather than clamped away.
    overFilled: hired > openings,
    overFilledBy: hired > openings ? hired - openings : 0,
    // A suggestion, not an action. Auto-closing a requisition with candidates
    // still in interview loops would silently abandon them; the controller
    // closes only on an explicit call.
    shouldClose:
      remaining === 0 && requisition?.status === REQUISITION_STATUS.OPEN,
  };
}

/**
 * Can this candidate be hired against this requisition right now?
 *
 * @param {object} requisition
 * @param {Array<object>} candidates existing candidates on the requisition
 * @returns {{allowed: boolean, reason: string|null, fill: object}}
 */
function canHireAgainst(requisition, candidates = []) {
  const fill = requisitionFillState(requisition, candidates);

  if (requisition?.status !== REQUISITION_STATUS.OPEN) {
    return {
      allowed: false,
      reason: `Requisition is ${requisition?.status || 'in an unknown state'} and is not accepting hires`,
      fill,
    };
  }

  if (fill.remainingOpenings <= 0) {
    return {
      allowed: false,
      reason: `Requisition has ${fill.openings} opening(s) and ${fill.hired} already filled`,
      fill,
    };
  }

  return { allowed: true, reason: null, fill };
}

module.exports = {
  PIPELINE_STAGES,
  STAGE_TRANSITIONS,
  FUNNEL_ORDER,
  TERMINAL_STAGES,
  REQUISITION_STATUS,
  RECOMMENDATIONS,
  round2,
  daysBetween,
  median,
  isLegalTransition,
  isTerminalStage,
  applyTransition,
  scoreCard,
  stagesReached,
  funnelMetrics,
  timeToHire,
  sourceEffectiveness,
  checkOfferAgainstBand,
  requisitionFillState,
  canHireAgainst,
};
