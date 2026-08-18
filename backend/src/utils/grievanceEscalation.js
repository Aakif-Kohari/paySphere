/**
 * POSH escalation ladder, statutory extension, and ICC composition checks.
 *
 * Pure functions — no database access — for the same reason `slaCalculator.js`
 * is pure: what follows decides whether a statutory inquiry is compliant and
 * whether the committee deciding it is lawfully constituted, and both have to
 * be testable against their boundaries in isolation (#1157).
 *
 * `slaCalculator.js` answers one question — is this case inside 90 days —
 * and returns COMPLIANT, WARNING or BREACHED. Nothing acts on the answer:
 *
 *   - `isSLAAlertSent` is a single boolean on the grievance, so a case can be
 *     escalated at most once, ever, with no record of to whom or when. A case
 *     sitting at 89 days and one sitting at 200 days are indistinguishable.
 *   - The inquiry period is extendable in writing with reasons recorded, and
 *     `slaDeadline` is set once at filing to `filedAt + 90 days` with no path
 *     to move it. A lawfully extended inquiry is reported as breached.
 *   - Interim relief has to be acted on quickly and separately from the
 *     inquiry. There is no field, no deadline and no reporting for it.
 *   - `tallyICCVotes()` applies a bare "three members" quorum and never checks
 *     the composition the Act requires, so an unlawfully constituted committee
 *     can return a verdict that is later void.
 */

'use strict';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** The statutory inquiry period, in days. */
const STATUTORY_INQUIRY_DAYS = 90;

/**
 * The longest single extension, and the ceiling on the whole inquiry.
 *
 * An extension is a documented exception, not a way to make the deadline
 * advisory. Capping the total means a case cannot be extended indefinitely one
 * month at a time until the limit has no meaning left.
 */
const MAX_EXTENSION_DAYS = 30;
const MAX_TOTAL_INQUIRY_DAYS = 180;

/** Interim relief is a separate, much shorter clock than the inquiry. */
const INTERIM_RELIEF_RESPONSE_DAYS = 15;

/**
 * The escalation ladder.
 *
 * Four rungs rather than one alert, because "nobody has looked at this in a
 * fortnight" and "this case is now unlawful" need different people told.
 * `afterDays` is measured from filing; `atDaysRemaining` catches the approach
 * to the deadline for cases that are moving but not fast enough.
 */
const ESCALATION_LEVELS = [
  {
    level: 0,
    key: 'NONE',
    notify: null,
    description: 'Within normal inquiry timeline',
  },
  {
    level: 1,
    key: 'PRESIDING_OFFICER',
    notify: 'Presiding Officer',
    afterDays: 30,
    description: 'Inquiry has not progressed in the first month',
  },
  {
    level: 2,
    key: 'ICC',
    notify: 'Full ICC',
    afterDays: 60,
    atDaysRemaining: 15,
    description: 'Approaching the statutory deadline',
  },
  {
    level: 3,
    key: 'EMPLOYER',
    notify: 'Employer',
    afterDays: STATUTORY_INQUIRY_DAYS,
    description: 'Statutory inquiry period exceeded',
  },
  {
    level: 4,
    key: 'STATUTORY_AUTHORITY',
    notify: 'District Officer / Statutory Authority',
    afterDays: 120,
    description: 'Materially overdue; reportable to the statutory authority',
  },
];

/** Cases in these states are closed and no longer escalate. */
const CLOSED_STATUSES = ['Resolved', 'Dismissed'];

/** Case ageing bands for the caseload report. */
const CASE_AGE_BANDS = [
  { band: '0-30 days', maxDays: 30 },
  { band: '31-60 days', maxDays: 60 },
  { band: '61-90 days', maxDays: 90 },
  { band: '90+ days', maxDays: Infinity },
];

/**
 * ICC composition, as the Act requires it.
 *
 * Held as data rather than as four `if` statements so `validateCommitteeComposition`
 * can report every failure at once — a committee told it is missing a
 * Presiding Officer, fixing that, and then being told it is also short of women
 * members has been given the same news twice.
 */
const COMPOSITION_RULES = {
  minMembers: 4,
  minWomenPercent: 50,
  requiresPresidingOfficer: true,
  requiresExternalMember: true,
};

/**
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Whole days between two instants, floored.
 *
 * @param {Date} from
 * @param {Date} to
 * @returns {number}
 */
function daysBetween(from, to) {
  return Math.floor((to - from) / MS_PER_DAY);
}

/**
 * The deadline a case is actually measured against.
 *
 * The stored `slaDeadline` where there is one, falling back to
 * `filedAt + 90 days`. Cases filed before extensions existed have the field
 * and the fallback agreeing, so nothing has to be backfilled.
 *
 * @param {object} grievance
 * @returns {Date|null}
 */
function resolveEffectiveDeadline(grievance) {
  const stored = toDate(grievance?.slaDeadline);
  if (stored) return stored;

  const filedAt = toDate(grievance?.filedAt);
  if (!filedAt) return null;

  return new Date(filedAt.getTime() + STATUTORY_INQUIRY_DAYS * MS_PER_DAY);
}

/**
 * Extension days already granted on a case.
 *
 * @param {object} grievance
 * @returns {number}
 */
function totalExtensionDays(grievance) {
  const extensions = Array.isArray(grievance?.extensions)
    ? grievance.extensions
    : [];
  return extensions.reduce((sum, entry) => sum + (Number(entry?.days) || 0), 0);
}

/**
 * Where a case sits on the ladder, and what trips the next rung.
 *
 * Derived from the case rather than read from a stored flag, so it cannot go
 * stale, and so the answer for a case at 89 days differs from the answer for
 * one at 200 — which `isSLAAlertSent` could not express.
 *
 * A closed case does not escalate. It may well have breached its deadline on
 * the way, and that is a reporting fact rather than something to keep paging
 * the district officer about.
 *
 * @param {object} grievance
 * @param {Date|string} [asOf]
 * @returns {object}
 */
function resolveEscalationLevel(grievance, asOf = new Date()) {
  const now = toDate(asOf) || new Date();
  const filedAt = toDate(grievance?.filedAt);

  if (!filedAt) {
    return {
      ok: false,
      errors: ['Grievance has no filing date'],
    };
  }

  const deadline = resolveEffectiveDeadline(grievance);
  const daysElapsed = Math.max(0, daysBetween(filedAt, now));
  const daysRemaining = deadline
    ? Math.ceil((deadline - now) / MS_PER_DAY)
    : null;

  const isClosed = CLOSED_STATUSES.includes(grievance?.status);

  if (isClosed) {
    return {
      ok: true,
      errors: [],
      isClosed: true,
      daysElapsed,
      daysRemaining,
      effectiveDeadline: deadline,
      currentLevel: ESCALATION_LEVELS[0],
      nextLevel: null,
      nextTriggerDate: null,
      isBreached: false,
      pendingEscalations: [],
    };
  }

  // The highest rung whose trigger has passed. Two independent triggers — an
  // absolute age, and closeness to the deadline — because an extended case is
  // young against its deadline and old against its filing date, and both are
  // worth knowing.
  const reached = ESCALATION_LEVELS.filter((level) => {
    if (level.level === 0) return true;

    const byAge =
      level.afterDays !== undefined && daysElapsed >= level.afterDays;

    const byProximity =
      level.atDaysRemaining !== undefined &&
      daysRemaining !== null &&
      daysRemaining <= level.atDaysRemaining;

    return byAge || byProximity;
  });

  const currentLevel = reached[reached.length - 1];
  const nextLevel =
    ESCALATION_LEVELS.find((level) => level.level === currentLevel.level + 1) ||
    null;

  const nextTriggerDate =
    nextLevel && nextLevel.afterDays !== undefined
      ? new Date(filedAt.getTime() + nextLevel.afterDays * MS_PER_DAY)
      : null;

  // Rungs reached but not yet recorded in the ledger. This is what makes
  // escalation idempotent: re-evaluating on a later day raises what is new and
  // does not re-raise what has already gone out.
  const raised = new Set(
    (Array.isArray(grievance?.escalations) ? grievance.escalations : []).map(
      (entry) => entry?.levelKey,
    ),
  );

  const pendingEscalations = reached
    .filter((level) => level.level > 0 && !raised.has(level.key))
    .map((level) => ({
      levelKey: level.key,
      level: level.level,
      notify: level.notify,
      description: level.description,
    }));

  return {
    ok: true,
    errors: [],
    isClosed: false,
    daysElapsed,
    daysRemaining,
    effectiveDeadline: deadline,
    extensionDaysGranted: totalExtensionDays(grievance),
    currentLevel,
    nextLevel,
    nextTriggerDate,
    isBreached: daysRemaining !== null && daysRemaining < 0,
    pendingEscalations,
  };
}

/**
 * Price a statutory extension of the inquiry period.
 *
 * Returns the new deadline rather than applying it, so a caller can validate
 * and persist in two steps and a rejected extension leaves nothing behind.
 *
 * A reason is mandatory. The Act's requirement is that the extension is
 * recorded *in writing with reasons*, and an extension with an empty reason
 * field is not a lesser version of that — it is the thing the requirement
 * exists to prevent.
 *
 * @param {object} grievance
 * @param {number} extensionDays
 * @param {object} [options]
 * @param {string} [options.reason]
 * @returns {object}
 */
function computeExtendedDeadline(grievance, extensionDays, options = {}) {
  const errors = [];

  const days = Number(extensionDays);

  if (!Number.isInteger(days) || days <= 0) {
    errors.push('Extension must be a whole number of days, at least 1');
  } else if (days > MAX_EXTENSION_DAYS) {
    errors.push(`A single extension cannot exceed ${MAX_EXTENSION_DAYS} days`);
  }

  const reason = String(options.reason || '').trim();

  if (!reason) {
    errors.push('A written reason is required to extend a statutory inquiry');
  }

  if (CLOSED_STATUSES.includes(grievance?.status)) {
    errors.push(`A case that is "${grievance.status}" cannot be extended`);
  }

  const filedAt = toDate(grievance?.filedAt);

  if (!filedAt) {
    errors.push('Grievance has no filing date');
  }

  const alreadyGranted = totalExtensionDays(grievance);

  if (Number.isInteger(days) && days > 0 && filedAt) {
    const totalInquiryDays = STATUTORY_INQUIRY_DAYS + alreadyGranted + days;

    if (totalInquiryDays > MAX_TOTAL_INQUIRY_DAYS) {
      errors.push(
        `Total inquiry period would reach ${totalInquiryDays} days, above the ${MAX_TOTAL_INQUIRY_DAYS}-day ceiling`,
      );
    }
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const currentDeadline = resolveEffectiveDeadline(grievance);
  const revisedDeadline = new Date(
    currentDeadline.getTime() + days * MS_PER_DAY,
  );

  return {
    ok: true,
    errors: [],
    previousDeadline: currentDeadline,
    revisedDeadline,
    extensionDays: days,
    reason,
    totalExtensionDays: alreadyGranted + days,
    totalInquiryDays: STATUTORY_INQUIRY_DAYS + alreadyGranted + days,
    remainingExtensionAllowance:
      MAX_TOTAL_INQUIRY_DAYS - (STATUTORY_INQUIRY_DAYS + alreadyGranted + days),
  };
}

/**
 * Whether the committee is lawfully constituted.
 *
 * Checked here rather than only at voting time, because a verdict returned by
 * an improperly constituted ICC is void — and discovering that after the
 * verdict has been communicated to both parties is the worst possible moment.
 *
 * Every failure is returned, not the first: a committee told it lacks a
 * Presiding Officer, fixing that, and then being told it is also short of
 * women members has been given the same news twice.
 *
 * @param {object[]} members active ICCCommittee documents
 * @returns {object}
 */
function validateCommitteeComposition(members) {
  const active = (Array.isArray(members) ? members : []).filter(
    (member) => member?.isActive !== false,
  );

  const failures = [];

  if (active.length < COMPOSITION_RULES.minMembers) {
    failures.push({
      rule: 'MIN_MEMBERS',
      message: `Committee has ${active.length} active members; at least ${COMPOSITION_RULES.minMembers} are required`,
    });
  }

  const presidingOfficers = active.filter(
    (member) => member.role === 'Presiding Officer',
  );

  if (
    COMPOSITION_RULES.requiresPresidingOfficer &&
    presidingOfficers.length === 0
  ) {
    failures.push({
      rule: 'PRESIDING_OFFICER',
      message: 'Committee has no Presiding Officer',
    });
  }

  if (presidingOfficers.length > 1) {
    // Not a technicality: the Presiding Officer has a casting role, and two of
    // them makes a split decision unresolvable.
    failures.push({
      rule: 'PRESIDING_OFFICER',
      message: `Committee has ${presidingOfficers.length} Presiding Officers; exactly one is required`,
    });
  }

  const externalMembers = active.filter(
    (member) => member.role === 'External Member',
  );

  if (
    COMPOSITION_RULES.requiresExternalMember &&
    externalMembers.length === 0
  ) {
    failures.push({
      rule: 'EXTERNAL_MEMBER',
      message: 'Committee has no External Member',
    });
  }

  // Counted from an explicit flag on the membership rather than inferred from
  // anything on the user record. This is a statutory quota and it must come
  // from something a person deliberately recorded.
  const womenCount = active.filter((member) => member.isWoman === true).length;
  const womenPercent = active.length
    ? Math.round((womenCount / active.length) * 100)
    : 0;

  if (active.length && womenPercent < COMPOSITION_RULES.minWomenPercent) {
    failures.push({
      rule: 'MIN_WOMEN',
      message: `${womenCount} of ${active.length} members are women (${womenPercent}%); at least ${COMPOSITION_RULES.minWomenPercent}% is required`,
    });
  }

  return {
    isValid: failures.length === 0,
    memberCount: active.length,
    presidingOfficerCount: presidingOfficers.length,
    externalMemberCount: externalMembers.length,
    womenCount,
    womenPercent,
    rules: COMPOSITION_RULES,
    failures,
  };
}

/**
 * The interim-relief clock, which runs independently of the inquiry.
 *
 * A complainant asking to be moved away from the respondent cannot wait ninety
 * days for an answer, so relief has its own and much shorter deadline. A case
 * can be perfectly compliant on the inquiry clock and badly overdue on this
 * one, which is exactly why it is not folded into the same state.
 *
 * @param {object} grievance
 * @param {Date|string} [asOf]
 * @returns {object}
 */
function evaluateInterimRelief(grievance, asOf = new Date()) {
  const now = toDate(asOf) || new Date();
  const requestedAt = toDate(grievance?.interimReliefRequestedAt);

  if (!requestedAt) {
    return {
      isRequested: false,
      isGranted: false,
      isBreached: false,
      state: 'NOT_REQUESTED',
    };
  }

  const deadline = new Date(
    requestedAt.getTime() + INTERIM_RELIEF_RESPONSE_DAYS * MS_PER_DAY,
  );

  const decidedAt = toDate(grievance?.interimReliefDecidedAt);

  if (decidedAt) {
    return {
      isRequested: true,
      isGranted: grievance?.interimReliefGranted === true,
      isBreached: decidedAt > deadline,
      state: grievance?.interimReliefGranted === true ? 'GRANTED' : 'DECLINED',
      requestedAt,
      decidedAt,
      deadline,
      // Reported even once decided: a relief request answered on day 40 is a
      // compliance fact that does not stop being one because it was answered.
      daysToDecision: daysBetween(requestedAt, decidedAt),
    };
  }

  const daysRemaining = Math.ceil((deadline - now) / MS_PER_DAY);

  return {
    isRequested: true,
    isGranted: false,
    isBreached: daysRemaining < 0,
    state: daysRemaining < 0 ? 'OVERDUE' : 'PENDING',
    requestedAt,
    deadline,
    daysRemaining,
    daysElapsed: Math.max(0, daysBetween(requestedAt, now)),
  };
}

/**
 * @param {number} days
 * @returns {string}
 */
function bandForCaseAge(days) {
  const band = CASE_AGE_BANDS.find((entry) => days <= entry.maxDays);
  return (band || CASE_AGE_BANDS[CASE_AGE_BANDS.length - 1]).band;
}

/**
 * The open caseload, bucketed by age with escalation counts.
 *
 * `getSLADashboard` counts cases three ways and stops there, so HR can see
 * that four cases are breached and not where the rest are sitting or which one
 * escalates next.
 *
 * @param {object[]} grievances
 * @param {Date|string} [asOf]
 * @returns {object}
 */
function buildCaseAgeingReport(grievances, asOf = new Date()) {
  const now = toDate(asOf) || new Date();
  const list = Array.isArray(grievances) ? grievances : [];

  const buckets = new Map(
    CASE_AGE_BANDS.map((band) => [
      band.band,
      { band: band.band, count: 0, breachedCount: 0, escalatedCount: 0 },
    ]),
  );

  const byLevel = new Map(
    ESCALATION_LEVELS.map((level) => [
      level.key,
      { levelKey: level.key, count: 0 },
    ]),
  );

  let openCount = 0;
  let breachedCount = 0;
  let interimReliefOverdueCount = 0;
  let nextEscalation = null;

  for (const grievance of list) {
    if (CLOSED_STATUSES.includes(grievance?.status)) continue;

    const escalation = resolveEscalationLevel(grievance, now);
    if (!escalation.ok) continue;

    openCount += 1;

    const bucket = buckets.get(bandForCaseAge(escalation.daysElapsed));
    bucket.count += 1;

    if (escalation.isBreached) {
      bucket.breachedCount += 1;
      breachedCount += 1;
    }

    if (escalation.currentLevel.level > 0) bucket.escalatedCount += 1;

    byLevel.get(escalation.currentLevel.key).count += 1;

    if (evaluateInterimRelief(grievance, now).isBreached) {
      interimReliefOverdueCount += 1;
    }

    // The single most useful line on the report: what happens next, and when.
    if (
      escalation.nextTriggerDate &&
      (!nextEscalation ||
        escalation.nextTriggerDate < nextEscalation.triggerDate)
    ) {
      nextEscalation = {
        caseNumber: grievance.caseNumber || null,
        grievanceId: grievance._id ? String(grievance._id) : null,
        levelKey: escalation.nextLevel?.key || null,
        notify: escalation.nextLevel?.notify || null,
        triggerDate: escalation.nextTriggerDate,
      };
    }
  }

  return {
    asOf: now.toISOString(),
    openCount,
    breachedCount,
    interimReliefOverdueCount,
    ageing: [...buckets.values()],
    byEscalationLevel: [...byLevel.values()],
    nextEscalation,
  };
}

module.exports = {
  STATUTORY_INQUIRY_DAYS,
  MAX_EXTENSION_DAYS,
  MAX_TOTAL_INQUIRY_DAYS,
  INTERIM_RELIEF_RESPONSE_DAYS,
  ESCALATION_LEVELS,
  CLOSED_STATUSES,
  CASE_AGE_BANDS,
  COMPOSITION_RULES,
  daysBetween,
  resolveEffectiveDeadline,
  totalExtensionDays,
  resolveEscalationLevel,
  computeExtendedDeadline,
  validateCommitteeComposition,
  evaluateInterimRelief,
  bandForCaseAge,
  buildCaseAgeingReport,
};
