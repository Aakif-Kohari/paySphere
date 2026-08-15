const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const SalaryStructure = require('../models/salaryStructure.model');
const logger = require('../utils/logger');
const {
  buildDefaultStructure,
  computeComponentAmounts,
  round2,
} = require('../utils/salaryStructure');
const { REVISION_REASON } = require('../config/salaryComponents');

/**
 * Migration for #461.
 *
 * Every existing employee has a `monthlySalary` and no revision history. This
 * creates one `initial` revision per employee, derived from the figure already
 * on their record, so the timeline starts from a true statement rather than
 * from a gap.
 *
 * Two properties are non-negotiable:
 *
 *  1. **Nobody's pay changes.** The generated split always reconstitutes to
 *     exactly the stored `monthlySalary` — the residual component absorbs any
 *     rounding. A migration that altered someone's salary would be far worse
 *     than no migration.
 *  2. **Idempotent.** Employees that already have a revision are skipped, so
 *     this is safe to run on every boot next to `seedRbac`.
 *
 * The revision is dated from the employee's joining date where one exists, so
 * a period query for a past month resolves rather than falling through.
 */

const BATCH_SIZE = 500;

/**
 * Employees with no revision yet.
 *
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function findUnmigratedEmployees(limit = BATCH_SIZE) {
  const withStructures = await SalaryStructure.distinct('employeeId');

  return Employee.find({
    _id: { $nin: withStructures },
    monthlySalary: { $gt: 0 },
  })
    .limit(limit)
    .select('_id createdBy monthlySalary joiningDate createdAt fullName');
}

/**
 * Build the `initial` revision document for one employee.
 *
 * @param {object} employee
 * @returns {object|null} null when the split would not reconstitute exactly
 */
function buildInitialRevision(employee) {
  const gross = round2(Number(employee.monthlySalary) || 0);
  if (gross <= 0) return null;

  const structure = buildDefaultStructure(gross);
  const resolved = computeComponentAmounts(structure);

  // Guard property (1): refuse to write a split that does not add up to the
  // salary the employee already has.
  if (resolved.totalEarnings !== gross) {
    logger.warn(
      'Skipping salary backfill: the generated split does not reconstitute the stored salary',
      {
        employeeId: String(employee._id),
        gross,
        resolved: resolved.totalEarnings,
      },
    );
    return null;
  }

  return {
    employeeId: employee._id,
    createdBy: employee.createdBy,
    // Dated from joining where known, so a query for a past month resolves.
    effectiveFrom: employee.joiningDate || employee.createdAt || new Date(0),
    components: structure.components,
    grossMonthly: gross,
    ctcAnnual: round2(gross * 12),
    reason: REVISION_REASON.INITIAL,
    note: 'Backfilled from the employee record when salary history was introduced',
  };
}

/**
 * Run the migration.
 *
 * @returns {Promise<{ok: boolean, scanned: number, created: number, skipped: number, error?: string}>}
 */
async function backfillSalaryStructures() {
  try {
    let scanned = 0;
    let created = 0;
    let skipped = 0;

    // Loop in batches so a large employee base does not build one enormous
    // insert, and so a partial run still makes progress.
    for (;;) {
      const employees = await findUnmigratedEmployees(BATCH_SIZE);
      if (employees.length === 0) break;

      scanned += employees.length;

      const documents = employees
        .map(buildInitialRevision)
        .filter(Boolean);

      skipped += employees.length - documents.length;

      if (documents.length > 0) {
        try {
          const inserted = await SalaryStructure.insertMany(documents, {
            ordered: false,
          });
          created += inserted.length;
        } catch (insertError) {
          // A duplicate means a concurrent run already created it — not a
          // failure, just work someone else did.
          if (insertError.code === 11000) {
            created += insertError.insertedDocs
              ? insertError.insertedDocs.length
              : 0;
            skipped += insertError.writeErrors
              ? insertError.writeErrors.length
              : 0;
          } else {
            throw insertError;
          }
        }
      }

      // Fewer than a full batch means we have reached the end.
      if (employees.length < BATCH_SIZE) break;
    }

    await SalaryStructure.syncIndexes();

    if (created > 0 || skipped > 0) {
      logger.info('Salary structure backfill complete', {
        scanned,
        created,
        skipped,
      });
    }

    return { ok: true, scanned, created, skipped };
  } catch (error) {
    logger.error('Salary structure backfill failed', { error: error.message });
    return { ok: false, scanned: 0, created: 0, skipped: 0, error: error.message };
  }
}

// Allow running directly: `node src/migrations/backfillSalaryStructures.js`
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');

  (async () => {
    await connectDB();
    const result = await backfillSalaryStructures();
    await mongoose.disconnect();
    process.exit(result.ok ? 0 : 1);
  })();
}

module.exports = {
  backfillSalaryStructures,
  findUnmigratedEmployees,
  buildInitialRevision,
  BATCH_SIZE,
};
