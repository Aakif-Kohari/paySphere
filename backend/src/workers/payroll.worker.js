const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const User = require('../models/user.model');
const { calculateNetSalary } = require('../utils/salaryCalculator');
const { connection } = require('../jobs/queue.service');
const logger = require('../utils/logger');

// Helper: parse tag labels back into structured numbers
function parseTagValue(label) {
  if (typeof label !== 'string') return 0;
  const num = label.replace(/[^0-9.]/g, '');
  if (!num) return 0;
  const parsed = parseFloat(num);
  return isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
}

const payrollWorker = new Worker(
  'payroll-processing',
  async (job) => {
    let session = null;
    try {
      logger.info(
        `Starting payroll processing job ${job.id} for user ${job.data.userId}`,
      );

      const { activities, currentMonth, currentYear, userId } = job.data;

      // ── Idempotency Guard ────────────────────────────────────────────────
      // Prevent double-processing the same payroll period if two BullMQ workers
      // pick up the same job, or the job is retried after a crash mid-run.
      const lockName = `payroll_${userId}_${currentYear}_${String(currentMonth).padStart(2, '0')}`;
      const lock = await acquireLock(lockName, 10 * 60 * 1000);
      if (!lock) {
        logger.warn('Payroll job skipped — period already locked or processing', {
          userId, currentMonth, currentYear,
        });
        return { skipped: true, reason: 'lock_held' };
      }
      // ────────────────────────────────────────────────────────────────────

      const employees = await Employee.find({ createdBy: userId, deletedAt: null });
      const user = await User.findById(userId);

      const preparedItems = [];
      const errors = [];

      // Phase 1: Upfront in-memory calculation and validation (no partial writes)
      for (const act of activities) {
        if (!act || typeof act !== 'object') {
          errors.push('Invalid activity entry format');
          continue;
        }

        let employeeId = act.employeeId;
        if (!employeeId && act.name) {
          const matchedEmp = employees.find(
            (emp) => emp.fullName.toLowerCase() === act.name.toLowerCase(),
          );
          if (matchedEmp) {
            employeeId = matchedEmp._id;
          }
        }

        if (!employeeId) {
          errors.push(
            `employeeId is required but missing for activity involving "${act.name || 'unnamed'}"`,
          );
          continue;
        }

        const employee = employees.find(
          (emp) => String(emp._id) === String(employeeId),
        );

        if (!employee || !employee.isActive) continue;

        let leaveDays = 0,
          overtimeHours = 0,
          bonus = 0,
          deductions = 0;

        const tagsList = Array.isArray(act.tags) ? act.tags : [];
        for (const tag of tagsList) {
          if (!tag || typeof tag.label !== 'string') continue;
          const lower = tag.label.toLowerCase();
          const value = parseTagValue(tag.label);

          if (lower.includes('leave') || lower.includes('day')) {
            leaveDays += value;
          } else if (lower.includes('overtime') || lower.includes('hr')) {
            overtimeHours += value;
          } else if (lower.includes('bonus')) {
            bonus += value;
          } else if (lower.includes('deduction')) {
            deductions += value;
          }
        }

        const { baseSalary, leaveDeduction, overtimePay, netSalary } =
          calculateNetSalary(employee, user, {
            leaveDays,
            overtimeHours,
            bonus,
            deductions,
          });

        preparedItems.push({
          employee,
          baseSalary,
          leaveDays,
          overtimeHours,
          bonus,
          deductions,
          leaveDeduction,
          overtimePay,
          netSalary,
        });
      }

      if (preparedItems.length === 0) {
        throw new Error('No valid employee activities to process');
      }

      // Phase 2: Transaction Execution
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch {
        session = null;
      }

      const savedRecords = [];

      for (let i = 0; i < preparedItems.length; i++) {
        const item = preparedItems[i];
        const existingRecord = await PayrollUpdate.findOne({
          employeeId: item.employee._id,
          month: currentMonth,
          year: currentYear,
        }).session(session);

        if (existingRecord) {
          throw new Error(
            `Payroll already processed for ${item.employee.fullName} for ${currentMonth}/${currentYear}`,
          );
        }

        const payrollUpdate = new PayrollUpdate({
          employeeId: item.employee._id,
          employeeName: item.employee.fullName,
          month: currentMonth,
          year: currentYear,
          baseSalary: item.baseSalary,
          leaveDays: item.leaveDays,
          overtimeHours: item.overtimeHours,
          bonus: item.bonus,
          deductions: item.deductions,
          leaveDeduction: item.leaveDeduction,
          overtimePay: item.overtimePay,
          netSalary: item.netSalary,
          createdBy: userId,
        });

        await payrollUpdate.save({ session });
        savedRecords.push(payrollUpdate);

        // Update job progress
        await job.updateProgress(
          Math.floor(((i + 1) / preparedItems.length) * 100),
        );
      }

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      logger.info(`Successfully processed payroll job ${job.id}`);
      return { success: true, processedCount: savedRecords.length };
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      logger.error(`Error processing payroll job ${job.id}:`, error);
      throw error;
    }
  },
  { connection },
);

payrollWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} has completed!`);
});

payrollWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} has failed with ${err.message}`);
});

module.exports = payrollWorker;
