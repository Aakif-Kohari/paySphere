/**
 * Recruitment pipeline engine (#1074).
 *
 * Three properties get the most attention here, because each is a place where a
 * plausible-looking implementation gives a confidently wrong answer:
 *
 *   - stage transitions are a state machine, so `Applied → Hired` and anything
 *     out of a terminal stage are refused;
 *   - funnel conversion counts who *reached* a stage, not who is sitting in it;
 *   - time-to-hire excludes candidates who have not been hired, rather than
 *     counting them as zero days.
 */

'use strict';

const {
  PIPELINE_STAGES,
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
} = require('../recruitmentPipeline');

/**
 * A candidate at `stage`, with a history that walks there through the normal
 * route. Built rather than hand-written because the funnel is derived from
 * history, and a fixture with a plausible `currentStage` and an empty history
 * would make the reached-vs-current tests below pass for the wrong reason.
 */
const candidateAt = (stage, overrides = {}) => {
  const path = [
    PIPELINE_STAGES.APPLIED,
    PIPELINE_STAGES.SCREENING,
    PIPELINE_STAGES.INTERVIEWING,
    PIPELINE_STAGES.OFFERED,
    PIPELINE_STAGES.HIRED,
  ];

  const walkTo = path.indexOf(stage);
  const walked = walkTo >= 0 ? path.slice(0, walkTo + 1) : path.slice(0, 1);

  const history = walked.map((s, i) => ({
    stage: s,
    previousStage: i === 0 ? null : walked[i - 1],
    at: new Date(Date.UTC(2026, 0, 1 + i * 7)),
  }));

  if (walkTo < 0) {
    // An exit stage: reached from wherever `exitFrom` says, defaulting to
    // screening.
    const from = overrides.exitFrom || PIPELINE_STAGES.SCREENING;
    const upto = path.slice(0, path.indexOf(from) + 1);
    history.length = 0;
    upto.forEach((s, i) => {
      history.push({
        stage: s,
        previousStage: i === 0 ? null : upto[i - 1],
        at: new Date(Date.UTC(2026, 0, 1 + i * 7)),
      });
    });
    history.push({
      stage,
      previousStage: from,
      at: new Date(Date.UTC(2026, 1, 1)),
    });
  }

  return {
    fullName: 'Test Candidate',
    source: 'JobBoard',
    appliedAt: new Date(Date.UTC(2026, 0, 1)),
    currentStage: stage,
    stageHistory: history,
    ...overrides,
  };
};

describe('round2 and median', () => {
  it('rounds to two decimals', () => {
    expect(round2(33.333)).toBe(33.33);
    expect(round2('nope')).toBe(0);
  });

  it('takes the middle of an odd-length list', () => {
    expect(median([10, 30, 20])).toBe(20);
  });

  it('averages the middle pair of an even-length list', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('returns null for an empty list rather than 0', () => {
    // Zero would read as "we hire instantly".
    expect(median([])).toBeNull();
  });

  it('ignores non-numeric entries', () => {
    expect(median([10, null, 20, undefined])).toBe(15);
  });
});

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
  });

  it('returns null rather than NaN for an unusable date', () => {
    expect(daysBetween('nonsense', '2026-01-31')).toBeNull();
  });
});

describe('isLegalTransition', () => {
  it('permits the normal progression', () => {
    expect(
      isLegalTransition(PIPELINE_STAGES.APPLIED, PIPELINE_STAGES.SCREENING),
    ).toBe(true);
    expect(
      isLegalTransition(PIPELINE_STAGES.INTERVIEWING, PIPELINE_STAGES.OFFERED),
    ).toBe(true);
    expect(
      isLegalTransition(PIPELINE_STAGES.OFFERED, PIPELINE_STAGES.HIRED),
    ).toBe(true);
  });

  it('refuses a skip straight from applied to hired', () => {
    // The single case this whole state machine exists to make impossible.
    expect(
      isLegalTransition(PIPELINE_STAGES.APPLIED, PIPELINE_STAGES.HIRED),
    ).toBe(false);
  });

  it('refuses to walk a candidate backwards', () => {
    expect(
      isLegalTransition(PIPELINE_STAGES.OFFERED, PIPELINE_STAGES.INTERVIEWING),
    ).toBe(false);
  });

  it('refuses any move out of a terminal stage', () => {
    for (const terminal of [
      PIPELINE_STAGES.HIRED,
      PIPELINE_STAGES.REJECTED,
      PIPELINE_STAGES.OFFER_DECLINED,
      PIPELINE_STAGES.WITHDRAWN,
    ]) {
      expect(isLegalTransition(terminal, PIPELINE_STAGES.SCREENING)).toBe(
        false,
      );
      expect(isTerminalStage(terminal)).toBe(true);
    }
  });

  it('permits rejection and withdrawal from any live stage', () => {
    for (const live of [
      PIPELINE_STAGES.APPLIED,
      PIPELINE_STAGES.SCREENING,
      PIPELINE_STAGES.INTERVIEWING,
    ]) {
      expect(isLegalTransition(live, PIPELINE_STAGES.REJECTED)).toBe(true);
      expect(isLegalTransition(live, PIPELINE_STAGES.WITHDRAWN)).toBe(true);
    }
  });

  it('separates a company rejection from a declined offer', () => {
    // "We said no" and "they said no" are different outcomes; a funnel that
    // conflates them cannot tell a screening problem from a pay problem.
    expect(
      isLegalTransition(
        PIPELINE_STAGES.OFFERED,
        PIPELINE_STAGES.OFFER_DECLINED,
      ),
    ).toBe(true);
    expect(
      isLegalTransition(PIPELINE_STAGES.OFFERED, PIPELINE_STAGES.REJECTED),
    ).toBe(false);
  });

  it('refuses an unknown stage on either side', () => {
    expect(isLegalTransition('Shortlisted', PIPELINE_STAGES.HIRED)).toBe(false);
    expect(isLegalTransition(PIPELINE_STAGES.APPLIED, 'Shortlisted')).toBe(
      false,
    );
  });
});

describe('applyTransition', () => {
  it('returns the new stage and an appendable history entry', () => {
    const result = applyTransition(
      candidateAt(PIPELINE_STAGES.APPLIED),
      PIPELINE_STAGES.SCREENING,
      {
        byUserId: 'u1',
        note: 'CV looks strong',
      },
    );

    expect(result.ok).toBe(true);
    expect(result.stage).toBe(PIPELINE_STAGES.SCREENING);
    expect(result.historyEntry.previousStage).toBe(PIPELINE_STAGES.APPLIED);
    expect(result.historyEntry.byUserId).toBe('u1');
  });

  it('does not mutate the candidate it was handed', () => {
    // A function that half-applies a transition leaves documents in states
    // nobody designed. The caller decides whether to persist.
    const candidate = candidateAt(PIPELINE_STAGES.APPLIED);
    const before = candidate.stageHistory.length;

    applyTransition(candidate, PIPELINE_STAGES.SCREENING);

    expect(candidate.currentStage).toBe(PIPELINE_STAGES.APPLIED);
    expect(candidate.stageHistory).toHaveLength(before);
  });

  it('names the legal next stages when it refuses', () => {
    const result = applyTransition(
      candidateAt(PIPELINE_STAGES.APPLIED),
      PIPELINE_STAGES.HIRED,
    );

    expect(result.ok).toBe(false);
    expect(result.allowedNext).toEqual([
      PIPELINE_STAGES.SCREENING,
      PIPELINE_STAGES.REJECTED,
      PIPELINE_STAGES.WITHDRAWN,
    ]);
  });

  it('explains that a terminal stage is terminal', () => {
    const result = applyTransition(
      candidateAt(PIPELINE_STAGES.REJECTED),
      PIPELINE_STAGES.SCREENING,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/terminal stage/);
    expect(result.error).toMatch(/create a new application/);
  });

  it('refuses a no-op move separately from an illegal one', () => {
    // Usually a double-submit. Appending a no-op history entry would corrupt
    // the timings the funnel is derived from.
    const result = applyTransition(
      candidateAt(PIPELINE_STAGES.SCREENING),
      PIPELINE_STAGES.SCREENING,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already at Screening/);
  });

  it('refuses an unknown target stage', () => {
    const result = applyTransition(
      candidateAt(PIPELINE_STAGES.APPLIED),
      'Shortlisted',
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unknown target stage/);
  });
});

describe('scoreCard', () => {
  const feedback = (interviewerId, scores, recommendation) => ({
    interviewerId,
    round: 'Technical',
    recommendation,
    ratings: Object.entries(scores).map(([competency, score]) => ({
      competency,
      score,
    })),
  });

  it('weights competencies as configured', () => {
    // Coding 5, Communication 1, weighted 3:1 → (15 + 1) / 4 = 4.
    const result = scoreCard(
      [feedback('a', { Coding: 5, Communication: 1 }, RECOMMENDATIONS.HIRE)],
      { Coding: 3, Communication: 1 },
    );

    expect(result.perInterviewer[0].weightedScore).toBe(4);
  });

  it('defaults an unweighted competency to 1 rather than dropping it', () => {
    // Silently ignoring feedback because the weights table is out of date is
    // worse than weighting it evenly.
    const result = scoreCard([
      feedback('a', { Coding: 5, SystemDesign: 1 }, RECOMMENDATIONS.HIRE),
    ]);

    expect(result.perInterviewer[0].weightedScore).toBe(3);
    expect(result.byCompetency.map((c) => c.competency)).toContain(
      'SystemDesign',
    );
  });

  it('flags a split panel on the numeric spread', () => {
    // Two people said 5 and two said 2. The average of 3.5 tells you nothing
    // like what actually happened.
    const result = scoreCard([
      feedback('a', { Coding: 5 }, RECOMMENDATIONS.HIRE),
      feedback('b', { Coding: 2 }, RECOMMENDATIONS.HIRE),
    ]);

    expect(result.overallScore).toBe(3.5);
    expect(result.spread).toBe(3);
    expect(result.dissent).toBe(true);
  });

  it('flags a split panel on the recommendation even when the scores agree', () => {
    // Two interviewers half a point apart can still disagree about the
    // decision, so the recommendation split is checked independently.
    const result = scoreCard([
      feedback('a', { Coding: 3 }, RECOMMENDATIONS.HIRE),
      feedback('b', { Coding: 3 }, RECOMMENDATIONS.NO_HIRE),
    ]);

    expect(result.spread).toBe(0);
    expect(result.recommendationSplit).toBe(true);
    expect(result.dissent).toBe(true);
  });

  it('does not flag dissent on an aligned panel', () => {
    const result = scoreCard([
      feedback('a', { Coding: 4 }, RECOMMENDATIONS.HIRE),
      feedback('b', { Coding: 4 }, RECOMMENDATIONS.STRONG_HIRE),
    ]);

    expect(result.dissent).toBe(false);
    expect(result.recommendationSplit).toBe(false);
  });

  it('reports no feedback distinctly from a score of zero', () => {
    const result = scoreCard([]);

    expect(result.hasFeedback).toBe(false);
    expect(result.overallScore).toBeNull();
  });

  it('skips a submission with no usable ratings', () => {
    const result = scoreCard([
      { interviewerId: 'a', ratings: [], recommendation: RECOMMENDATIONS.HIRE },
      feedback('b', { Coding: 4 }, RECOMMENDATIONS.HIRE),
    ]);

    expect(result.interviewerCount).toBe(1);
  });

  it('averages each competency across interviewers', () => {
    const result = scoreCard([
      feedback('a', { Coding: 5, Communication: 3 }, RECOMMENDATIONS.HIRE),
      feedback('b', { Coding: 3, Communication: 5 }, RECOMMENDATIONS.HIRE),
    ]);

    const coding = result.byCompetency.find((c) => c.competency === 'Coding');
    expect(coding.averageScore).toBe(4);
    expect(coding.sampleSize).toBe(2);
  });
});

describe('stagesReached', () => {
  it('counts a stage a candidate has passed through and left', () => {
    // The distinction the whole funnel rests on.
    const declined = candidateAt(PIPELINE_STAGES.OFFER_DECLINED, {
      exitFrom: PIPELINE_STAGES.OFFERED,
    });

    expect(stagesReached(declined).has(PIPELINE_STAGES.OFFERED)).toBe(true);
    expect(declined.currentStage).toBe(PIPELINE_STAGES.OFFER_DECLINED);
  });

  it('always includes Applied', () => {
    expect(
      stagesReached({ currentStage: PIPELINE_STAGES.SCREENING }).has(
        PIPELINE_STAGES.APPLIED,
      ),
    ).toBe(true);
  });
});

describe('funnelMetrics', () => {
  const cohort = () => [
    candidateAt(PIPELINE_STAGES.APPLIED),
    candidateAt(PIPELINE_STAGES.SCREENING),
    candidateAt(PIPELINE_STAGES.INTERVIEWING),
    candidateAt(PIPELINE_STAGES.HIRED),
    candidateAt(PIPELINE_STAGES.OFFER_DECLINED, {
      exitFrom: PIPELINE_STAGES.OFFERED,
    }),
    candidateAt(PIPELINE_STAGES.REJECTED, {
      exitFrom: PIPELINE_STAGES.SCREENING,
    }),
  ];

  it('counts everyone who reached each stage, not who is sitting in it', () => {
    // Nobody is currently at Offered — one was hired and one declined — and the
    // offer stage must still show two. Counting current occupancy reports zero
    // offers for a team that is hiring fine.
    const metrics = funnelMetrics(cohort());

    expect(metrics.current[PIPELINE_STAGES.OFFERED]).toBeUndefined();
    expect(metrics.reached[PIPELINE_STAGES.OFFERED]).toBe(2);
  });

  it('counts every candidate as having applied', () => {
    expect(funnelMetrics(cohort()).reached[PIPELINE_STAGES.APPLIED]).toBe(6);
  });

  it('computes conversion against the earlier stage that was reached', () => {
    const metrics = funnelMetrics(cohort());
    const appliedToScreening = metrics.conversion.find(
      (c) => c.from === PIPELINE_STAGES.APPLIED,
    );

    // Five of six got past Applied.
    expect(appliedToScreening.reachedFrom).toBe(6);
    expect(appliedToScreening.reachedTo).toBe(5);
    expect(appliedToScreening.ratePercent).toBe(83.33);
  });

  it('reports null conversion when nobody reached the earlier stage', () => {
    // "Nobody has got here yet" is a different fact from "everyone dropped out",
    // and 0% says the second.
    const metrics = funnelMetrics([candidateAt(PIPELINE_STAGES.APPLIED)]);
    const offeredToHired = metrics.conversion.find(
      (c) => c.from === PIPELINE_STAGES.OFFERED,
    );

    expect(offeredToHired.ratePercent).toBeNull();
  });

  it('computes the offer accept rate over everyone who was offered', () => {
    // One hired, one declined → 50%.
    expect(funnelMetrics(cohort()).offerAcceptRatePercent).toBe(50);
  });

  it('separates rejections, declined offers and withdrawals', () => {
    const metrics = funnelMetrics(cohort());

    expect(metrics.rejected).toBe(1);
    expect(metrics.offerDeclined).toBe(1);
    expect(metrics.withdrawn).toBe(0);
  });

  it('handles an empty pipeline without dividing by zero', () => {
    const metrics = funnelMetrics([]);

    expect(metrics.totalCandidates).toBe(0);
    expect(metrics.offerAcceptRatePercent).toBeNull();
    expect(metrics.conversion.every((c) => c.ratePercent === null)).toBe(true);
  });
});

describe('timeToHire', () => {
  const hiredAfter = (days) => ({
    appliedAt: new Date(Date.UTC(2026, 0, 1)),
    currentStage: PIPELINE_STAGES.HIRED,
    stageHistory: [
      { stage: PIPELINE_STAGES.APPLIED, at: new Date(Date.UTC(2026, 0, 1)) },
      {
        stage: PIPELINE_STAGES.HIRED,
        at: new Date(Date.UTC(2026, 0, 1) + days * 86400000),
      },
    ],
  });

  it('measures from application to the hire transition', () => {
    const result = timeToHire([hiredAfter(30)]);

    expect(result.sampleSize).toBe(1);
    expect(result.medianDays).toBe(30);
  });

  it('excludes candidates who have not been hired', () => {
    // Counting them as zero days drags the median towards zero and makes a slow
    // process look fast, which is the opposite of what the metric is for.
    const result = timeToHire([
      hiredAfter(40),
      candidateAt(PIPELINE_STAGES.INTERVIEWING),
      candidateAt(PIPELINE_STAGES.REJECTED),
    ]);

    expect(result.sampleSize).toBe(1);
    expect(result.medianDays).toBe(40);
  });

  it('reports the median separately from the mean', () => {
    // Hiring times are skewed: one eight-month close moves the mean by weeks,
    // and the median is what an interviewer's experience looks like.
    const result = timeToHire([
      hiredAfter(10),
      hiredAfter(20),
      hiredAfter(240),
    ]);

    expect(result.medianDays).toBe(20);
    expect(result.meanDays).toBe(90);
    expect(result.fastestDays).toBe(10);
    expect(result.slowestDays).toBe(240);
  });

  it('drops a negative duration rather than folding it in', () => {
    // A backdated application. A negative time-to-hire is not a number anybody
    // can act on.
    const backdated = hiredAfter(30);
    backdated.appliedAt = new Date(Date.UTC(2026, 5, 1));

    expect(timeToHire([backdated]).sampleSize).toBe(0);
  });

  it('reports nulls rather than zeros on an empty sample', () => {
    const result = timeToHire([]);

    expect(result.medianDays).toBeNull();
    expect(result.meanDays).toBeNull();
  });
});

describe('sourceEffectiveness', () => {
  it('ranks by hires and reports a hire rate', () => {
    // Volume alone rewards whichever channel is loudest.
    const result = sourceEffectiveness([
      candidateAt(PIPELINE_STAGES.HIRED, { source: 'Referral' }),
      candidateAt(PIPELINE_STAGES.REJECTED, {
        source: 'JobBoard',
        exitFrom: PIPELINE_STAGES.SCREENING,
      }),
      candidateAt(PIPELINE_STAGES.REJECTED, {
        source: 'JobBoard',
        exitFrom: PIPELINE_STAGES.SCREENING,
      }),
    ]);

    expect(result[0].source).toBe('Referral');
    expect(result[0].hireRatePercent).toBe(100);
    expect(result.find((r) => r.source === 'JobBoard').hireRatePercent).toBe(0);
  });

  it('buckets a missing source rather than dropping the candidate', () => {
    const result = sourceEffectiveness([
      candidateAt(PIPELINE_STAGES.APPLIED, { source: null }),
    ]);

    expect(result[0].source).toBe('Unknown');
  });
});

describe('checkOfferAgainstBand', () => {
  const requisition = { ctcBandMin: 1000000, ctcBandMax: 1500000 };

  it('accepts an offer inside the band', () => {
    expect(checkOfferAgainstBand(requisition, 1200000).status).toBe('within');
  });

  it('accepts an offer exactly at each boundary', () => {
    // The band is inclusive at both ends; an off-by-one here refuses a
    // perfectly ordinary offer.
    expect(checkOfferAgainstBand(requisition, 1000000).status).toBe('within');
    expect(checkOfferAgainstBand(requisition, 1500000).status).toBe('within');
  });

  it('reports an above-band offer with the overage', () => {
    const result = checkOfferAgainstBand(requisition, 1650000);

    expect(result.status).toBe('above');
    expect(result.overage).toBe(150000);
    expect(result.overagePercent).toBe(10);
  });

  it('reports a below-band offer without treating it as an error', () => {
    // Usually correct — a junior hire against a band sized for a senior one —
    // but worth surfacing, because the other explanation is a missing zero.
    const result = checkOfferAgainstBand(requisition, 800000);

    expect(result.status).toBe('below');
    expect(result.shortfall).toBe(200000);
  });

  it('refuses a non-positive offer', () => {
    expect(checkOfferAgainstBand(requisition, 0).status).toBe('invalid');
    expect(checkOfferAgainstBand(requisition, undefined).status).toBe(
      'invalid',
    );
  });

  it('reports a half-specified band as no band rather than a one-sided one', () => {
    expect(checkOfferAgainstBand({ ctcBandMin: 100000 }, 200000).status).toBe(
      'no-band',
    );
    expect(
      checkOfferAgainstBand({ ctcBandMax: 500000, ctcBandMin: 900000 }, 200000)
        .status,
    ).toBe('no-band');
  });
});

describe('requisitionFillState', () => {
  const requisition = { openings: 2, status: REQUISITION_STATUS.OPEN };

  it('counts hires from the candidates rather than from a counter', () => {
    const state = requisitionFillState(requisition, [
      candidateAt(PIPELINE_STAGES.HIRED),
      candidateAt(PIPELINE_STAGES.INTERVIEWING),
    ]);

    expect(state.hired).toBe(1);
    expect(state.remainingOpenings).toBe(1);
    expect(state.inFlight).toBe(1);
  });

  it('suggests closing once the openings are filled', () => {
    const state = requisitionFillState(requisition, [
      candidateAt(PIPELINE_STAGES.HIRED),
      candidateAt(PIPELINE_STAGES.HIRED),
    ]);

    expect(state.remainingOpenings).toBe(0);
    expect(state.shouldClose).toBe(true);
  });

  it('does not suggest closing a requisition that is not open', () => {
    const state = requisitionFillState(
      { openings: 1, status: REQUISITION_STATUS.CLOSED },
      [candidateAt(PIPELINE_STAGES.HIRED)],
    );

    expect(state.shouldClose).toBe(false);
  });

  it('reports over-filling rather than clamping it away', () => {
    // Reachable through a data correction, and silently hiding it means nobody
    // ever finds out the headcount was exceeded.
    const state = requisitionFillState(
      { openings: 1, status: REQUISITION_STATUS.OPEN },
      [candidateAt(PIPELINE_STAGES.HIRED), candidateAt(PIPELINE_STAGES.HIRED)],
    );

    expect(state.overFilled).toBe(true);
    expect(state.overFilledBy).toBe(1);
    expect(state.remainingOpenings).toBe(0);
  });

  it('does not count terminal non-hires as in flight', () => {
    const state = requisitionFillState(requisition, [
      candidateAt(PIPELINE_STAGES.REJECTED, {
        exitFrom: PIPELINE_STAGES.SCREENING,
      }),
      candidateAt(PIPELINE_STAGES.WITHDRAWN, {
        exitFrom: PIPELINE_STAGES.SCREENING,
      }),
    ]);

    expect(state.inFlight).toBe(0);
  });
});

describe('canHireAgainst', () => {
  it('allows a hire while an opening remains', () => {
    expect(
      canHireAgainst({ openings: 2, status: REQUISITION_STATUS.OPEN }, [
        candidateAt(PIPELINE_STAGES.HIRED),
      ]).allowed,
    ).toBe(true);
  });

  it('refuses once the openings are full, with the numbers', () => {
    const result = canHireAgainst(
      { openings: 1, status: REQUISITION_STATUS.OPEN },
      [candidateAt(PIPELINE_STAGES.HIRED)],
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/1 opening\(s\) and 1 already filled/);
  });

  it('refuses against a requisition that is not open', () => {
    for (const status of [
      REQUISITION_STATUS.DRAFT,
      REQUISITION_STATUS.ON_HOLD,
      REQUISITION_STATUS.CLOSED,
      REQUISITION_STATUS.CANCELLED,
    ]) {
      expect(canHireAgainst({ openings: 5, status }, []).allowed).toBe(false);
    }
  });
});
