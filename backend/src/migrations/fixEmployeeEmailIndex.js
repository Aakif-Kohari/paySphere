const mongoose = require("mongoose");
const Employee = require("../models/employee.model");
const logger = require("../utils/logger");

/**
 * Migration for #414.
 *
 * The old index was declared as:
 *
 *   { email: 1, createdBy: 1 }, { unique: true, sparse: true }
 *
 * `sparse` does not behave as intended on a compound index — a document is
 * indexed when it has *at least one* of the keys, and `createdBy` is always
 * present, so every employee was indexed with `email: null`. The replacement
 * uses `partialFilterExpression: { email: { $type: "string" } }`.
 *
 * MongoDB will not silently replace an index whose options changed, so the old
 * one has to be dropped explicitly. Blank-string emails are unset first,
 * otherwise they would collide with each other under the new index.
 *
 * Idempotent: safe to run more than once.
 */

const INDEX_NAME = "email_1_createdBy_1";

/**
 * Unset `email` on documents storing an empty string, so they fall outside the
 * partial index rather than all colliding on "".
 *
 * @returns {Promise<number>} documents updated
 */
async function unsetBlankEmails() {
  const result = await Employee.updateMany(
    { email: { $in: ["", null] } },
    { $unset: { email: "" } },
  );
  return result.modifiedCount || 0;
}

/**
 * Report addresses that are duplicated within a single company. These would
 * block the unique index from building, so they are surfaced rather than
 * silently mutated — deciding which record keeps the address is a business
 * call, not a migration's.
 *
 * @returns {Promise<Array<{createdBy: unknown, email: string, count: number}>>}
 */
async function findDuplicateEmails() {
  return Employee.aggregate([
    { $match: { email: { $type: "string" } } },
    {
      $group: {
        _id: { createdBy: "$createdBy", email: "$email" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    {
      $project: {
        _id: 0,
        createdBy: "$_id.createdBy",
        email: "$_id.email",
        count: 1,
      },
    },
  ]);
}

/**
 * Drop the old index if it exists and is not already the partial one.
 *
 * @returns {Promise<boolean>} whether an index was dropped
 */
async function dropLegacyIndex() {
  const collection = Employee.collection;
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === INDEX_NAME);

  if (!existing) return false;

  // Already migrated.
  if (existing.partialFilterExpression) return false;

  await collection.dropIndex(INDEX_NAME);
  logger.info(`Dropped legacy index ${INDEX_NAME}`);
  return true;
}

/**
 * Run the migration.
 *
 * @returns {Promise<{ok: boolean, blankEmailsUnset: number, indexDropped: boolean, duplicates: Array, error?: string}>}
 */
async function migrateEmployeeEmailIndex() {
  try {
    const blankEmailsUnset = await unsetBlankEmails();
    const duplicates = await findDuplicateEmails();

    if (duplicates.length > 0) {
      logger.error(
        "Cannot rebuild the employee email index: duplicate addresses exist within a company. Resolve these first.",
        { duplicates },
      );
      return {
        ok: false,
        blankEmailsUnset,
        indexDropped: false,
        duplicates,
        error: "Duplicate employee emails found",
      };
    }

    const indexDropped = await dropLegacyIndex();

    // Rebuild from the schema definition.
    await Employee.syncIndexes();

    logger.info("Employee email index migration complete", {
      blankEmailsUnset,
      indexDropped,
    });

    return { ok: true, blankEmailsUnset, indexDropped, duplicates: [] };
  } catch (error) {
    logger.error("Employee email index migration failed", {
      error: error.message,
    });
    return {
      ok: false,
      blankEmailsUnset: 0,
      indexDropped: false,
      duplicates: [],
      error: error.message,
    };
  }
}

// Allow running directly: `node src/migrations/fixEmployeeEmailIndex.js`
if (require.main === module) {
  require("dotenv").config();
  const connectDB = require("../config/db");

  (async () => {
    await connectDB();
    const result = await migrateEmployeeEmailIndex();
    await mongoose.disconnect();
    process.exit(result.ok ? 0 : 1);
  })();
}

module.exports = {
  migrateEmployeeEmailIndex,
  unsetBlankEmails,
  findDuplicateEmails,
  dropLegacyIndex,
  INDEX_NAME,
};
