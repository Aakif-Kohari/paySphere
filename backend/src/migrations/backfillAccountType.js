const mongoose = require("mongoose");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const {
  ACCOUNT_TYPE,
  ALL_ACCOUNT_TYPES,
} = require("../config/accountTypes");

/**
 * Migration for #558.
 *
 * While `role` was declared twice on the User schema, the surviving String
 * definition was written to by two different things that disagreed about what
 * it meant:
 *
 *   "ADMIN" / "EMPLOYEE"   — the schema default, and #443's account type
 *   "68f3…" (24 hex chars) — an ObjectId cast to a string, written by
 *                            `resolveRole`'s repair branch via `updateOne`,
 *                            which skips validators and so bypassed the enum
 *
 * Now that `role` is an ObjectId reference again and the account type lives on
 * `accountType`, both shapes have to be sorted out:
 *
 *   1. Accounts whose `role` holds an account-type string have no RBAC role at
 *      all. Move the string to `accountType` and unset `role` so the seeder's
 *      own backfill (which matches `role: null`) assigns a real one.
 *   2. Accounts whose `role` holds a stringified ObjectId keep it — casting it
 *      back to an ObjectId restores the reference the repair branch intended.
 *   3. Everyone else just needs `accountType` stamped, derived the same way
 *      `resolveAccountType` derives it: a login bound to an Employee record is
 *      an employee, an unbound one is the owner who registered the company.
 *
 * Idempotent, never throws, and a no-op on a clean database — the same contract
 * as backfillPayrollStatus (#458) and backfillSalaryStructures (#461).
 */

/** A `role` value that is really an account type that leaked into the field. */
const ACCOUNT_TYPE_IN_ROLE = { $in: ALL_ACCOUNT_TYPES };

/** A `role` value that is really a stringified ObjectId. */
const OBJECT_ID_STRING_IN_ROLE = /^[0-9a-fA-F]{24}$/;

/**
 * Count what needs fixing, so the log line says something useful on a database
 * that has already been migrated ("0 of everything") as well as one that has
 * not.
 *
 * @returns {Promise<{accountTypeInRole: number, stringifiedRole: number, missingAccountType: number}>}
 */
async function surveyAccounts() {
  const [accountTypeInRole, stringifiedRole, missingAccountType] =
    await Promise.all([
      User.countDocuments({ role: ACCOUNT_TYPE_IN_ROLE }),
      User.countDocuments({ role: OBJECT_ID_STRING_IN_ROLE }),
      User.countDocuments({
        $or: [{ accountType: { $exists: false } }, { accountType: null }],
      }),
    ]);

  return { accountTypeInRole, stringifiedRole, missingAccountType };
}

/**
 * Move an account-type string out of `role` and into `accountType`.
 *
 * `role` is unset rather than guessed at: these accounts genuinely never had an
 * RBAC role, and leaving a non-castable string behind would make every
 * subsequent `findById` on them throw a CastError.
 *
 * @returns {Promise<number>} accounts moved
 */
async function moveAccountTypeOutOfRole() {
  let moved = 0;

  for (const accountType of ALL_ACCOUNT_TYPES) {
    const result = await User.updateMany({ role: accountType }, [
      {
        $set: {
          // Do not clobber an accountType that is already correct.
          accountType: { $ifNull: ["$accountType", accountType] },
        },
      },
      { $unset: "role" },
    ]);

    moved += result.modifiedCount || 0;
  }

  return moved;
}

/**
 * Cast a stringified ObjectId in `role` back to a real ObjectId reference.
 *
 * Done document by document because the value differs per account, and the
 * population is small — one row per user whose role the middleware repaired.
 *
 * @returns {Promise<number>} accounts recast
 */
async function recastStringifiedRoles() {
  const affected = await User.find({ role: OBJECT_ID_STRING_IN_ROLE })
    .select("_id role")
    .lean();

  let recast = 0;

  for (const account of affected) {
    if (!mongoose.Types.ObjectId.isValid(account.role)) continue;

    await User.updateOne(
      { _id: account._id },
      { $set: { role: new mongoose.Types.ObjectId(String(account.role)) } },
    );

    recast += 1;
  }

  return recast;
}

/**
 * Stamp `accountType` on every account that still lacks one.
 *
 * Two passes rather than one `$set` with a default, so the derivation matches
 * `resolveAccountType` exactly: bound to an Employee record means EMPLOYEE,
 * unbound means ADMIN.
 *
 * @returns {Promise<{admins: number, employees: number}>}
 */
async function stampMissingAccountTypes() {
  const missing = {
    $or: [{ accountType: { $exists: false } }, { accountType: null }],
  };

  const employees = await User.updateMany(
    { ...missing, employeeId: { $exists: true, $ne: null } },
    { $set: { accountType: ACCOUNT_TYPE.EMPLOYEE } },
  );

  const admins = await User.updateMany(
    { ...missing },
    { $set: { accountType: ACCOUNT_TYPE.ADMIN } },
  );

  return {
    admins: admins.modifiedCount || 0,
    employees: employees.modifiedCount || 0,
  };
}

/**
 * Run the migration.
 *
 * @returns {Promise<{ok: boolean, survey: object, moved: number, recast: number, stamped: object, error?: string}>}
 */
async function backfillAccountType() {
  try {
    const survey = await surveyAccounts();

    const moved = await moveAccountTypeOutOfRole();
    const recast = await recastStringifiedRoles();
    const stamped = await stampMissingAccountTypes();

    logger.info("Account type backfill complete", {
      survey,
      moved,
      recast,
      stamped,
    });

    return { ok: true, survey, moved, recast, stamped };
  } catch (error) {
    logger.error("Account type backfill failed", { error: error.message });
    return {
      ok: false,
      survey: {},
      moved: 0,
      recast: 0,
      stamped: { admins: 0, employees: 0 },
      error: error.message,
    };
  }
}

// Allow running directly: `node src/migrations/backfillAccountType.js`
if (require.main === module) {
  require("dotenv").config();
  const connectDB = require("../config/db");

  (async () => {
    await connectDB();
    const result = await backfillAccountType();
    await mongoose.disconnect();
    process.exit(result.ok ? 0 : 1);
  })();
}

module.exports = {
  backfillAccountType,
  surveyAccounts,
  moveAccountTypeOutOfRole,
  recastStringifiedRoles,
  stampMissingAccountTypes,
};
