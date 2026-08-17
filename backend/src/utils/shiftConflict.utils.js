/**
 * @fileoverview Shift Conflict, Fatigue & Seniority Priority Engine
 * @description Validates bids against existing rosters, statutory rest periods (11 hrs min),
 * weekly fatigue limits (48 hrs max), and ranks bidders by seniority and composite scores.
 */

'use strict';

const ShiftRoster = require('../models/shiftRoster.model').ShiftRoster;

/**
 * Parses "HH:mm" to minutes since midnight.
 * @param {string} timeStr
 * @returns {number}
 */
function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Evaluates labor fatigue and mandatory statutory rest rules.
 *
 * @param {Array<object>} existingShifts - Array of { date, startTime, endTime, durationHours }
 * @param {object} proposedShift - { date, startTime, endTime, durationHours }
 * @param {object} [options={}] - { minRestHours: 11, maxWeeklyHours: 48, maxConsecutiveDays: 6 }
 * @returns {{ isCompliant: boolean, violations: string[], totalWeeklyHours: number }}
 */
function evaluateShiftFatigueRules(existingShifts = [], proposedShift = {}, options = {}) {
  const minRestHours = options.minRestHours !== undefined ? options.minRestHours : 11;
  const maxWeeklyHours = options.maxWeeklyHours !== undefined ? options.maxWeeklyHours : 48;
  const minRestMins = minRestHours * 60;

  const violations = [];
  const targetDate = new Date(proposedShift.date);
  targetDate.setHours(0, 0, 0, 0);

  const propStart = parseTime(proposedShift.startTime);
  let propEnd = parseTime(proposedShift.endTime);
  if (propEnd <= propStart) propEnd += 24 * 60;
  const propDurationHours = (propEnd - propStart) / 60;

  let totalWeeklyHours = propDurationHours;

  for (const ex of existingShifts) {
    const exDate = new Date(ex.date);
    exDate.setHours(0, 0, 0, 0);

    const exStart = parseTime(ex.startTime);
    let exEnd = parseTime(ex.endTime);
    if (exEnd <= exStart) exEnd += 24 * 60;
    const exDurationHours = (exEnd - exStart) / 60;

    // Accumulate hours within a 7-day window
    const dayDiff = Math.abs((targetDate - exDate) / (1000 * 60 * 60 * 24));
    if (dayDiff <= 6) {
      totalWeeklyHours += exDurationHours;
    }

    // Direct overlap check
    if (targetDate.getTime() === exDate.getTime()) {
      if (Math.max(propStart, exStart) < Math.min(propEnd, exEnd)) {
        violations.push('Direct schedule overlap on the same date.');
      }
    }

    // Consecutive day rest period checks
    if (dayDiff === 1) {
      let gapMins = 0;
      if (targetDate > exDate) {
        // Proposed is next day
        gapMins = (24 * 60 - exEnd) + propStart;
      } else {
        // Proposed is previous day
        gapMins = (24 * 60 - propEnd) + exStart;
      }

      if (gapMins < minRestMins) {
        violations.push(
          `Violates statutory ${minRestHours}-hour rest period between shifts (Gap: ${Math.round((gapMins / 60) * 10) / 10}h).`,
        );
      }
    }
  }

  if (totalWeeklyHours > maxWeeklyHours) {
    violations.push(
      `Exceeds maximum ${maxWeeklyHours} hours weekly working limit (Projected: ${Math.round(totalWeeklyHours * 10) / 10}h).`,
    );
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    totalWeeklyHours: Math.round(totalWeeklyHours * 100) / 100,
  };
}

/**
 * Checks if a proposed shift conflicts with an employee's existing roster.
 */
async function checkShiftConflicts(tenantId, employeeId, date, startTime, endTime) {
  const reasons = [];
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 3);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 3);

  const existingShifts = await ShiftRoster.find({
    tenantId,
    employeeId,
    date: { $gte: startDate, $lte: endDate },
    status: { $ne: 'Cancelled' },
  }).populate('shiftTemplateId');

  const mapped = existingShifts
    .filter((s) => s.shiftTemplateId)
    .map((s) => ({
      date: s.date,
      startTime: s.shiftTemplateId.startTime,
      endTime: s.shiftTemplateId.endTime,
    }));

  const fatigueResult = evaluateShiftFatigueRules(mapped, { date, startTime, endTime });

  return {
    hasConflict: !fatigueResult.isCompliant,
    reasons: fatigueResult.violations,
  };
}

/**
 * Calculates a priority score for a bidder based on role, department, and tenure.
 */
function calculatePriorityScore(employee, openShift) {
  let score = 0;

  if (openShift.requiredDepartment && employee.department === openShift.requiredDepartment) {
    score += 50;
  }

  if (openShift.requiredRole && employee.role === openShift.requiredRole) {
    score += 30;
  }

  if (employee.joiningDate) {
    const monthsEmployed = (new Date() - new Date(employee.joiningDate)) / (1000 * 60 * 60 * 24 * 30);
    score += Math.min(Math.floor(monthsEmployed), 50);
  }

  return score;
}

/**
 * Ranks bids considering composite score, employee seniority, and submission timestamp.
 *
 * @param {Array<object>} bids
 * @param {Map<string, object>} employeesMap
 * @returns {Array<object>}
 */
function rankBiddersBySeniorityAndScore(bids = [], employeesMap = new Map()) {
  return [...bids].sort((a, b) => {
    // 1. Primary: Priority Score
    const scoreDiff = (b.priorityScore || 0) - (a.priorityScore || 0);
    if (scoreDiff !== 0) return scoreDiff;

    // 2. Secondary: Tenure / Seniority Date
    const empA = employeesMap.get(String(a.employeeId));
    const empB = employeesMap.get(String(b.employeeId));

    const tenureA = empA?.joiningDate ? new Date(empA.joiningDate).getTime() : Infinity;
    const tenureB = empB?.joiningDate ? new Date(empB.joiningDate).getTime() : Infinity;

    const tenureDiff = tenureA - tenureB; // earlier joining date is more senior
    if (tenureDiff !== 0) return tenureDiff;

    // 3. Tertiary: Submission timestamp
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
}

module.exports = {
  parseTime,
  evaluateShiftFatigueRules,
  checkShiftConflicts,
  calculatePriorityScore,
  rankBiddersBySeniorityAndScore,
};
