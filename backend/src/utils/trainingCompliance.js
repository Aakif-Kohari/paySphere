/**
 * @fileoverview Training validity, certification expiry and coverage-gap analysis.
 * @description Pure functions — no Mongoose, no I/O, and no clock: every
 * function that depends on "now" takes an `asOf` argument. That is what lets the
 * renewal cron ask "what expires in the next 30 days" and a report ask "what was
 * our compliance position at the end of last quarter" through the same code.
 *
 * Issue: #1076
 *
 * `NAV_GROUPS` in the frontend has a "Learning" group, and everything under it —
 * Flashcards, the PYQ bank, Quiz Battle — is exam-prep content unrelated to
 * employment. There was no training record for employees anywhere in the
 * backend.
 *
 * That is a compliance problem rather than a feature wish. A lot of workplace
 * training is not optional: POSH awareness (which this codebase takes seriously
 * enough to have built an ICC committee engine for in `grievance.model.js`),
 * fire safety, data protection, and role-specific certifications that **expire**
 * and have to be renewed on a cycle. An employer that cannot produce "who was
 * trained, when, and is it still current" has no answer during an audit.
 *
 * The expiry half is the part a spreadsheet cannot fake. A certification
 * completed 23 months ago on a 24-month cycle is *about to* become a gap, and
 * the only useful moment to know that is before it happens.
 */

'use strict';

const ENROLLMENT_STATUS = Object.freeze({
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'InProgress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  WAIVED: 'Waived',
});

/**
 * Certification states.
 *
 * `EXPIRING` is not a stored status — it is derived from the date, so it can
 * never go stale. A stored "expiring" flag is only correct until the next day.
 */
const CERTIFICATION_STATE = Object.freeze({
  VALID: 'valid',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  INCOMPLETE: 'incomplete',
  WAIVED: 'waived',
});

/** How a course decides who it applies to. */
const APPLIES_TO = Object.freeze({
  ALL: 'All',
  DEPARTMENTS: 'Departments',
  ROLES: 'Roles',
});

const MS_PER_DAY = 86400000;

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
 * Add whole months, clamping the day rather than rolling over.
 *
 * A certification completed on 31 January with a one-month validity expires on
 * 28/29 February, not on 2 or 3 March. Left to the Date constructor it would be
 * the latter, and the error compounds across a renewal cycle.
 *
 * @param {Date|string} date
 * @param {number} months
 * @returns {Date}
 */
function addMonths(date, months) {
  const base = new Date(date);
  if (Number.isNaN(base.getTime())) return new Date(NaN);

  const day = base.getUTCDate();
  const target = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth() + Number(months || 0),
      1,
    ),
  );

  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));
  target.setUTCHours(
    base.getUTCHours(),
    base.getUTCMinutes(),
    base.getUTCSeconds(),
    base.getUTCMilliseconds(),
  );

  return target;
}

/**
 * Whole days from `from` to `to`.
 *
 * @param {Date|string} from
 * @param {Date|string} to
 * @returns {number|null}
 */
function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * When a completion stops being valid.
 *
 * `validityMonths: 0` means the course never expires — an induction, a one-off
 * briefing — and returns `validUntil: null` rather than a far-future sentinel.
 * A sentinel date is a number that eventually arrives, and every consumer has to
 * remember to special-case it; `null` cannot be compared by accident.
 *
 * @param {object} course
 * @param {Date|string} completedAt
 * @returns {{validUntil: Date|null, neverExpires: boolean, valid: boolean, reason?: string}}
 */
function computeValidity(course, completedAt) {
  const months = Number(course?.validityMonths ?? 0);
  const completed = new Date(completedAt);

  if (Number.isNaN(completed.getTime())) {
    return {
      validUntil: null,
      neverExpires: false,
      valid: false,
      reason: 'completedAt is not a valid date',
    };
  }

  if (!Number.isFinite(months) || months < 0) {
    return {
      validUntil: null,
      neverExpires: false,
      valid: false,
      reason: 'validityMonths must be zero or a positive number of months',
    };
  }

  if (months === 0) {
    return { validUntil: null, neverExpires: true, valid: true };
  }

  return {
    validUntil: addMonths(completed, months),
    neverExpires: false,
    valid: true,
  };
}

/**
 * The state of one enrolment on a given date.
 *
 * `expiring` is bounded by the *course's own* reminder lead rather than by a
 * global constant, because the notice a certification needs depends on how long
 * it takes to retake. A four-hour refresher wants two weeks; a two-day external
 * certification with a booked exam slot wants three months.
 *
 * @param {object} enrollment
 * @param {object} course
 * @param {Date|string} asOf
 * @returns {object}
 */
function certificationState(enrollment, course, asOf = new Date()) {
  const when = new Date(asOf);

  if (enrollment?.status === ENROLLMENT_STATUS.WAIVED) {
    return {
      state: CERTIFICATION_STATE.WAIVED,
      validUntil: null,
      daysRemaining: null,
      isCompliant: true,
    };
  }

  if (
    enrollment?.status !== ENROLLMENT_STATUS.COMPLETED ||
    !enrollment?.completedAt
  ) {
    // Assigned, in progress, failed — all the same thing from a compliance
    // point of view: this person does not hold this certification.
    return {
      state: CERTIFICATION_STATE.INCOMPLETE,
      validUntil: null,
      daysRemaining: null,
      isCompliant: false,
    };
  }

  const validity = computeValidity(course, enrollment.completedAt);

  if (!validity.valid) {
    return {
      state: CERTIFICATION_STATE.INCOMPLETE,
      validUntil: null,
      daysRemaining: null,
      isCompliant: false,
      reason: validity.reason,
    };
  }

  if (validity.neverExpires) {
    return {
      state: CERTIFICATION_STATE.VALID,
      validUntil: null,
      daysRemaining: null,
      isCompliant: true,
    };
  }

  const daysRemaining = daysBetween(when, validity.validUntil);

  // Strictly after `validUntil`. A certification is valid *on* its last day —
  // treating the expiry date itself as expired takes a day off every
  // certification in the company.
  if (validity.validUntil.getTime() < when.getTime()) {
    return {
      state: CERTIFICATION_STATE.EXPIRED,
      validUntil: validity.validUntil,
      daysRemaining,
      isCompliant: false,
    };
  }

  const leadDays = Math.max(0, Number(course?.reminderLeadDays ?? 30));

  if (daysRemaining <= leadDays) {
    return {
      state: CERTIFICATION_STATE.EXPIRING,
      validUntil: validity.validUntil,
      daysRemaining,
      // Still compliant. "Expiring" is a prompt, not a breach, and reporting it
      // as non-compliance would make every audit number wrong for the last
      // month of every cycle.
      isCompliant: true,
    };
  }

  return {
    state: CERTIFICATION_STATE.VALID,
    validUntil: validity.validUntil,
    daysRemaining,
    isCompliant: true,
  };
}

/**
 * Does this course apply to this employee?
 *
 * Comparison is case-insensitive and trimmed on both sides. Department strings
 * are typed by hand in this product — `employee.model.js` has `department` as a
 * free-text field — so "Engineering" and "engineering " are the same department
 * and treating them as different silently drops people out of a mandatory
 * course.
 *
 * @param {object} course
 * @param {object} employee
 * @returns {boolean}
 */
function isApplicable(course, employee) {
  const normalise = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase();

  switch (course?.appliesTo) {
    case APPLIES_TO.DEPARTMENTS: {
      const targets = (course.appliesToValues || []).map(normalise);
      return targets.includes(normalise(employee?.department));
    }
    case APPLIES_TO.ROLES: {
      const targets = (course.appliesToValues || []).map(normalise);
      return targets.includes(normalise(employee?.role));
    }
    case APPLIES_TO.ALL:
      return true;
    default:
      // An unrecognised targeting mode is treated as applying to nobody rather
      // than to everybody. Failing the other way would assign a role-specific
      // safety course to the whole company on the strength of a typo.
      return false;
  }
}

/**
 * Was this attempt a pass, and is another one allowed?
 *
 * @param {object} course
 * @param {number} score
 * @param {number} attemptNumber 1-based
 * @returns {object}
 */
function evaluateAttempt(course, score, attemptNumber = 1) {
  const passMark = Number(course?.passMark ?? 0);
  const maxAttempts = Number(course?.maxAttempts ?? 0);
  const value = Number(score);
  const attempt = Math.max(1, Math.floor(Number(attemptNumber) || 1));

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return {
      accepted: false,
      passed: false,
      reason: 'Score must be between 0 and 100',
    };
  }

  // `maxAttempts: 0` means unlimited. Nonzero is a hard cap, and it is checked
  // before the score so a fifth attempt is refused whether or not it passed.
  if (maxAttempts > 0 && attempt > maxAttempts) {
    return {
      accepted: false,
      passed: false,
      reason: `Course allows ${maxAttempts} attempt(s); this is attempt ${attempt}`,
      attemptsExhausted: true,
    };
  }

  const passed = value >= passMark;

  return {
    accepted: true,
    passed,
    score: round2(value),
    passMark,
    attempt,
    attemptsRemaining:
      maxAttempts > 0 ? Math.max(0, maxAttempts - attempt) : null,
    // A failed attempt records `Failed`, not `Completed`, and therefore sets no
    // validity. Recording it as complete would let a failing score satisfy a
    // mandatory course.
    resultingStatus: passed
      ? ENROLLMENT_STATUS.COMPLETED
      : ENROLLMENT_STATUS.FAILED,
  };
}

/**
 * Index enrolments by `employeeId:courseId`, keeping the best one.
 *
 * "Best" means the most recent *valid* completion, falling back to the most
 * recent record of any kind. An employee who failed in March and passed in June
 * is compliant; taking whichever row the database returned first would make that
 * a coin toss.
 *
 * @param {Array<object>} enrollments
 * @returns {Map<string, object>}
 */
function indexEnrollments(enrollments = []) {
  const index = new Map();

  for (const enrollment of enrollments) {
    const key = `${enrollment?.employeeId}:${enrollment?.courseId}`;
    const existing = index.get(key);

    if (!existing) {
      index.set(key, enrollment);
      continue;
    }

    const isCompleted = enrollment?.status === ENROLLMENT_STATUS.COMPLETED;
    const existingCompleted = existing?.status === ENROLLMENT_STATUS.COMPLETED;

    if (isCompleted && !existingCompleted) {
      index.set(key, enrollment);
      continue;
    }

    if (isCompleted === existingCompleted) {
      const a = new Date(
        enrollment?.completedAt || enrollment?.assignedAt || 0,
      );
      const b = new Date(existing?.completedAt || existing?.assignedAt || 0);
      if (a.getTime() > b.getTime()) index.set(key, enrollment);
    }
  }

  return index;
}

/**
 * Who is missing a certification they are required to hold.
 *
 * "Never trained" and "lapsed" are reported separately because they need
 * different follow-up: one is a scheduling problem, the other is a renewal
 * reminder that was missed, and rolling them into a single count hides which.
 *
 * @param {Array<object>} courses
 * @param {Array<object>} employees
 * @param {Array<object>} enrollments
 * @param {Date|string} asOf
 * @returns {Array<object>}
 */
function coverageGaps(
  courses = [],
  employees = [],
  enrollments = [],
  asOf = new Date(),
) {
  const index = indexEnrollments(enrollments);
  const results = [];

  for (const course of courses) {
    if (!course?.isMandatory) continue;

    const applicable = employees.filter((employee) =>
      isApplicable(course, employee),
    );

    const neverTrained = [];
    const lapsed = [];
    const covered = [];

    for (const employee of applicable) {
      const enrollment = index.get(`${employee._id}:${course._id}`);
      const state = certificationState(enrollment, course, asOf);

      const entry = {
        employeeId: employee._id,
        fullName: employee.fullName,
        department: employee.department,
        state: state.state,
        validUntil: state.validUntil,
        daysRemaining: state.daysRemaining,
      };

      if (state.isCompliant) {
        covered.push(entry);
      } else if (state.state === CERTIFICATION_STATE.EXPIRED) {
        lapsed.push(entry);
      } else {
        neverTrained.push(entry);
      }
    }

    results.push({
      courseId: course._id,
      courseCode: course.code,
      courseTitle: course.title,
      applicableCount: applicable.length,
      coveredCount: covered.length,
      neverTrained,
      lapsed,
      gapCount: neverTrained.length + lapsed.length,
      // `null`, not 100, when the course applies to nobody. A course targeted at
      // a department that no longer exists is not 100% compliant; there is
      // nothing to be compliant about, and reporting it as a perfect score
      // inflates the company average with a course nobody takes.
      compliancePercent:
        applicable.length > 0
          ? round2((covered.length / applicable.length) * 100)
          : null,
    });
  }

  return results.sort((a, b) => b.gapCount - a.gapCount);
}

/**
 * Company-wide compliance across every mandatory course.
 *
 * The rate is over *obligations* — one employee × one applicable course — rather
 * than over employees or over courses. An employee who holds four of five
 * certifications is 80% compliant, not compliant and not non-compliant, and only
 * counting obligations says so.
 *
 * @param {Array<object>} courses
 * @param {Array<object>} employees
 * @param {Array<object>} enrollments
 * @param {Date|string} asOf
 * @returns {object}
 */
function complianceRate(
  courses = [],
  employees = [],
  enrollments = [],
  asOf = new Date(),
) {
  const gaps = coverageGaps(courses, employees, enrollments, asOf);

  let obligations = 0;
  let met = 0;
  let lapsed = 0;
  let neverTrained = 0;

  for (const gap of gaps) {
    obligations += gap.applicableCount;
    met += gap.coveredCount;
    lapsed += gap.lapsed.length;
    neverTrained += gap.neverTrained.length;
  }

  return {
    mandatoryCourses: gaps.length,
    obligations,
    met,
    lapsed,
    neverTrained,
    compliancePercent:
      obligations > 0 ? round2((met / obligations) * 100) : null,
    coursesWithGaps: gaps.filter((gap) => gap.gapCount > 0).length,
  };
}

/**
 * Compliance broken down by department.
 *
 * A department with no applicable employees reports `null` rather than 100%, for
 * the same reason as above: an empty set is not a perfect score, and averaging
 * a fabricated 100 across departments makes the company number optimistic in
 * exactly the situation where somebody would rely on it.
 *
 * @param {Array<object>} courses
 * @param {Array<object>} employees
 * @param {Array<object>} enrollments
 * @param {Date|string} asOf
 * @returns {Array<object>}
 */
function complianceByDepartment(
  courses = [],
  employees = [],
  enrollments = [],
  asOf = new Date(),
) {
  const index = indexEnrollments(enrollments);
  const byDepartment = new Map();

  const departmentOf = (employee) =>
    String(employee?.department || '').trim() || 'Unassigned';

  for (const employee of employees) {
    const key = departmentOf(employee);
    if (!byDepartment.has(key)) {
      byDepartment.set(key, {
        department: key,
        obligations: 0,
        met: 0,
        headcount: 0,
      });
    }
    byDepartment.get(key).headcount += 1;
  }

  for (const course of courses) {
    if (!course?.isMandatory) continue;

    for (const employee of employees) {
      if (!isApplicable(course, employee)) continue;

      const entry = byDepartment.get(departmentOf(employee));
      entry.obligations += 1;

      const enrollment = index.get(`${employee._id}:${course._id}`);
      if (certificationState(enrollment, course, asOf).isCompliant)
        entry.met += 1;
    }
  }

  return [...byDepartment.values()]
    .map((entry) => ({
      ...entry,
      compliancePercent:
        entry.obligations > 0
          ? round2((entry.met / entry.obligations) * 100)
          : null,
    }))
    .sort((a, b) => {
      // Departments with no obligations sort last rather than first, which is
      // what a naive numeric sort on `null` would do.
      if (a.compliancePercent === null) return 1;
      if (b.compliancePercent === null) return -1;
      return a.compliancePercent - b.compliancePercent;
    });
}

/**
 * What the reminder cron should be chasing.
 *
 * Includes what has *already* expired as well as what is about to. An expired
 * certification is more urgent than an expiring one, and a list that only shows
 * the future quietly drops the cases that matter most — which is how a lapse
 * survives a whole renewal cycle unnoticed.
 *
 * @param {Array<object>} enrollments
 * @param {Array<object>} courses
 * @param {Date|string} asOf
 * @param {number} horizonDays
 * @returns {Array<object>}
 */
function renewalsDue(
  enrollments = [],
  courses = [],
  asOf = new Date(),
  horizonDays = 30,
) {
  const courseById = new Map(
    courses.map((course) => [String(course._id), course]),
  );
  const horizon = Math.max(0, Number(horizonDays) || 0);
  const due = [];

  for (const enrollment of enrollments) {
    const course = courseById.get(String(enrollment?.courseId));
    if (!course) continue;

    const state = certificationState(enrollment, course, asOf);

    if (
      state.state !== CERTIFICATION_STATE.EXPIRED &&
      state.state !== CERTIFICATION_STATE.EXPIRING
    ) {
      continue;
    }
    if (
      state.state === CERTIFICATION_STATE.EXPIRING &&
      state.daysRemaining > horizon
    ) {
      continue;
    }

    due.push({
      enrollmentId: enrollment._id,
      employeeId: enrollment.employeeId,
      courseId: course._id,
      courseTitle: course.title,
      isMandatory: Boolean(course.isMandatory),
      state: state.state,
      validUntil: state.validUntil,
      daysRemaining: state.daysRemaining,
      overdueDays:
        state.state === CERTIFICATION_STATE.EXPIRED ? -state.daysRemaining : 0,
    });
  }

  // Most overdue first, then soonest to expire. Mandatory ahead of optional at
  // the same urgency, because that is the order somebody working through the
  // list should take them in.
  return due.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining)
      return a.daysRemaining - b.daysRemaining;
    return Number(b.isMandatory) - Number(a.isMandatory);
  });
}

module.exports = {
  ENROLLMENT_STATUS,
  CERTIFICATION_STATE,
  APPLIES_TO,
  round2,
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
};
