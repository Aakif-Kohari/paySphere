/**
 * Training validity, expiry and coverage-gap analysis (#1076).
 *
 * The cases that get the most attention are the ones where the obvious
 * implementation reports a *reassuring* wrong answer, because those are the ones
 * nobody investigates:
 *
 *   - a course that never expires reporting `validUntil: null` rather than a
 *     far-future sentinel that eventually arrives,
 *   - a department with no applicable employees reporting `null` rather than
 *     100% compliance,
 *   - "expiring" counting as compliant, so an audit number is not wrong for the
 *     last month of every renewal cycle,
 *   - a failing score not satisfying a mandatory course.
 *
 * Every date is fixed; the engine takes `asOf` precisely so they can be.
 */

'use strict';

const {
  ENROLLMENT_STATUS,
  CERTIFICATION_STATE,
  APPLIES_TO,
  addMonths,
  daysBetween,
  computeValidity,
  certificationState,
  isApplicable,
  evaluateAttempt,
  indexEnrollments,
  coverageGaps,
  complianceRate,
  complianceByDepartment,
  renewalsDue,
} = require('../trainingCompliance');

const NOW = '2026-08-16T00:00:00.000Z';

const course = (overrides = {}) => ({
  _id: 'c1',
  code: 'POSH-01',
  title: 'POSH awareness',
  isMandatory: true,
  appliesTo: APPLIES_TO.ALL,
  appliesToValues: [],
  passMark: 70,
  maxAttempts: 0,
  validityMonths: 12,
  reminderLeadDays: 30,
  ...overrides,
});

const completedOn = (date, overrides = {}) => ({
  _id: 'en1',
  employeeId: 'e1',
  courseId: 'c1',
  status: ENROLLMENT_STATUS.COMPLETED,
  completedAt: new Date(date),
  ...overrides,
});

const employee = (overrides = {}) => ({
  _id: 'e1',
  fullName: 'Asha Rao',
  department: 'Engineering',
  role: 'Backend Engineer',
  ...overrides,
});

describe('addMonths and daysBetween', () => {
  it('clamps rather than rolling over a short month', () => {
    // 31 January + 1 month is not 2 or 3 March. The error compounds across a
    // renewal cycle.
    expect(addMonths('2026-01-31T00:00:00.000Z', 1).toISOString()).toContain(
      '2026-02-28',
    );
  });

  it('comes back to the 31st in the next long month', () => {
    expect(addMonths('2026-01-31T00:00:00.000Z', 2).toISOString()).toContain(
      '2026-03-31',
    );
  });

  it('counts days forwards and backwards', () => {
    expect(daysBetween('2026-08-01', '2026-08-31')).toBe(30);
    expect(daysBetween('2026-08-31', '2026-08-01')).toBe(-30);
  });

  it('returns null rather than NaN for an unusable date', () => {
    expect(daysBetween('nope', '2026-08-01')).toBeNull();
  });
});

describe('computeValidity', () => {
  it('adds the validity period to the completion date', () => {
    const result = computeValidity(
      course({ validityMonths: 24 }),
      '2026-01-15',
    );

    expect(result.validUntil.toISOString()).toContain('2028-01-15');
    expect(result.neverExpires).toBe(false);
  });

  it('reports null for a course that never expires', () => {
    // Not a far-future sentinel. A sentinel is a date that eventually arrives,
    // and every consumer has to remember to special-case it; null cannot be
    // compared by accident.
    const result = computeValidity(course({ validityMonths: 0 }), '2026-01-15');

    expect(result.validUntil).toBeNull();
    expect(result.neverExpires).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('refuses an unusable completion date', () => {
    expect(computeValidity(course(), 'not-a-date').valid).toBe(false);
  });

  it('refuses a negative validity period', () => {
    expect(
      computeValidity(course({ validityMonths: -12 }), '2026-01-15').valid,
    ).toBe(false);
  });
});

describe('certificationState', () => {
  it('reports a fresh certification as valid', () => {
    const state = certificationState(completedOn('2026-06-01'), course(), NOW);

    expect(state.state).toBe(CERTIFICATION_STATE.VALID);
    expect(state.isCompliant).toBe(true);
  });

  it('reports a lapsed certification as expired', () => {
    const state = certificationState(completedOn('2025-01-01'), course(), NOW);

    expect(state.state).toBe(CERTIFICATION_STATE.EXPIRED);
    expect(state.isCompliant).toBe(false);
  });

  it('treats the expiry date itself as still valid', () => {
    // Off-by-one guard. Treating `validUntil` as expired takes a day off every
    // certification in the company.
    const state = certificationState(completedOn('2025-08-16'), course(), NOW);

    expect(state.state).not.toBe(CERTIFICATION_STATE.EXPIRED);
    expect(state.isCompliant).toBe(true);
  });

  it('reports expiring inside the course reminder lead', () => {
    // 12-month validity from 2025-09-01 → 2026-09-01, 16 days away, inside the
    // 30-day lead.
    const state = certificationState(completedOn('2025-09-01'), course(), NOW);

    expect(state.state).toBe(CERTIFICATION_STATE.EXPIRING);
    expect(state.daysRemaining).toBe(16);
  });

  it('counts an expiring certification as still compliant', () => {
    // "Expiring" is a prompt, not a breach. Reporting it as non-compliance
    // makes every audit number wrong for the last month of every cycle.
    const state = certificationState(completedOn('2025-09-01'), course(), NOW);

    expect(state.isCompliant).toBe(true);
  });

  it('uses the course lead rather than a global constant', () => {
    // A two-day external certification with a booked exam slot needs months of
    // notice; a four-hour refresher needs a fortnight.
    const longLead = certificationState(
      completedOn('2025-11-01'),
      course({ reminderLeadDays: 120 }),
      NOW,
    );
    const shortLead = certificationState(
      completedOn('2025-11-01'),
      course({ reminderLeadDays: 7 }),
      NOW,
    );

    expect(longLead.state).toBe(CERTIFICATION_STATE.EXPIRING);
    expect(shortLead.state).toBe(CERTIFICATION_STATE.VALID);
  });

  it('reports a never-expiring completion as permanently valid', () => {
    const state = certificationState(
      completedOn('2019-01-01'),
      course({ validityMonths: 0 }),
      NOW,
    );

    expect(state.state).toBe(CERTIFICATION_STATE.VALID);
    expect(state.validUntil).toBeNull();
  });

  it('treats assigned, in-progress and failed alike as incomplete', () => {
    // From a compliance point of view they are the same thing: this person does
    // not hold this certification.
    for (const status of [
      ENROLLMENT_STATUS.ASSIGNED,
      ENROLLMENT_STATUS.IN_PROGRESS,
      ENROLLMENT_STATUS.FAILED,
    ]) {
      const state = certificationState({ status }, course(), NOW);

      expect(state.state).toBe(CERTIFICATION_STATE.INCOMPLETE);
      expect(state.isCompliant).toBe(false);
    }
  });

  it('treats a missing enrolment as incomplete rather than throwing', () => {
    expect(certificationState(undefined, course(), NOW).state).toBe(
      CERTIFICATION_STATE.INCOMPLETE,
    );
  });

  it('treats a waiver as compliant', () => {
    const state = certificationState(
      { status: ENROLLMENT_STATUS.WAIVED },
      course(),
      NOW,
    );

    expect(state.state).toBe(CERTIFICATION_STATE.WAIVED);
    expect(state.isCompliant).toBe(true);
  });
});

describe('isApplicable', () => {
  it('applies an All course to everyone', () => {
    expect(isApplicable(course(), employee())).toBe(true);
  });

  it('matches a department course case-insensitively', () => {
    // `employee.model.js` has `department` as free text, so "Engineering" and
    // "engineering " are the same department. Treating them as different
    // silently drops people out of a mandatory course.
    const targeted = course({
      appliesTo: APPLIES_TO.DEPARTMENTS,
      appliesToValues: ['engineering'],
    });

    expect(
      isApplicable(targeted, employee({ department: '  Engineering ' })),
    ).toBe(true);
  });

  it('excludes an employee in a different department', () => {
    const targeted = course({
      appliesTo: APPLIES_TO.DEPARTMENTS,
      appliesToValues: ['Finance'],
    });

    expect(isApplicable(targeted, employee())).toBe(false);
  });

  it('matches on role when targeted by role', () => {
    const targeted = course({
      appliesTo: APPLIES_TO.ROLES,
      appliesToValues: ['Backend Engineer'],
    });

    expect(isApplicable(targeted, employee())).toBe(true);
  });

  it('applies an unrecognised targeting mode to nobody', () => {
    // Failing the other way would assign a role-specific safety course to the
    // whole company on the strength of a typo.
    expect(isApplicable(course({ appliesTo: 'Teams' }), employee())).toBe(
      false,
    );
  });
});

describe('evaluateAttempt', () => {
  it('passes a score at the pass mark', () => {
    // Inclusive: 70 on a pass mark of 70 is a pass.
    const result = evaluateAttempt(course(), 70, 1);

    expect(result.passed).toBe(true);
    expect(result.resultingStatus).toBe(ENROLLMENT_STATUS.COMPLETED);
  });

  it('fails a score below the pass mark and records Failed', () => {
    // Recording it as Completed would let a failing attempt satisfy a mandatory
    // course, which is the whole thing this feature exists to prevent.
    const result = evaluateAttempt(course(), 69, 1);

    expect(result.passed).toBe(false);
    expect(result.resultingStatus).toBe(ENROLLMENT_STATUS.FAILED);
  });

  it('refuses an attempt past the limit even if it would have passed', () => {
    const result = evaluateAttempt(course({ maxAttempts: 3 }), 100, 4);

    expect(result.accepted).toBe(false);
    expect(result.attemptsExhausted).toBe(true);
    expect(result.reason).toContain('3 attempt(s)');
  });

  it('allows the last permitted attempt', () => {
    expect(evaluateAttempt(course({ maxAttempts: 3 }), 80, 3).accepted).toBe(
      true,
    );
  });

  it('treats maxAttempts of 0 as unlimited', () => {
    const result = evaluateAttempt(course({ maxAttempts: 0 }), 80, 99);

    expect(result.accepted).toBe(true);
    expect(result.attemptsRemaining).toBeNull();
  });

  it('reports attempts remaining when there is a cap', () => {
    expect(
      evaluateAttempt(course({ maxAttempts: 3 }), 50, 1).attemptsRemaining,
    ).toBe(2);
  });

  it('refuses a score outside 0-100', () => {
    expect(evaluateAttempt(course(), 101, 1).accepted).toBe(false);
    expect(evaluateAttempt(course(), -1, 1).accepted).toBe(false);
    expect(evaluateAttempt(course(), 'abc', 1).accepted).toBe(false);
  });
});

describe('indexEnrollments', () => {
  it('prefers a completion over a failure for the same course', () => {
    // An employee who failed in March and passed in June is compliant; taking
    // whichever row the database returned first would make that a coin toss.
    const index = indexEnrollments([
      { employeeId: 'e1', courseId: 'c1', status: ENROLLMENT_STATUS.FAILED },
      completedOn('2026-06-01'),
    ]);

    expect(index.get('e1:c1').status).toBe(ENROLLMENT_STATUS.COMPLETED);
  });

  it('prefers the most recent of two completions', () => {
    const index = indexEnrollments([
      completedOn('2024-01-01'),
      completedOn('2026-06-01'),
    ]);

    expect(index.get('e1:c1').completedAt.toISOString()).toContain(
      '2026-06-01',
    );
  });
});

describe('coverageGaps', () => {
  const staff = [
    employee({ _id: 'e1', department: 'Engineering' }),
    employee({ _id: 'e2', fullName: 'Ravi Kumar', department: 'Engineering' }),
    employee({ _id: 'e3', fullName: 'Meera Nair', department: 'Finance' }),
  ];

  it('separates never-trained from lapsed', () => {
    // They need different follow-up: one is a scheduling problem, the other is
    // a missed renewal reminder, and one count hides which.
    const gaps = coverageGaps(
      [course()],
      staff,
      [
        completedOn('2026-06-01', { employeeId: 'e1' }),
        completedOn('2024-01-01', { _id: 'en2', employeeId: 'e2' }),
      ],
      NOW,
    );

    expect(gaps[0].coveredCount).toBe(1);
    expect(gaps[0].lapsed.map((e) => e.employeeId)).toEqual(['e2']);
    expect(gaps[0].neverTrained.map((e) => e.employeeId)).toEqual(['e3']);
  });

  it('only reports mandatory courses', () => {
    expect(
      coverageGaps([course({ isMandatory: false })], staff, [], NOW),
    ).toEqual([]);
  });

  it('respects the course targeting', () => {
    const gaps = coverageGaps(
      [
        course({
          appliesTo: APPLIES_TO.DEPARTMENTS,
          appliesToValues: ['Finance'],
        }),
      ],
      staff,
      [],
      NOW,
    );

    expect(gaps[0].applicableCount).toBe(1);
    expect(gaps[0].neverTrained[0].employeeId).toBe('e3');
  });

  it('reports null compliance for a course that applies to nobody', () => {
    // A course targeted at a department that no longer exists is not 100%
    // compliant — there is nothing to be compliant about, and a fabricated 100
    // inflates the company average with a course nobody takes.
    const gaps = coverageGaps(
      [
        course({
          appliesTo: APPLIES_TO.DEPARTMENTS,
          appliesToValues: ['Legal'],
        }),
      ],
      staff,
      [],
      NOW,
    );

    expect(gaps[0].applicableCount).toBe(0);
    expect(gaps[0].compliancePercent).toBeNull();
  });

  it('counts an expiring certification as covered', () => {
    const gaps = coverageGaps(
      [course()],
      [staff[0]],
      [completedOn('2025-09-01')],
      NOW,
    );

    expect(gaps[0].coveredCount).toBe(1);
    expect(gaps[0].gapCount).toBe(0);
  });

  it('counts a waiver as covered', () => {
    const gaps = coverageGaps(
      [course()],
      [staff[0]],
      [{ employeeId: 'e1', courseId: 'c1', status: ENROLLMENT_STATUS.WAIVED }],
      NOW,
    );

    expect(gaps[0].coveredCount).toBe(1);
  });

  it('sorts the worst gaps first', () => {
    const gaps = coverageGaps(
      [
        course({ _id: 'c1', code: 'A' }),
        course({
          _id: 'c2',
          code: 'B',
          appliesTo: APPLIES_TO.DEPARTMENTS,
          appliesToValues: ['Finance'],
        }),
      ],
      staff,
      [],
      NOW,
    );

    expect(gaps[0].courseCode).toBe('A');
    expect(gaps[0].gapCount).toBe(3);
  });
});

describe('complianceRate', () => {
  const staff = [
    employee({ _id: 'e1' }),
    employee({ _id: 'e2', department: 'Finance' }),
  ];

  it('counts obligations rather than employees or courses', () => {
    // An employee holding four of five certifications is 80% compliant, not
    // compliant and not non-compliant. Only counting obligations says so.
    const result = complianceRate(
      [course({ _id: 'c1' }), course({ _id: 'c2', code: 'FIRE-01' })],
      staff,
      [completedOn('2026-06-01', { employeeId: 'e1', courseId: 'c1' })],
      NOW,
    );

    expect(result.obligations).toBe(4);
    expect(result.met).toBe(1);
    expect(result.compliancePercent).toBe(25);
  });

  it('splits the shortfall into lapsed and never-trained', () => {
    const result = complianceRate(
      [course()],
      staff,
      [completedOn('2024-01-01', { employeeId: 'e1' })],
      NOW,
    );

    expect(result.lapsed).toBe(1);
    expect(result.neverTrained).toBe(1);
  });

  it('reports null rather than 0 when there are no obligations', () => {
    expect(complianceRate([], staff, [], NOW).compliancePercent).toBeNull();
  });
});

describe('complianceByDepartment', () => {
  const staff = [
    employee({ _id: 'e1', department: 'Engineering' }),
    employee({ _id: 'e2', department: 'Engineering' }),
    employee({ _id: 'e3', department: 'Finance' }),
  ];

  it('reports a rate per department', () => {
    const rows = complianceByDepartment(
      [course()],
      staff,
      [completedOn('2026-06-01', { employeeId: 'e1' })],
      NOW,
    );

    const engineering = rows.find((row) => row.department === 'Engineering');
    expect(engineering.compliancePercent).toBe(50);
  });

  it('reports null for a department with no obligations', () => {
    // An empty set is not a perfect score, and averaging a fabricated 100 makes
    // the company number optimistic in exactly the situation somebody relies
    // on it.
    const rows = complianceByDepartment(
      [
        course({
          appliesTo: APPLIES_TO.DEPARTMENTS,
          appliesToValues: ['Engineering'],
        }),
      ],
      staff,
      [],
      NOW,
    );

    expect(
      rows.find((row) => row.department === 'Finance').compliancePercent,
    ).toBeNull();
  });

  it('sorts the worst departments first and the empty ones last', () => {
    const rows = complianceByDepartment(
      [
        course({
          appliesTo: APPLIES_TO.DEPARTMENTS,
          appliesToValues: ['Engineering'],
        }),
      ],
      staff,
      [completedOn('2026-06-01', { employeeId: 'e1' })],
      NOW,
    );

    expect(rows[0].department).toBe('Engineering');
    expect(rows[rows.length - 1].compliancePercent).toBeNull();
  });

  it('buckets an employee with no department rather than dropping them', () => {
    const rows = complianceByDepartment(
      [course()],
      [employee({ _id: 'e9', department: '' })],
      [],
      NOW,
    );

    expect(rows[0].department).toBe('Unassigned');
  });
});

describe('renewalsDue', () => {
  const courses = [course()];

  it('includes what has already expired, not only what is about to', () => {
    // An expired certification is more urgent than an expiring one, and a list
    // that only looks forward is how a lapse survives a whole renewal cycle.
    const due = renewalsDue([completedOn('2024-01-01')], courses, NOW, 30);

    expect(due).toHaveLength(1);
    expect(due[0].state).toBe(CERTIFICATION_STATE.EXPIRED);
    expect(due[0].overdueDays).toBeGreaterThan(0);
  });

  it('includes an expiry inside the horizon', () => {
    const due = renewalsDue([completedOn('2025-09-01')], courses, NOW, 30);

    expect(due).toHaveLength(1);
    expect(due[0].state).toBe(CERTIFICATION_STATE.EXPIRING);
  });

  it('excludes an expiry beyond the horizon', () => {
    expect(renewalsDue([completedOn('2026-06-01')], courses, NOW, 30)).toEqual(
      [],
    );
  });

  it('never chases a certification that does not expire', () => {
    const due = renewalsDue(
      [completedOn('2019-01-01')],
      [course({ validityMonths: 0 })],
      NOW,
      3650,
    );

    expect(due).toEqual([]);
  });

  it('sorts the most overdue first', () => {
    const due = renewalsDue(
      [
        completedOn('2025-09-01', { _id: 'a', employeeId: 'e1' }),
        completedOn('2024-01-01', { _id: 'b', employeeId: 'e2' }),
      ],
      courses,
      NOW,
      30,
    );

    expect(due.map((item) => item.enrollmentId)).toEqual(['b', 'a']);
  });

  it('skips an enrolment whose course no longer exists', () => {
    // A deactivated course should not crash the renewal cron.
    expect(renewalsDue([completedOn('2024-01-01')], [], NOW, 30)).toEqual([]);
  });
});
