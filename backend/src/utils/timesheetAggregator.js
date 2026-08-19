/**
 * @fileoverview Timesheet Aggregation, Overtime & Client Billing Engine
 * @description Calculates weekly billable hours, overtime multipliers (1.5x for >40 hrs/week),
 * fraud/idle detection heuristics, and builds Client/Vendor billing invoice payloads.
 */

'use strict';

/**
 * Calculates duration in minutes between two dates.
 * @param {Date|string} start 
 * @param {Date|string} end 
 * @returns {number} Minutes
 */
function calculateDurationMinutes(start, end) {
  if (!start || !end) return 0;
  const diffMs = new Date(end) - new Date(start);
  return Math.max(0, Math.round(diffMs / 60000));
}

/**
 * Calculates the billable amount for a timesheet entry.
 * Formula: (Duration in Hours) * Hourly Rate
 * 
 * @param {number} durationMinutes 
 * @param {number} hourlyRate 
 * @returns {number} Billable amount rounded to 2 decimal places
 */
function calculateBillableAmount(durationMinutes, hourlyRate) {
  const hours = durationMinutes / 60;
  return Math.round((hours * hourlyRate) * 100) / 100;
}

/**
 * Aggregates approved timesheet entries with overtime threshold evaluation.
 * 
 * @param {Array<object>} entries - Array of approved TimesheetEntry documents
 * @param {object} [options={}] - Options (e.g. weeklyOvertimeThresholdHours, overtimeMultiplier)
 * @returns {object} Summary and breakdown
 */
function aggregateTimesheetsForBilling(entries = [], options = {}) {
  const weeklyOvertimeThreshold = options.weeklyOvertimeThresholdHours || 40;
  const overtimeMultiplier = options.overtimeMultiplier || 1.5;

  let totalMinutes = 0;
  let standardAmount = 0;
  let overtimeAmount = 0;

  const breakdown = entries.map((entry) => {
    const mins = Number(entry.durationMinutes || 0);
    const rate = Number(entry.hourlyRate || 0);
    const amount = Number(entry.billableAmount || calculateBillableAmount(mins, rate));

    totalMinutes += mins;

    return {
      entryId: entry._id,
      date: entry.startTime,
      projectId: entry.projectId,
      contractorId: entry.contractorId,
      durationMinutes: mins,
      hours: Math.round((mins / 60) * 100) / 100,
      hourlyRate: rate,
      amount,
      description: entry.description,
    };
  });

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const standardHours = Math.min(totalHours, weeklyOvertimeThreshold);
  const overtimeHours = Math.max(0, totalHours - weeklyOvertimeThreshold);

  // Compute standard and overtime amounts
  const avgHourlyRate = entries.length > 0
    ? entries.reduce((acc, e) => acc + (Number(e.hourlyRate) || 0), 0) / entries.length
    : 0;

  if (overtimeHours > 0) {
    standardAmount = Math.round(standardHours * avgHourlyRate * 100) / 100;
    overtimeAmount = Math.round(overtimeHours * avgHourlyRate * overtimeMultiplier * 100) / 100;
  } else {
    standardAmount = breakdown.reduce((acc, b) => acc + b.amount, 0);
  }

  const totalBillableAmount = Math.round((standardAmount + overtimeAmount) * 100) / 100;

  return {
    totalEntries: entries.length,
    totalMinutes,
    totalHours,
    standardHours: Math.round(standardHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    standardAmount: Math.round(standardAmount * 100) / 100,
    overtimeAmount: Math.round(overtimeAmount * 100) / 100,
    totalAmount: totalBillableAmount,
    breakdown,
  };
}

/**
 * Idle Detection Heuristic
 * Flags entries where the duration exceeds a continuous work limit or is suspiciously tiny.
 * 
 * @param {number} durationMinutes 
 * @param {number} [maxContinuousMinutes=360] - Default 360 (6 hours)
 * @returns {{ isFlagged: boolean, reason: string }}
 */
function detectIdleOrFraud(durationMinutes, maxContinuousMinutes = 360) {
  if (durationMinutes > maxContinuousMinutes) {
    return {
      isFlagged: true,
      reason: `Continuous timer exceeded ${maxContinuousMinutes / 60} hours. Potential idle time or forgotten timer.`,
    };
  }

  if (durationMinutes > 0 && durationMinutes < 2) {
    return {
      isFlagged: true,
      reason: 'Duration too short (< 2 mins). Potential accidental timer start/stop.',
    };
  }

  return { isFlagged: false, reason: '' };
}

/**
 * Formats aggregated timesheet records into a ready-to-bill Client Invoice structure.
 *
 * @param {Array<object>} entries
 * @param {object} clientDetails
 * @param {string} invoiceNumber
 * @returns {object}
 */
function buildInvoicePayloadFromTimesheets(entries = [], clientDetails = {}, invoiceNumber = '') {
  const aggregated = aggregateTimesheetsForBilling(entries);

  return {
    invoiceNumber: invoiceNumber || `INV-TS-${Date.now()}`,
    clientId: clientDetails._id || clientDetails.id,
    foreignAmount: aggregated.totalAmount,
    foreignCurrency: clientDetails.defaultCurrency || 'USD',
    invoiceDate: new Date(),
    billingSummary: {
      totalHours: aggregated.totalHours,
      standardHours: aggregated.standardHours,
      overtimeHours: aggregated.overtimeHours,
      totalAmount: aggregated.totalAmount,
      lineItemsCount: aggregated.totalEntries,
    },
    timesheetEntryIds: entries.map((e) => e._id),
  };
}

module.exports = {
  calculateDurationMinutes,
  calculateBillableAmount,
  aggregateTimesheetsForBilling,
  detectIdleOrFraud,
  buildInvoicePayloadFromTimesheets,
};
