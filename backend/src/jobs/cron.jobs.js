const cron = require("node-cron");
const PayrollUpdate = require("../models/payroll.model");
const Employee = require("../models/employee.model");
const CronLock = require("../models/cronlock.model");
const { sendPayslipEmail } = require("../services/email.service");
const { sendEmail } = require("../utils/email");
const { emailableStatusFilter } = require("../config/payrollStatus");
const logger = require("../utils/logger");

const LOCK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Take a named lock so only one instance runs a given job for a given period.
 *
 * The lock is a document whose `_id` is the period key, so a second instance
 * loses on the unique index rather than on a race the application has to reason
 * about itself.
 *
 * @param {string} lockId
 * @returns {Promise<{acquired: boolean, reason?: string}>}
 */
async function acquireLock(lockId) {
  try {
    await CronLock.create({
      _id: lockId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
    });

    return { acquired: true };
  } catch (error) {
    if (error.code === 11000) {
      return { acquired: false, reason: "held" };
    }

    logger.error("Failed to acquire cron lock", {
      lockId,
      error: error.message,
    });
    return { acquired: false, reason: "error" };
  }
}

/**
 * Give a lock back.
 *
 * The lock exists to stop two instances doing the same work at once, not to
 * record that the work was attempted. A run that failed — or that found nothing
 * because of a bug — used to leave it behind for 24 hours, so a corrected
 * deployment on the same day was skipped without a word.
 *
 * @param {string} lockId
 * @returns {Promise<void>}
 */
async function releaseLock(lockId) {
  try {
    await CronLock.deleteOne({ _id: lockId });
  } catch (error) {
    // Not fatal: the TTL index clears it within the day regardless.
    logger.warn("Failed to release cron lock", { lockId, error: error.message });
  }
}

/**
 * The month a payslip run on `now` is for — the one that just ended.
 *
 * Anchored to the 1st before stepping back, because `setMonth(getMonth() - 1)`
 * on the 31st lands on the wrong month whenever the previous one is shorter.
 *
 * @param {Date} now
 * @returns {{month: number, year: number}}
 */
function previousPeriod(now) {
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1);
  anchor.setMonth(anchor.getMonth() - 1);

  return { month: anchor.getMonth() + 1, year: anchor.getFullYear() };
}

/**
 * Email the payslips for the month that just ended.
 *
 * The query used to be `status: "finalized"`. `config/payrollStatus.js` retired
 * that value: `payroll.model.js` normalises it to `approved` on write and
 * `migrations/backfillPayrollStatus.js` rewrote every existing row, so nothing
 * on disk could match it. The job found zero rows every month, logged "Found 0
 * finalized payrolls", and exited successfully — payslips stopped going out and
 * nothing said so (#560).
 *
 * It now asks `emailableStatusFilter()`, the same source of truth the manual
 * dispatch path reaches through `isEmailable`, so an unapproved or rejected run
 * can never be emailed and the two cannot drift apart again.
 *
 * Exported so it can be tested, and so an operator can re-run a month by hand.
 *
 * @param {object} [options]
 * @param {Date} [options.now] the moment the job is treated as having fired
 * @returns {Promise<{ran: boolean, reason?: string, month: number, year: number, found: number, sent: number, skipped: number, failed: number}>}
 */
async function runMonthlyPayslipJob({ now = new Date() } = {}) {
  const { month, year } = previousPeriod(now);
  const lockId = `monthly_payslip_${year}_${month}`;

  let found = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info("Monthly payslip job skipped: lock is held elsewhere", {
      lockId,
      month,
      year,
    });
    return { ran: false, reason: lock.reason, month, year, found, sent, skipped, failed };
  }

  try {
    const payrolls = await PayrollUpdate.find({
      month,
      year,
      ...emailableStatusFilter(),
      payslipEmailed: false,
    });

    found = payrolls.length;
    logger.info(`Monthly payslip job: ${found} payslip(s) to send`, {
      month,
      year,
    });

    for (const payroll of payrolls) {
      try {
        const employee = await Employee.findById(payroll.employeeId);

        if (!employee || !employee.email) {
          // Nothing to send to. Counted rather than ignored, so "0 sent" can be
          // told apart from "nobody has an email address on file".
          skipped += 1;
          continue;
        }

        await sendPayslipEmail(employee, payroll);
        await PayrollUpdate.updateOne(
          { _id: payroll._id },
          { $set: { payslipEmailed: true } },
        );
        sent += 1;
      } catch (error) {
        // One bad address or SMTP hiccup must not cost everyone else their
        // payslip, so the loop carries on and the failure is counted.
        failed += 1;
        logger.error("Failed to send a payslip", {
          payrollId: String(payroll._id),
          month,
          year,
          error: error.message,
        });
      }
    }

    logger.info("Monthly payslip job complete", {
      month,
      year,
      found,
      sent,
      skipped,
      failed,
    });

    // A run that sent nothing is not proof of a quiet month — it is precisely
    // what this bug looked like for months — so hand the lock back and let a
    // later attempt try again instead of blocking it for 24 hours.
    if (sent === 0) await releaseLock(lockId);

    return { ran: true, month, year, found, sent, skipped, failed };
  } catch (error) {
    logger.error("Monthly payslip job failed", {
      month,
      year,
      error: error.message,
    });
    await releaseLock(lockId);

    return { ran: false, reason: "error", month, year, found, sent, skipped, failed };
  }
}

/**
 * Birthday and work-anniversary greetings for today.
 *
 * Exported for the same reasons as the payslip job.
 *
 * @param {object} [options]
 * @param {Date} [options.now]
 * @returns {Promise<{ran: boolean, reason?: string, sent: number, failed: number}>}
 */
async function runDailyGreetingsJob({ now = new Date() } = {}) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const lockId = `daily_greetings_${now.getFullYear()}_${month}_${day}`;

  let sent = 0;
  let failed = 0;

  const lock = await acquireLock(lockId);
  if (!lock.acquired) {
    logger.info("Daily greetings job skipped: lock is held elsewhere", {
      lockId,
    });
    return { ran: false, reason: lock.reason, sent, failed };
  }

  try {
    const employees = await Employee.find({
      isActive: true,
      email: { $exists: true, $ne: "" },
    });

    for (const employee of employees) {
      try {
        if (employee.dateOfBirth) {
          const dob = new Date(employee.dateOfBirth);
          if (dob.getMonth() + 1 === month && dob.getDate() === day) {
            await sendEmail({
              to: employee.email,
              subject: `Happy Birthday, ${employee.fullName}!`,
              text: `Dear ${employee.fullName},\n\nWishing you a very Happy Birthday from everyone at ${employee.companyName}!\n\nBest Regards,\nThe Team`,
            });
            sent += 1;
          }
        }

        if (employee.joiningDate) {
          const joined = new Date(employee.joiningDate);
          if (joined.getMonth() + 1 === month && joined.getDate() === day) {
            const years = now.getFullYear() - joined.getFullYear();
            if (years > 0) {
              await sendEmail({
                to: employee.email,
                subject: `Happy ${years} Year Work Anniversary, ${employee.fullName}!`,
                text: `Dear ${employee.fullName},\n\nCongratulations on reaching your ${years} year anniversary at ${employee.companyName}! We appreciate all your hard work.\n\nBest Regards,\nThe Team`,
              });
              sent += 1;
            }
          }
        }
      } catch (error) {
        // Same reasoning as the payslip loop: one bad address is not a reason
        // for everybody else to go without.
        failed += 1;
        logger.error("Failed to send a greeting", {
          employeeId: String(employee._id),
          error: error.message,
        });
      }
    }

    logger.info("Daily greetings job complete", { sent, failed });

    return { ran: true, sent, failed };
  } catch (error) {
    logger.error("Daily greetings job failed", { error: error.message });
    await releaseLock(lockId);

    return { ran: false, reason: "error", sent, failed };
  }
}

const startCronJobs = () => {
  // 09:00 on the 1st of every month.
  cron.schedule("0 9 1 * *", () => {
    runMonthlyPayslipJob().catch((error) =>
      logger.error("Monthly payslip job threw", { error: error.message }),
    );
  });
  logger.info("Payslip cron job registered.");

  // 08:00 daily.
  cron.schedule("0 8 * * *", () => {
    runDailyGreetingsJob().catch((error) =>
      logger.error("Daily greetings job threw", { error: error.message }),
    );
  });
  logger.info("Daily greetings cron job registered.");
};

module.exports = {
  startCronJobs,
  runMonthlyPayslipJob,
  runDailyGreetingsJob,
  previousPeriod,
  acquireLock,
  releaseLock,
};
