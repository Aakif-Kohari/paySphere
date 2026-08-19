/**
 * @fileoverview TOIL Accrual & Overtime Conversion Engine
 * @description Scans attendance logs for weekend/holiday work, manages accrual lifecycles,
 * and converts expired TOIL units into payable overtime compensation.
 */

const mongoose = require('mongoose');
const { ToilPolicy, ToilLedger } = require('../models/toil.model');
const logger = require('./logger');

/**
 * Determines if a specific date falls on a weekend.
 * @param {Date|string} date 
 * @returns {boolean}
 */
function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

/**
 * Calculates the current active TOIL balance for an employee.
 * @param {string} tenantId 
 * @param {string} employeeId 
 * @returns {Promise<number>}
 */
async function getCurrentBalance(tenantId, employeeId) {
  const tId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const eId = typeof employeeId === 'string' ? new mongoose.Types.ObjectId(employeeId) : employeeId;

  const result = await ToilLedger.aggregate([
    { $match: { tenantId: tId, employeeId: eId } },
    { $group: { _id: null, total: { $sum: '$days' } } },
  ]);
  return result.length > 0 ? Math.round(result[0].total * 100) / 100 : 0;
}

/**
 * Converts expired TOIL balance units into payable overtime compensation.
 *
 * @param {Array<object>} expiredEntries - Array of { employeeId, days, monthlySalary }
 * @param {object} policy - { holidayMultiplier, weekendMultiplier, allowEncashment }
 * @param {number} [overtimeMultiplier=1.5]
 * @returns {object}
 */
function convertExpiredToilToOvertime(expiredEntries = [], policy = {}, overtimeMultiplier = 1.5) {
  let totalDays = 0;
  let totalCompensation = 0;

  const payrollLines = expiredEntries.map((entry) => {
    const days = Math.max(0, Number(entry.days || 0));
    const monthlySalary = Number(entry.monthlySalary || entry.baseSalary || 30000);
    const dailyRate = Math.round((monthlySalary / 30) * 100) / 100;
    const multiplier = Number(policy.overtimeConversionMultiplier || overtimeMultiplier || 1.5);
    const amount = Math.round(days * dailyRate * multiplier * 100) / 100;

    totalDays += days;
    totalCompensation += amount;

    return {
      employeeId: entry.employeeId,
      component: 'TOIL Overtime Conversion',
      daysConverted: days,
      dailyRate,
      multiplier,
      amount,
      isTaxable: true,
    };
  });

  return {
    totalEntries: expiredEntries.length,
    totalDays: Math.round(totalDays * 100) / 100,
    totalCompensation: Math.round(totalCompensation * 100) / 100,
    payrollLines,
  };
}

/**
 * Evaluates upcoming TOIL expirations within a lookahead window.
 *
 * @param {Array<object>} ledgerEntries - Array of { employeeId, days, expiresAt }
 * @param {Date|string} asOfDate
 * @param {number} [windowDays=30]
 * @returns {Array<object>}
 */
function evaluateUpcomingToilExpirations(ledgerEntries = [], asOfDate = new Date(), windowDays = 30) {
  const asOf = new Date(asOfDate);
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() + windowDays);

  return ledgerEntries.filter((entry) => {
    if (!entry.expiresAt || entry.transactionType !== 'Accrual') return false;
    const exp = new Date(entry.expiresAt);
    return exp >= asOf && exp <= cutoff;
  });
}

/**
 * Processes a batch of approved attendance records and credits TOIL.
 */
async function processToilAccruals(attendanceRecords, tenantId, publicHolidays = []) {
  const policy = await ToilPolicy.findOne({ tenantId, isActive: true });
  if (!policy) {
    logger.info(`[TOIL] No active policy for tenant ${tenantId}. Skipping accruals.`);
    return { processed: 0, credited: 0 };
  }

  const holidaySet = new Set(publicHolidays.map((d) => new Date(d).toISOString().split('T')[0]));
  let processedCount = 0;
  let creditedCount = 0;

  for (const record of attendanceRecords) {
    const dateStr = new Date(record.date).toISOString().split('T')[0];
    const isHoliday = holidaySet.has(dateStr);
    const isWeekendDay = isWeekend(record.date);

    if (!isHoliday && !isWeekendDay) continue;

    const existingCredit = await ToilLedger.findOne({
      tenantId,
      employeeId: record.employeeId,
      referenceId: record._id,
      transactionType: 'Accrual',
    });

    if (existingCredit) continue;

    const multiplier = isHoliday ? policy.holidayMultiplier : policy.weekendMultiplier;
    const daysToCredit = 1 * multiplier;

    if (daysToCredit <= 0) continue;

    const currentBalance = await getCurrentBalance(tenantId, record.employeeId);
    const allowedCredit = Math.min(daysToCredit, policy.maxAccumulationDays - currentBalance);

    if (allowedCredit <= 0) {
      logger.info(`[TOIL] Employee ${record.employeeId} reached max accumulation cap.`);
      continue;
    }

    const expiresAt = new Date(record.date);
    expiresAt.setDate(expiresAt.getDate() + policy.expirationDays);

    await ToilLedger.create({
      tenantId,
      employeeId: record.employeeId,
      transactionType: 'Accrual',
      days: allowedCredit,
      balanceAfter: currentBalance + allowedCredit,
      expiresAt,
      referenceId: record._id,
      description: `TOIL Accrual for ${isHoliday ? 'Public Holiday' : 'Weekend'} work on ${dateStr}`,
    });

    creditedCount += allowedCredit;
    processedCount++;
  }

  return { processed: processedCount, credited: creditedCount };
}

module.exports = {
  isWeekend,
  getCurrentBalance,
  convertExpiredToilToOvertime,
  evaluateUpcomingToilExpirations,
  processToilAccruals,
};
