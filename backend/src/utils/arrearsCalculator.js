/**
 * Retroactive arrears (#931, repaired in #950).
 *
 * A salary revision with a `effectiveFrom` in the past means the months between
 * that date and today were paid at the old rate. The difference is owed. This
 * module works out what it is, records it as an unreleased ledger row per
 * affected month, and hands those rows to the next payroll run to pay out.
 *
 * The engine shipped in #931 could not run at all: it required
 * `../models/arrearsLedger`, and the file on disk is `arrearsLedger.model.js`.
 * `salaryStructure.controller.js` swallowed the resulting MODULE_NOT_FOUND into
 * a log line, so every backdated revision since then produced no ledger rows;
 * `payroll.controller.js` did not, so every payroll submission answered 500.
 *
 * The ledger is deliberately its own collection rather than a field on the
 * revision: arrears are released independently of the revision that created
 * them, possibly months later, possibly across several payroll runs, and
 * "has this been paid yet" has to be answerable without recomputing anything.
 */

const ArrearsLedger = require('../models/arrearsLedger.model');
const logger = require('./logger');

/**
 * Days in a calendar month, leap years included.
 *
 * @param {number} month 1-indexed
 * @param {number} year
 * @returns {number}
 */
function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/**
 * The share of a month's gross earned from `effectiveDay` to the month end.
 *
 * Inclusive of the effective day itself: a revision effective on the 15th of a
 * 30-day month covers 16 days, not 15. Somebody whose raise starts on a Monday
 * is paid the new rate for that Monday.
 *
 * @param {number} monthlyGross
 * @param {number} effectiveDay 1-indexed day of the month
 * @param {number} totalDaysInMonth
 * @returns {number}
 */
function calculateProRatedGross(monthlyGross, effectiveDay, totalDaysInMonth) {
  const activeDays = totalDaysInMonth - effectiveDay + 1;
  return Math.round(monthlyGross * (activeDays / totalDaysInMonth) * 100) / 100;
}

/**
 * The first instant of the month a date falls in.
 *
 * The month walk below has to step on the 1st rather than on the effective
 * day. `setMonth(getMonth() + 1)` applied to 31 January lands on 2 or 3 March,
 * because there is no 31 February for it to normalise onto — so a revision
 * effective on the 29th, 30th or 31st silently skipped a month and paid the
 * employee less than they were owed.
 *
 * @param {Date} date
 * @returns {Date}
 */
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Generate the unreleased ledger rows a backdated revision owes.
 *
 * Called immediately after a new `SalaryStructure` revision is saved. A no-op
 * for the common cases — a revision effective this month or later, a decrease,
 * or an employee's first-ever revision.
 *
 * @param {object} revision the newly created SalaryStructure document
 * @param {object|null} previousRevision the revision active before it
 * @param {string} tenantId
 * @returns {Promise<{created: number, months: number, skipped: string|null}>}
 */
async function processRetroactiveArrears(revision, previousRevision, tenantId) {
  if (!revision || !revision.effectiveFrom || !tenantId) {
    return { created: 0, months: 0, skipped: 'missing revision or tenant' };
  }

  const effectiveDate = new Date(revision.effectiveFrom);
  const currentMonthStart = startOfMonth(new Date());

  // Effective this month or later: there are no already-paid months to top up.
  // The current run picks the new rate up directly.
  if (effectiveDate >= currentMonthStart) {
    return { created: 0, months: 0, skipped: 'not backdated' };
  }

  // No previous revision means there is no rate to compare against, and the
  // delta against zero is the employee's entire salary. #931 computed exactly
  // that: the first revision ever recorded for an employee, backdated, owed
  // them a second full salary for every month since — on top of the salary
  // they had already been paid. An employee whose history starts here was
  // being paid *something* before it; that figure is simply not recorded, and
  // the honest response is to leave the arrears to be entered by hand rather
  // than to invent one.
  if (!previousRevision) {
    logger.info(
      'No arrears generated: the employee has no previous salary revision to compare against',
      {
        revisionId: String(revision._id),
        employeeId: String(revision.employeeId),
      },
    );
    return { created: 0, months: 0, skipped: 'no previous revision' };
  }

  const oldGross = Number(previousRevision.grossMonthly) || 0;
  const newGross = Number(revision.grossMonthly) || 0;

  if (newGross <= oldGross) {
    logger.info(
      'No arrears generated: new gross is not higher than the old gross',
      {
        revisionId: String(revision._id),
      },
    );
    // A decrease is a recovery, not an arrear. Clawing money back out of
    // somebody's next payslip is a decision for a human, not for this.
    return { created: 0, months: 0, skipped: 'not an increase' };
  }

  const entriesToCreate = [];
  const effectiveMonthStart = startOfMonth(effectiveDate);

  for (
    let cursor = new Date(effectiveMonthStart);
    cursor < currentMonthStart;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    const month = cursor.getMonth() + 1;
    const year = cursor.getFullYear();
    const totalDays = getDaysInMonth(month, year);

    let monthOldGross = oldGross;
    let monthNewGross = newGross;
    let proRatedDays = null;

    // Only the month the revision takes effect in is partial. Every month
    // after it is owed the full difference.
    const isEffectiveMonth =
      cursor.getMonth() === effectiveDate.getMonth() &&
      cursor.getFullYear() === effectiveDate.getFullYear();

    if (isEffectiveMonth && effectiveDate.getDate() > 1) {
      const effectiveDay = effectiveDate.getDate();
      monthOldGross = calculateProRatedGross(oldGross, effectiveDay, totalDays);
      monthNewGross = calculateProRatedGross(newGross, effectiveDay, totalDays);
      proRatedDays = totalDays - effectiveDay + 1;
    }

    const grossDelta = Math.round((monthNewGross - monthOldGross) * 100) / 100;

    if (grossDelta > 0) {
      entriesToCreate.push({
        tenantId,
        employeeId: revision.employeeId,
        revisionId: revision._id,
        targetMonth: month,
        targetYear: year,
        oldGross: monthOldGross,
        newGross: monthNewGross,
        grossDelta,
        proRatedDays,
        totalDaysInMonth: totalDays,
        // The gross delta is carried through as the payout and taxed by the
        // run that releases it, which is how arrears are treated in practice:
        // taxed in the month of receipt rather than reassessed against the
        // year they relate to.
        netArrearsPayout: grossDelta,
        isReleased: false,
      });
    }
  }

  if (entriesToCreate.length === 0) {
    return {
      created: 0,
      months: 0,
      skipped: 'no months with a positive delta',
    };
  }

  let created;

  try {
    const inserted = await ArrearsLedger.insertMany(entriesToCreate, {
      ordered: false,
    });
    created = inserted.length;
  } catch (error) {
    // The unique index on (employeeId, targetMonth, targetYear, revisionId) is
    // what makes this idempotent: a revision saved twice, or a retried request,
    // re-derives the same rows and the duplicates are rejected individually.
    // `ordered: false` inserts the rest, so a duplicate is not a failure — but
    // anything that is not a duplicate still is.
    const onlyDuplicates =
      error.code === 11000 ||
      (Array.isArray(error.writeErrors) &&
        error.writeErrors.every(
          (e) => e.code === 11000 || e.err?.code === 11000,
        ));

    if (!onlyDuplicates) throw error;

    created = error.insertedDocs?.length ?? error.result?.insertedCount ?? 0;
    logger.info('Arrears generation skipped rows that already existed', {
      revisionId: String(revision._id),
      attempted: entriesToCreate.length,
      created,
    });
  }

  logger.info('Generated arrears ledger entries', {
    revisionId: String(revision._id),
    employeeId: String(revision.employeeId),
    created,
    months: entriesToCreate.length,
  });

  return { created, months: entriesToCreate.length, skipped: null };
}

/**
 * Everything owed to an employee and not yet paid out.
 *
 * Read during payroll preparation, before the run is written, so the figure can
 * be added to the payslip in the same transaction that releases it.
 *
 * @param {string} employeeId
 * @param {string} tenantId
 * @returns {Promise<{totalArrears: number, arrearsBreakdown: Array, ledgerIds: Array}>}
 */
async function bundleUnreleasedArrears(employeeId, tenantId) {
  const empty = { totalArrears: 0, arrearsBreakdown: [], ledgerIds: [] };

  // An unscoped read here would bundle another company's arrears into this
  // company's payslip. Cheaper to refuse than to reconcile afterwards.
  if (!employeeId || !tenantId) return empty;

  const unreleased = await ArrearsLedger.find({
    employeeId,
    tenantId,
    isReleased: false,
  })
    .sort({ targetYear: 1, targetMonth: 1 })
    .lean();

  if (unreleased.length === 0) return empty;

  const totalArrears =
    Math.round(
      unreleased.reduce(
        (sum, a) => sum + (Number(a.netArrearsPayout) || 0),
        0,
      ) * 100,
    ) / 100;

  return {
    totalArrears,
    ledgerIds: unreleased.map((a) => a._id),
    arrearsBreakdown: unreleased.map((a) => ({
      month: a.targetMonth,
      year: a.targetYear,
      amount: a.netArrearsPayout,
      isProRated: a.proRatedDays !== null && a.proRatedDays !== undefined,
      days: a.proRatedDays || a.totalDaysInMonth,
    })),
  };
}

/**
 * Mark ledger rows as paid by a payroll row.
 *
 * Takes the session so the release commits with the payroll write it belongs
 * to. Without it, a transaction that aborts after this point leaves the rows
 * flagged released against a payroll row that does not exist, and the arrears
 * are never paid to anybody — the one failure mode a ledger exists to prevent.
 *
 * @param {Array} ledgerIds
 * @param {string} payrollId
 * @param {{tenantId?: string, session?: object}} [options]
 * @returns {Promise<number>} rows modified
 */
async function markArrearsReleased(ledgerIds, payrollId, options = {}) {
  if (!ledgerIds || ledgerIds.length === 0) return 0;
  if (!payrollId) return 0;

  const { tenantId, session } = options;

  const filter = { _id: { $in: ledgerIds }, isReleased: false };
  if (tenantId) filter.tenantId = tenantId;

  const result = await ArrearsLedger.updateMany(
    filter,
    { $set: { isReleased: true, releasedInPayrollId: payrollId } },
    session ? { session } : {},
  );

  return result.modifiedCount ?? 0;
}

module.exports = {
  processRetroactiveArrears,
  bundleUnreleasedArrears,
  markArrearsReleased,
  // Exported for the unit tests, which cover the two arithmetic decisions the
  // rest of this file is built on.
  _internals: { getDaysInMonth, calculateProRatedGross, startOfMonth },
};
