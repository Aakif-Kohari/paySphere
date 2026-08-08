/**
 * A named lock, so only one instance runs a given job for a given period.
 *
 * The `_id` *is* the lock name, so a second instance loses on the unique index
 * rather than on a race the application has to reason about itself — see
 * `acquireLock` in jobs/cron.jobs.js, which is the reference implementation of
 * this pattern.
 *
 * The three fields below `expiresAt` were added in #796. The leave accrual job
 * (#646) wrote `status`, `completedAt` and `error` to this collection, and none
 * of them were declared here — mongoose runs in strict mode, so every one was
 * dropped before the query left the process. `lock.status === 'completed'` was
 * therefore comparing against `undefined` on every run, the "already completed,
 * skipping" branch was unreachable, and the guard that existed to prevent
 * double-accrual could not prevent anything.
 */

const mongoose = require('mongoose');
const softDeletePlugin = require('../utils/softDelete.plugin');

/** A run in progress, one that finished, and one that did not. */
const LOCK_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const cronLockSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., 'monthly_payslip'
  lockedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true }, // TTL index

  /**
   * How the run that holds this lock ended.
   *
   * Optional, because `cron.jobs.js` uses the lock purely as a mutex and
   * deletes it when it is done — it has no use for a status. The accrual job
   * needs the stronger property: "this period has already been accrued" has to
   * survive the lock document outliving the run.
   */
  status: {
    type: String,
    enum: Object.values(LOCK_STATUS),
    default: LOCK_STATUS.PROCESSING,
  },
  completedAt: { type: Date, default: null },
  /** The failure message, when `status` is `failed`. Kept for the operator. */
  error: { type: String, default: null },
});

// Automatically delete locks after they expire.
//
// This index only sees documents that *have* an `expiresAt`. The accrual job's
// upsert omitted it — `required` is not enforced on an update unless
// `runValidators` is set — so its locks were inserted without the field and
// accumulated permanently, one per month (#796).
cronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

cronLockSchema.plugin(softDeletePlugin);

const CronLock = mongoose.model('CronLock', cronLockSchema);

CronLock.LOCK_STATUS = LOCK_STATUS;

module.exports = CronLock;
