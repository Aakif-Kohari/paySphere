/**
 * POSH escalation, extension and committee-composition rules (#1157).
 *
 * Two properties carry most of the weight. Escalation must be idempotent — a
 * rung already raised must not be raised again on every subsequent evaluation,
 * which is what `isSLAAlertSent` was trying and failing to express. And a
 * lawfully extended inquiry must report as compliant, because a system that
 * calls a legal extension a breach trains people to ignore it.
 */

const {
  STATUTORY_INQUIRY_DAYS,
  MAX_EXTENSION_DAYS,
  MAX_TOTAL_INQUIRY_DAYS,
  INTERIM_RELIEF_RESPONSE_DAYS,
  resolveEffectiveDeadline,
  totalExtensionDays,
  resolveEscalationLevel,
  computeExtendedDeadline,
  validateCommitteeComposition,
  evaluateInterimRelief,
  bandForCaseAge,
  buildCaseAgeingReport,
} = require('../grievanceEscalation');

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** A fixed "now", so nothing here depends on the day it is run. */
const NOW = new Date('2026-08-17T00:00:00.000Z');

/**
 * A date `days` before NOW.
 */
function daysAgo(days) {
  return new Date(NOW.getTime() - days * MS_PER_DAY);
}

/**
 * A grievance as the controller would have written it. `slaDeadline` defaults
 * to filedAt + 90 days, which is what `fileGrievance` sets.
 */
function grievance({
  filedDaysAgo = 10,
  status = 'Under Inquiry',
  slaDeadline,
  escalations = [],
  extensions = [],
  ...rest
} = {}) {
  const filedAt = daysAgo(filedDaysAgo);

  return {
    _id: `case-${filedDaysAgo}`,
    caseNumber: `POSH-2026-${String(filedDaysAgo).padStart(3, '0')}`,
    filedAt,
    slaDeadline:
      slaDeadline ??
      new Date(filedAt.getTime() + STATUTORY_INQUIRY_DAYS * MS_PER_DAY),
    status,
    escalations,
    extensions,
    ...rest,
  };
}

/** An ICC member. */
function member(role, isWoman = false, isActive = true) {
  return {
    role,
    isWoman,
    isActive,
    userId: `${role}-${isWoman}-${Math.random()}`,
  };
}

/** A lawfully constituted committee: 4 members, PO, external, 50% women. */
function validCommittee() {
  return [
    member('Presiding Officer', true),
    member('Internal Member', true),
    member('Internal Member', false),
    member('External Member', false),
  ];
}

describe('resolveEffectiveDeadline', () => {
  it('uses the stored deadline where there is one', () => {
    const explicit = new Date('2027-01-01');

    expect(
      resolveEffectiveDeadline(grievance({ slaDeadline: explicit })),
    ).toEqual(explicit);
  });

  it('falls back to filing plus the statutory period', () => {
    // Cases filed before extensions existed have the field and the fallback
    // agreeing, so nothing has to be backfilled.
    const g = grievance({ filedDaysAgo: 10, slaDeadline: null });

    const expected = new Date(
      g.filedAt.getTime() + STATUTORY_INQUIRY_DAYS * MS_PER_DAY,
    );

    expect(resolveEffectiveDeadline(g)).toEqual(expected);
  });

  it('returns null for a case with no filing date', () => {
    expect(
      resolveEffectiveDeadline({ filedAt: null, slaDeadline: null }),
    ).toBeNull();
  });
});

describe('resolveEscalationLevel', () => {
  it('does not escalate a case inside the first month', () => {
    const result = resolveEscalationLevel(grievance({ filedDaysAgo: 10 }), NOW);

    expect(result.currentLevel.key).toBe('NONE');
    expect(result.nextLevel.key).toBe('PRESIDING_OFFICER');
    expect(result.isBreached).toBe(false);
  });

  it.each([
    [35, 'PRESIDING_OFFICER'],
    [65, 'ICC'],
    [95, 'EMPLOYER'],
    [200, 'STATUTORY_AUTHORITY'],
  ])('puts a case filed %i days ago at %s', (filedDaysAgo, expected) => {
    // A case at 89 days and one at 200 were indistinguishable under a single
    // boolean; they are four different rungs here.
    const result = resolveEscalationLevel(grievance({ filedDaysAgo }), NOW);

    expect(result.currentLevel.key).toBe(expected);
  });

  it('escalates to the ICC on closeness to the deadline as well as on age', () => {
    // An extended case is young against its deadline and old against its
    // filing date; a case approaching its deadline is the reverse. Both are
    // worth catching, so there are two independent triggers.
    const nearDeadline = grievance({
      filedDaysAgo: 20,
      slaDeadline: new Date(NOW.getTime() + 5 * MS_PER_DAY),
    });

    const result = resolveEscalationLevel(nearDeadline, NOW);

    expect(result.currentLevel.key).toBe('ICC');
    expect(result.daysRemaining).toBeLessThanOrEqual(15);
  });

  it('reports a breach once past the effective deadline', () => {
    const result = resolveEscalationLevel(
      grievance({ filedDaysAgo: 100 }),
      NOW,
    );

    expect(result.isBreached).toBe(true);
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it('does not report a lawfully extended case as breached', () => {
    // The failure the extension feature exists to fix: a system that calls a
    // legal extension a breach trains people to ignore breaches.
    const extended = grievance({
      filedDaysAgo: 100,
      slaDeadline: new Date(NOW.getTime() + 20 * MS_PER_DAY),
      extensions: [{ days: 30, reason: 'Witness unavailable' }],
    });

    const result = resolveEscalationLevel(extended, NOW);

    expect(result.isBreached).toBe(false);
    expect(result.extensionDaysGranted).toBe(30);
  });

  it('lists a reached rung as pending until it is in the ledger', () => {
    const result = resolveEscalationLevel(grievance({ filedDaysAgo: 35 }), NOW);

    expect(result.pendingEscalations.map((e) => e.levelKey)).toContain(
      'PRESIDING_OFFICER',
    );
  });

  it('does not re-raise a rung already in the ledger', () => {
    // Idempotency. Without it, every evaluation pages the same person again.
    const alreadyRaised = grievance({
      filedDaysAgo: 35,
      escalations: [{ levelKey: 'PRESIDING_OFFICER', raisedAt: daysAgo(4) }],
    });

    const result = resolveEscalationLevel(alreadyRaised, NOW);

    expect(result.currentLevel.key).toBe('PRESIDING_OFFICER');
    expect(result.pendingEscalations).toHaveLength(0);
  });

  it('raises only the rungs that are new when several are reached at once', () => {
    const partiallyRaised = grievance({
      filedDaysAgo: 95,
      escalations: [{ levelKey: 'PRESIDING_OFFICER' }],
    });

    const keys = resolveEscalationLevel(
      partiallyRaised,
      NOW,
    ).pendingEscalations.map((e) => e.levelKey);

    expect(keys).toEqual(['ICC', 'EMPLOYER']);
  });

  it.each(['Resolved', 'Dismissed'])('stops escalating a %s case', (status) => {
    // It may well have breached on the way. That is a reporting fact, not a
    // reason to keep paging the district officer.
    const result = resolveEscalationLevel(
      grievance({ filedDaysAgo: 200, status }),
      NOW,
    );

    expect(result.isClosed).toBe(true);
    expect(result.currentLevel.key).toBe('NONE');
    expect(result.pendingEscalations).toHaveLength(0);
    expect(result.isBreached).toBe(false);
  });

  it('reports when the next rung trips', () => {
    const result = resolveEscalationLevel(grievance({ filedDaysAgo: 10 }), NOW);

    expect(result.nextTriggerDate).toBeInstanceOf(Date);
    expect(result.nextTriggerDate.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('refuses a case with no filing date rather than guessing one', () => {
    const result = resolveEscalationLevel({ filedAt: null }, NOW);

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('filing date');
  });
});

describe('computeExtendedDeadline', () => {
  it('moves the deadline by the granted days', () => {
    const g = grievance({ filedDaysAgo: 80 });

    const result = computeExtendedDeadline(g, 30, { reason: 'Witness abroad' });

    expect(result.ok).toBe(true);
    expect(
      result.revisedDeadline.getTime() - result.previousDeadline.getTime(),
    ).toBe(30 * MS_PER_DAY);
    expect(result.totalInquiryDays).toBe(120);
  });

  it('requires a written reason', () => {
    // The Act's requirement is that the extension is recorded in writing with
    // reasons. An extension with an empty reason is the thing that requirement
    // exists to prevent, not a lesser version of it.
    const result = computeExtendedDeadline(grievance(), 15, { reason: '   ' });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('written reason');
  });

  it('caps a single extension', () => {
    const result = computeExtendedDeadline(
      grievance(),
      MAX_EXTENSION_DAYS + 1,
      {
        reason: 'Complex case',
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('single extension');
  });

  it('caps the total inquiry period across repeated extensions', () => {
    // Otherwise a case is extended indefinitely a month at a time until the
    // 90-day limit means nothing.
    const alreadyExtended = grievance({
      extensions: [{ days: 30 }, { days: 30 }, { days: 30 }],
    });

    const result = computeExtendedDeadline(alreadyExtended, 30, {
      reason: 'Still ongoing',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(String(MAX_TOTAL_INQUIRY_DAYS));
  });

  it('allows an extension that lands exactly on the ceiling', () => {
    const alreadyExtended = grievance({ extensions: [{ days: 60 }] });

    const result = computeExtendedDeadline(alreadyExtended, 30, {
      reason: 'Final extension',
    });

    expect(result.ok).toBe(true);
    expect(result.totalInquiryDays).toBe(MAX_TOTAL_INQUIRY_DAYS);
    expect(result.remainingExtensionAllowance).toBe(0);
  });

  it.each(['Resolved', 'Dismissed'])(
    'refuses to extend a %s case',
    (status) => {
      const result = computeExtendedDeadline(grievance({ status }), 15, {
        reason: 'Reopened',
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain(status);
    },
  );

  it.each([0, -5, 2.5])('rejects an extension of %s days', (days) => {
    const result = computeExtendedDeadline(grievance(), days, { reason: 'x' });

    expect(result.ok).toBe(false);
  });

  it('reports every problem at once rather than the first', () => {
    const result = computeExtendedDeadline(
      grievance({ status: 'Resolved' }),
      90,
      {
        reason: '',
      },
    );

    expect(result.errors.length).toBeGreaterThan(2);
  });

  it('extends from the current deadline, not from the original', () => {
    const alreadyExtended = grievance({
      filedDaysAgo: 100,
      slaDeadline: new Date(NOW.getTime() + 20 * MS_PER_DAY),
      extensions: [{ days: 30 }],
    });

    const result = computeExtendedDeadline(alreadyExtended, 15, {
      reason: 'Further evidence',
    });

    expect(result.revisedDeadline.getTime()).toBe(
      alreadyExtended.slaDeadline.getTime() + 15 * MS_PER_DAY,
    );
    expect(result.totalExtensionDays).toBe(45);
  });
});

describe('totalExtensionDays', () => {
  it('sums the ledger', () => {
    expect(
      totalExtensionDays({ extensions: [{ days: 30 }, { days: 15 }] }),
    ).toBe(45);
  });

  it('is zero for a case that has never been extended', () => {
    expect(totalExtensionDays({})).toBe(0);
    expect(totalExtensionDays({ extensions: [] })).toBe(0);
  });
});

describe('validateCommitteeComposition', () => {
  it('accepts a lawfully constituted committee', () => {
    const result = validateCommitteeComposition(validCommittee());

    expect(result.isValid).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.womenPercent).toBe(50);
  });

  it('rejects a committee with no Presiding Officer', () => {
    const members = validCommittee();
    members[0] = member('Internal Member', true);

    const result = validateCommitteeComposition(members);

    expect(result.isValid).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('PRESIDING_OFFICER');
  });

  it('rejects a committee with two Presiding Officers', () => {
    // The Presiding Officer has a casting role, and two of them makes a split
    // decision unresolvable.
    const members = validCommittee();
    members[1] = member('Presiding Officer', true);

    const result = validateCommitteeComposition(members);

    expect(result.isValid).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('PRESIDING_OFFICER');
  });

  it('rejects a committee with no External Member', () => {
    const members = validCommittee();
    members[3] = member('Internal Member', false);

    const result = validateCommitteeComposition(members);

    expect(result.failures.map((f) => f.rule)).toContain('EXTERNAL_MEMBER');
  });

  it('rejects a committee below the minimum women share', () => {
    const result = validateCommitteeComposition([
      member('Presiding Officer', false),
      member('Internal Member', false),
      member('Internal Member', false),
      member('External Member', true),
    ]);

    expect(result.womenPercent).toBe(25);
    expect(result.failures.map((f) => f.rule)).toContain('MIN_WOMEN');
  });

  it('rejects a committee that is too small', () => {
    const result = validateCommitteeComposition([
      member('Presiding Officer', true),
      member('External Member', false),
    ]);

    expect(result.failures.map((f) => f.rule)).toContain('MIN_MEMBERS');
  });

  it('ignores inactive members', () => {
    const members = [
      ...validCommittee(),
      member('Internal Member', false, false),
    ];

    const result = validateCommitteeComposition(members);

    expect(result.memberCount).toBe(4);
    expect(result.isValid).toBe(true);
  });

  it('reports every failure at once, not the first', () => {
    // A committee told it lacks a Presiding Officer, fixing that, and then
    // being told it is also short of women members has been given the same
    // news twice.
    const result = validateCommitteeComposition([
      member('Internal Member', false),
      member('Internal Member', false),
    ]);

    expect(result.failures.length).toBeGreaterThanOrEqual(3);
    expect(result.failures.map((f) => f.rule)).toEqual(
      expect.arrayContaining([
        'MIN_MEMBERS',
        'PRESIDING_OFFICER',
        'EXTERNAL_MEMBER',
      ]),
    );
  });

  it('handles an empty committee without dividing by zero', () => {
    const result = validateCommitteeComposition([]);

    expect(result.isValid).toBe(false);
    expect(result.womenPercent).toBe(0);
  });
});

describe('evaluateInterimRelief', () => {
  it('reports nothing for a case where no relief was asked for', () => {
    const result = evaluateInterimRelief(grievance(), NOW);

    expect(result.state).toBe('NOT_REQUESTED');
    expect(result.isBreached).toBe(false);
  });

  it('runs a shorter clock than the inquiry', () => {
    // A complainant asking to be moved away from the respondent cannot wait
    // ninety days for an answer.
    const requested = grievance({
      filedDaysAgo: 20,
      interimReliefRequestedAt: daysAgo(5),
    });

    const result = evaluateInterimRelief(requested, NOW);

    expect(result.state).toBe('PENDING');
    expect(result.daysRemaining).toBe(INTERIM_RELIEF_RESPONSE_DAYS - 5);
  });

  it('breaches independently of a compliant inquiry', () => {
    // The whole reason it is not folded into the same state.
    const g = grievance({
      filedDaysAgo: 20,
      interimReliefRequestedAt: daysAgo(40),
    });

    expect(resolveEscalationLevel(g, NOW).isBreached).toBe(false);
    expect(evaluateInterimRelief(g, NOW).isBreached).toBe(true);
    expect(evaluateInterimRelief(g, NOW).state).toBe('OVERDUE');
  });

  it('records a decision taken in time', () => {
    const result = evaluateInterimRelief(
      grievance({
        interimReliefRequestedAt: daysAgo(20),
        interimReliefDecidedAt: daysAgo(15),
        interimReliefGranted: true,
      }),
      NOW,
    );

    expect(result.state).toBe('GRANTED');
    expect(result.isBreached).toBe(false);
    expect(result.daysToDecision).toBe(5);
  });

  it('still reports a late decision as a breach after the fact', () => {
    // A relief request answered on day 40 is a compliance fact that does not
    // stop being one because it was eventually answered.
    const result = evaluateInterimRelief(
      grievance({
        interimReliefRequestedAt: daysAgo(60),
        interimReliefDecidedAt: daysAgo(20),
        interimReliefGranted: false,
      }),
      NOW,
    );

    expect(result.state).toBe('DECLINED');
    expect(result.isBreached).toBe(true);
    expect(result.daysToDecision).toBe(40);
  });
});

describe('bandForCaseAge', () => {
  it.each([
    [0, '0-30 days'],
    [30, '0-30 days'],
    [31, '31-60 days'],
    [90, '61-90 days'],
    [91, '90+ days'],
    [400, '90+ days'],
  ])('maps %i days to %s', (days, expected) => {
    expect(bandForCaseAge(days)).toBe(expected);
  });
});

describe('buildCaseAgeingReport', () => {
  const caseload = () => [
    grievance({ filedDaysAgo: 5 }),
    grievance({ filedDaysAgo: 40 }),
    grievance({ filedDaysAgo: 75 }),
    grievance({ filedDaysAgo: 120 }),
    grievance({ filedDaysAgo: 200, status: 'Resolved' }),
  ];

  it('counts only open cases', () => {
    const report = buildCaseAgeingReport(caseload(), NOW);

    expect(report.openCount).toBe(4);
  });

  it('buckets every open case exactly once', () => {
    const report = buildCaseAgeingReport(caseload(), NOW);

    const banded = report.ageing.reduce((sum, band) => sum + band.count, 0);

    expect(banded).toBe(report.openCount);
  });

  it('counts breaches', () => {
    const report = buildCaseAgeingReport(caseload(), NOW);

    expect(report.breachedCount).toBe(1);
    expect(report.ageing.find((b) => b.band === '90+ days').breachedCount).toBe(
      1,
    );
  });

  it('groups the caseload by escalation rung', () => {
    const report = buildCaseAgeingReport(caseload(), NOW);

    const counts = Object.fromEntries(
      report.byEscalationLevel.map((l) => [l.levelKey, l.count]),
    );

    // 5 days → not yet escalated; 40 → Presiding Officer; 75 → ICC, caught by
    // the 15-days-remaining trigger as well as by age; 120 → straight past
    // Employer to the statutory authority.
    expect(counts.NONE).toBe(1);
    expect(counts.PRESIDING_OFFICER).toBe(1);
    expect(counts.ICC).toBe(1);
    expect(counts.EMPLOYER).toBe(0);
    expect(counts.STATUTORY_AUTHORITY).toBe(1);
  });

  it('surfaces the soonest upcoming escalation', () => {
    // The single most useful line on the report: what happens next, and when.
    const report = buildCaseAgeingReport(caseload(), NOW);

    expect(report.nextEscalation).not.toBeNull();
    expect(report.nextEscalation.triggerDate).toBeInstanceOf(Date);
  });

  it('counts overdue interim relief separately from inquiry breaches', () => {
    const report = buildCaseAgeingReport(
      [grievance({ filedDaysAgo: 10, interimReliefRequestedAt: daysAgo(40) })],
      NOW,
    );

    expect(report.breachedCount).toBe(0);
    expect(report.interimReliefOverdueCount).toBe(1);
  });

  it('handles an empty caseload', () => {
    const report = buildCaseAgeingReport([], NOW);

    expect(report.openCount).toBe(0);
    expect(report.nextEscalation).toBeNull();
  });
});
