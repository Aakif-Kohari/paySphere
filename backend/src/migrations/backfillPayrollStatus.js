const mongoose = require("mongoose");
const PayrollUpdate = require("../models/payroll.model");
const logger = require("../utils/logger");
const {
  PAYROLL_STATUS,
  LEGACY_STATUS_ALIASES,
} = require("../config/payrollStatus");

/**
 * Migration for #458.
 *
 * Three generations of status values exist in the wild:
 *
 *   "finalized" / "paid"                       — pre-#438, the original enum
 *   "PENDING_APPROVAL" / "APPROVED" / ...      — written by #438's controller
 *   "pending_approval" / "approved" / ...      — the canonical vocabulary
 *
 * Leaving the first two in place means every status comparison in the codebase
 * has to know about all three spellings forever, and the schema enum cannot be
 * tightened without rejecting reads of existing documents. This normalises the
 * collection once so the enum is the truth from then on.
 *
 * "finalized" maps to `approved`, not `pending_approval`. Those rows were
 * written when finalising *was* the sign-off — there was no checker to wait
 * for — so they were already payable. Demoting them would make months of
 * historical payroll disappear from every total and export until somebody
 * manually re-approved it.
 *
 * Idempotent: safe to run repeatedly, and a no-op once the collection is clean.
 */

/**
 * The legacy spellings that need rewriting, mapped to their canonical value.
 * Canonical values map to themselves in LEGACY_STATUS_ALIASES, so they are
 * filtered out — rewriting them would be a pointless full-collection write.
 */
function buildRewriteMap() {
  const rewrites = {};

  for (const [legacy, canonical] of Object.entries(LEGACY_STATUS_ALIASES)) {
    if (legacy !== canonical) {
      rewrites[legacy] = canonical;
    }
  }

  return rewrites;
}

/**
 * Count how many documents still carry each legacy spelling.
 *
 * @returns {Promise<Record<string, number>>}
 */
async function surveyLegacyStatuses() {
  const rewrites = buildRewriteMap();
  const legacyValues = Object.keys(rewrites);

  if (legacyValues.length === 0) return {};

  const rows = await PayrollUpdate.aggregate([
    { $match: { status: { $in: legacyValues } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const survey = {};
  rows.forEach((row) => {
    survey[row._id] = row.count;
  });

  return survey;
}

/**
 * Rewrite one legacy spelling to its canonical value.
 *
 * @param {string} legacy
 * @param {string} canonical
 * @returns {Promise<number>} documents modified
 */
async function rewriteStatus(legacy, canonical) {
  const result = await PayrollUpdate.updateMany(
    { status: legacy },
    { $set: { status: canonical } },
  );

  return result.modifiedCount || 0;
}

/**
 * Give migrated rows an approval trail.
 *
 * A row rewritten from "finalized" to `approved` has no `approvedBy` and no
 * `approvedAt`, which makes it indistinguishable from a row that somehow
 * skipped the checker. Stamping `approvedAt` from the document's own
 * `updatedAt` records honestly that the approval predates the workflow, without
 * inventing an approver who never existed.
 *
 * @returns {Promise<number>} documents modified
 */
async function stampMigratedApprovals() {
  const result = await PayrollUpdate.updateMany(
    {
      status: { $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID] },
      approvedAt: { $exists: false },
    },
    [
      {
        $set: {
          approvedAt: { $ifNull: ["$updatedAt", "$createdAt"] },
        },
      },
    ],
  );

  return result.modifiedCount || 0;
}

/**
 * Run the migration.
 *
 * @returns {Promise<{ok: boolean, survey: object, rewritten: object, totalRewritten: number, approvalsStamped: number, error?: string}>}
 */
async function backfillPayrollStatus() {
  try {
    const survey = await surveyLegacyStatuses();
    const rewrites = buildRewriteMap();
    const rewritten = {};
    let totalRewritten = 0;

    for (const [legacy, canonical] of Object.entries(rewrites)) {
      const modified = await rewriteStatus(legacy, canonical);
      if (modified > 0) {
        rewritten[`${legacy} -> ${canonical}`] = modified;
        totalRewritten += modified;
      }
    }

    const approvalsStamped = await stampMigratedApprovals();

    // Pick up the new compound indexes declared on the schema for the approvals
    // queue and the status-filtered period queries.
    await PayrollUpdate.syncIndexes();

    logger.info("Payroll status backfill complete", {
      survey,
      rewritten,
      totalRewritten,
      approvalsStamped,
    });

    return {
      ok: true,
      survey,
      rewritten,
      totalRewritten,
      approvalsStamped,
    };
  } catch (error) {
    logger.error("Payroll status backfill failed", { error: error.message });
    return {
      ok: false,
      survey: {},
      rewritten: {},
      totalRewritten: 0,
      approvalsStamped: 0,
      error: error.message,
    };
  }
}

// Allow running directly: `node src/migrations/backfillPayrollStatus.js`
if (require.main === module) {
  require("dotenv").config();
  const connectDB = require("../config/db");

  (async () => {
    await connectDB();
    const result = await backfillPayrollStatus();
    await mongoose.disconnect();
    process.exit(result.ok ? 0 : 1);
  })();
}

module.exports = {
  backfillPayrollStatus,
  surveyLegacyStatuses,
  rewriteStatus,
  stampMigratedApprovals,
  buildRewriteMap,
};
