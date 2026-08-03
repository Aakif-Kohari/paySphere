/**
 * Canonical payroll lifecycle for PaySphere.
 *
 * #438 introduced a maker–checker approval flow by writing the strings
 * "PENDING_APPROVAL", "APPROVED" and "REJECTED" straight into the controller,
 * while `payroll.model.js` still declared `enum: ["finalized", "paid"]`. The two
 * halves of the codebase therefore disagreed about what a payroll status even
 * is: mongoose validation rejected the new values on any `save()` path, and the
 * downstream consumers (summary, CSV/XLSX export, payslip email, analytics)
 * matched on the old ones and silently treated an unapproved — or explicitly
 * rejected — run as payable (#458).
 *
 * This module is the single source of truth. Both the schema enum and every
 * status comparison in the controllers read from here, so the vocabulary cannot
 * drift again. It deliberately mirrors the shape of `config/permissions.js`,
 * which solved the same class of problem for RBAC in #413.
 */

// --- Statuses --------------------------------------------------------------

const PAYROLL_STATUS = {
  /** Calculated but not yet submitted. Reserved for future save-as-draft. */
  DRAFT: 'draft',
  /** Submitted by the maker, waiting on a checker. */
  PENDING_APPROVAL: 'pending_approval',
  /** Approved by a checker. Payable, emailable, reportable. */
  APPROVED: 'approved',
  /** Sent back by a checker. Must never be paid, emailed or counted. */
  REJECTED: 'rejected',
  /** Disbursed. Terminal — cannot be re-finalised (#251). */
  PAID: 'paid',
};

const ALL_STATUSES = Object.values(PAYROLL_STATUS);

/**
 * Statuses that represent real, committed money.
 *
 * Summary totals, CSV/XLSX exports, the analytics aggregation and the payroll
 * register must all filter on this list. Anything sitting in draft, pending or
 * rejected is *not* a payout and must not be added to a total that an owner
 * reads as "what I owe this month".
 */
const PAYABLE_STATUSES = [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID];

/**
 * Statuses a payslip may be emailed for.
 *
 * Emailing a payslip for a pending row tells an employee they have been paid an
 * amount a checker has not signed off on yet, and emailing a rejected one is
 * worse. Same list as PAYABLE_STATUSES today, kept separate because the two
 * answer different questions and will diverge if a "hold" state is ever added.
 */
const EMAILABLE_STATUSES = [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID];

/** Statuses that still allow the run to be recalculated and resubmitted. */
const RESUBMITTABLE_STATUSES = [
  PAYROLL_STATUS.DRAFT,
  PAYROLL_STATUS.PENDING_APPROVAL,
  PAYROLL_STATUS.REJECTED,
];

// --- Transitions -----------------------------------------------------------

/**
 * Legal transitions, keyed by the current status.
 *
 * `paid` and `approved -> paid` are one-way on purpose: #251 established that a
 * paid record must not be reopened, and an approval flow that lets the maker
 * walk an approved row back to pending would let them re-edit the figures after
 * sign-off, which is the exact abuse maker–checker exists to prevent.
 */
const ALLOWED_TRANSITIONS = {
  [PAYROLL_STATUS.DRAFT]: [PAYROLL_STATUS.PENDING_APPROVAL],
  [PAYROLL_STATUS.PENDING_APPROVAL]: [
    PAYROLL_STATUS.APPROVED,
    PAYROLL_STATUS.REJECTED,
  ],
  // A rejected run is resubmitted by re-running payroll, which recalculates the
  // figures and puts it back into pending.
  [PAYROLL_STATUS.REJECTED]: [PAYROLL_STATUS.PENDING_APPROVAL],
  [PAYROLL_STATUS.APPROVED]: [PAYROLL_STATUS.PAID],
  [PAYROLL_STATUS.PAID]: [],
};

// --- Legacy compatibility --------------------------------------------------

/**
 * Rows written before #438 use "finalized"; rows written by #438 itself use the
 * screaming-snake variants. Both map onto the canonical vocabulary.
 *
 * "finalized" becomes `approved` rather than `pending_approval`: those rows were
 * created under the pre-approval semantics where finalising *was* the sign-off,
 * so they were already payable. Demoting them to pending would make historical
 * payroll vanish from every total until someone re-approved months of history.
 */
const LEGACY_STATUS_ALIASES = {
  finalized: PAYROLL_STATUS.APPROVED,
  FINALIZED: PAYROLL_STATUS.APPROVED,
  PENDING_APPROVAL: PAYROLL_STATUS.PENDING_APPROVAL,
  APPROVED: PAYROLL_STATUS.APPROVED,
  REJECTED: PAYROLL_STATUS.REJECTED,
  PAID: PAYROLL_STATUS.PAID,
  DRAFT: PAYROLL_STATUS.DRAFT,
};

/**
 * Coerce any historical or externally supplied status into the canonical form.
 *
 * @param {*} value
 * @returns {string|null} a PAYROLL_STATUS value, or null if unrecognised
 */
function normalizeStatus(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (ALL_STATUSES.includes(trimmed)) return trimmed;

  if (Object.prototype.hasOwnProperty.call(LEGACY_STATUS_ALIASES, trimmed)) {
    return LEGACY_STATUS_ALIASES[trimmed];
  }

  const lowered = trimmed.toLowerCase();
  if (ALL_STATUSES.includes(lowered)) return lowered;

  return null;
}

/**
 * @param {*} value
 * @returns {boolean} whether the value is a known status (canonical or legacy)
 */
function isValidStatus(value) {
  return normalizeStatus(value) !== null;
}

/**
 * Whether a status change is permitted by the transition table.
 *
 * A no-op transition (`from === to`) is allowed so that re-approving an already
 * approved row is idempotent rather than a 409 — a checker double-clicking the
 * approve button should not see an error.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function canTransition(from, to) {
  const source = normalizeStatus(from);
  const target = normalizeStatus(to);

  if (!source || !target) return false;
  if (source === target) return true;

  return (ALLOWED_TRANSITIONS[source] || []).includes(target);
}

/**
 * Explain a rejected transition, for the 409 body.
 *
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
function describeTransition(from, to) {
  const source = normalizeStatus(from);
  const target = normalizeStatus(to);

  if (!source) return `"${from}" is not a recognised payroll status`;
  if (!target) return `"${to}" is not a recognised payroll status`;

  const allowed = ALLOWED_TRANSITIONS[source] || [];

  if (allowed.length === 0) {
    return `A payroll record that is "${source}" is final and cannot change status`;
  }

  return `A payroll record that is "${source}" can only move to: ${allowed.join(', ')}`;
}

/**
 * @param {string} status
 * @returns {boolean} whether the row counts towards payouts and reports
 */
function isPayable(status) {
  return PAYABLE_STATUSES.includes(normalizeStatus(status));
}

/**
 * @param {string} status
 * @returns {boolean} whether a payslip may be emailed for the row
 */
function isEmailable(status) {
  return EMAILABLE_STATUSES.includes(normalizeStatus(status));
}

/**
 * A mongo filter fragment matching payable rows, including legacy "finalized"
 * documents that predate the migration.
 *
 * Every read path that reports money uses this, so a single edit here keeps
 * summary, exports, analytics and the register in agreement.
 *
 * @returns {{ status: { $in: string[] } }}
 */
function payableStatusFilter() {
  return { status: { $in: [...PAYABLE_STATUSES, 'finalized'] } };
}

/**
 * A mongo filter fragment matching rows a payslip may be emailed for,
 * including legacy "finalized" documents that predate the migration.
 *
 * The counterpart to `payableStatusFilter` for the dispatch paths. The monthly
 * cron hardcoded `status: "finalized"` instead of asking here, and once the
 * vocabulary was normalised no document carried that value any more — so the
 * job matched nothing, every month, and payslips silently stopped going out
 * (#560). Anything deciding "may this be emailed?" reads from here so the two
 * cannot drift apart again.
 *
 * @returns {{ status: { $in: string[] } }}
 */
function emailableStatusFilter() {
  return { status: { $in: [...EMAILABLE_STATUSES, 'finalized'] } };
}

/**
 * A mongo filter fragment excluding rejected rows, for the read paths that
 * legitimately want to show work in progress (e.g. the review screen) but must
 * never show something a checker has already thrown out.
 *
 * @returns {{ status: { $nin: string[] } }}
 */
function excludeRejectedFilter() {
  return { status: { $nin: [PAYROLL_STATUS.REJECTED, 'REJECTED'] } };
}

module.exports = {
  PAYROLL_STATUS,
  ALL_STATUSES,
  PAYABLE_STATUSES,
  EMAILABLE_STATUSES,
  RESUBMITTABLE_STATUSES,
  ALLOWED_TRANSITIONS,
  LEGACY_STATUS_ALIASES,
  normalizeStatus,
  isValidStatus,
  canTransition,
  describeTransition,
  isPayable,
  isEmailable,
  payableStatusFilter,
  emailableStatusFilter,
  excludeRejectedFilter,
};
