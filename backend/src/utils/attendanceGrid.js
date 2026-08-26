/**
 * @fileoverview Attendance Grid Validation & Shift-Based Overtime Multiplier Engine
 * @description Pure functions for attendance grid validation, biometric timestamp log ingestion,
 * and shift differential overtime calculations (night shift 1.5x, weekend 2.0x, public holiday 2.5x).
 */

'use strict';

const {
  ATTENDANCE_STATUS,
  normalizeAttendanceStatus,
  weightsFor,
  MAX_OVERTIME_HOURS_PER_DAY,
  MAX_OVERTIME_HOURS_PER_MONTH,
} = require('../config/attendance');

const SHIFT_MULTIPLIERS = {
  DAY: 1.0,
  NIGHT: 1.5,
  WEEKEND: 2.0,
  HOLIDAY: 2.5,
};

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isValidMonth(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidYear(value) {
  return Number.isInteger(value) && value >= 2000 && value <= 2100;
}

function normalizeOvertimeHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  const rounded = Math.round(hours * 4) / 4;
  return Math.min(rounded, MAX_OVERTIME_HOURS_PER_DAY);
}

/**
 * Calculate weighted overtime hours applying shift multipliers.
 *
 * @param {number} rawOvertimeHours
 * @param {string} [shiftType='DAY'] 'DAY'|'NIGHT'|'WEEKEND'|'HOLIDAY'
 * @param {boolean} [isWeekend=false]
 * @param {boolean} [isHoliday=false]
 * @returns {number}
 */
function computeShiftOvertimeMultiplier(
  rawOvertimeHours,
  shiftType = 'DAY',
  isWeekend = false,
  isHoliday = false,
) {
  const hours = normalizeOvertimeHours(rawOvertimeHours);
  if (hours === 0) return 0;

  let multiplier =
    SHIFT_MULTIPLIERS[shiftType?.toUpperCase()] || SHIFT_MULTIPLIERS.DAY;
  if (isHoliday) multiplier = Math.max(multiplier, SHIFT_MULTIPLIERS.HOLIDAY);
  else if (isWeekend)
    multiplier = Math.max(multiplier, SHIFT_MULTIPLIERS.WEEKEND);

  return Math.round(hours * multiplier * 100) / 100;
}

/**
 * Parse raw biometric clock-in/out logs into structured daily attendance status entries.
 *
 * @param {Array<{date: string|Date, clockIn: string, clockOut: string, shiftType?: string}>} logs
 * @param {number} year
 * @param {number} month
 * @param {Array<{date: Date, type: string}>} [holidays=[]]
 * @returns {Array<{day: number, status: string, overtimeHours: number, shiftType: string}>}
 */
function parseBiometricLogs(logs = [], year, month, holidays = []) {
  if (!Array.isArray(logs)) return [];

  const dayMap = new Map();
  for (const log of logs) {
    const d = new Date(log.date || log.clockIn);
    if (isNaN(d.getTime())) continue;

    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const dayNum = d.getDate();
      const inTime = new Date(log.clockIn);
      const outTime = new Date(log.clockOut);

      let status = ATTENDANCE_STATUS.PRESENT;
      let overtimeHours = 0;

      if (!isNaN(inTime.getTime()) && !isNaN(outTime.getTime())) {
        const workedHours =
          (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
        if (workedHours < 4) {
          status = ATTENDANCE_STATUS.ABSENT;
        } else if (workedHours < 7.5) {
          status = ATTENDANCE_STATUS.HALF_DAY;
        } else if (workedHours > 8.5) {
          overtimeHours = workedHours - 8;
        }
      }

      dayMap.set(dayNum, {
        day: dayNum,
        status,
        overtimeHours: normalizeOvertimeHours(overtimeHours),
        shiftType: log.shiftType || 'DAY',
      });
    }
  }

  const result = [];
  const totalDays = daysInMonth(year, month);

  const holidayMap = new Map();
  holidays.forEach((h) => {
    const hd = new Date(h.date);
    if (hd.getFullYear() === year && hd.getMonth() + 1 === month) {
      holidayMap.set(hd.getDate(), h.type);
    }
  });

  for (let day = 1; day <= totalDays; day++) {
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    const hType = holidayMap.get(day);

    let defaultStatus = ATTENDANCE_STATUS.PRESENT;
    if (isSunday || hType === 'gazetted') {
      defaultStatus = ATTENDANCE_STATUS.HOLIDAY;
    } else if (hType === 'half-day') {
      defaultStatus = ATTENDANCE_STATUS.HALF_DAY;
    }

    if (dayMap.has(day)) {
      result.push(dayMap.get(day));
    } else {
      result.push({
        day,
        status: defaultStatus,
        overtimeHours: 0,
        shiftType: 'DAY',
      });
    }
  }

  return result;
}

function validateGrid(days, year, month) {
  const errors = [];
  if (!Array.isArray(days)) {
    return {
      ok: false,
      days: [],
      errors: [{ day: null, reason: 'days must be an array' }],
    };
  }

  const total = daysInMonth(year, month);
  const seen = new Set();
  const cleaned = [];

  days.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push({ day: index + 1, reason: 'day entry must be an object' });
      return;
    }

    const dayNum = Number(entry.day);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > total) {
      errors.push({
        day: entry.day,
        reason: `day must be an integer between 1 and ${total}`,
      });
      return;
    }

    if (seen.has(dayNum)) {
      errors.push({ day: dayNum, reason: `duplicate entry for day ${dayNum}` });
      return;
    }
    seen.add(dayNum);

    const status = normalizeAttendanceStatus(entry.status);
    if (!status) {
      errors.push({ day: dayNum, reason: `invalid status: ${entry.status}` });
      return;
    }

    const overtimeHours = normalizeOvertimeHours(entry.overtimeHours);
    const shiftType = entry.shiftType || 'DAY';
    cleaned.push({ day: dayNum, status, overtimeHours, shiftType });
  });

  return { ok: errors.length === 0, days: cleaned, errors };
}

function computeTotals(days) {
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let holidayDays = 0;
  let totalOvertimeHours = 0;
  let totalWeightedOvertimeHours = 0;

  for (const entry of days) {
    const weights = weightsFor(entry.status);
    presentDays += weights.present || weights.workedWeight || 0;
    halfDays += entry.status === ATTENDANCE_STATUS.HALF_DAY ? 1 : 0;
    paidLeaveDays += weights.paidLeaveWeight || 0;
    unpaidLeaveDays += weights.unpaidWeight || 0;

    if (entry.status === ATTENDANCE_STATUS.HOLIDAY) {
      holidayDays += 1;
    }

    totalOvertimeHours += entry.overtimeHours || 0;

    const weighted = computeShiftOvertimeMultiplier(
      entry.overtimeHours,
      entry.shiftType,
      entry.isWeekend,
      entry.isHoliday,
    );
    totalWeightedOvertimeHours += weighted;
  }

  return {
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    holidayDays,
    totalOvertimeHours: Math.min(
      totalOvertimeHours,
      MAX_OVERTIME_HOURS_PER_MONTH,
    ),
    totalWeightedOvertimeHours: Math.min(
      totalWeightedOvertimeHours,
      MAX_OVERTIME_HOURS_PER_MONTH * 2.5,
    ),
  };
}

function derivePayrollInputs(days, year, month) {
  const totals = computeTotals(days);
  return {
    unpaidLeaveDays: totals.unpaidLeaveDays,
    overtimeHours: totals.totalOvertimeHours,
    weightedOvertimeHours: totals.totalWeightedOvertimeHours,
    presentDays: totals.presentDays,
    daysInMonth: daysInMonth(year, month),
    holidaysCount: totals.holidayDays,
  };
}

function buildDefaultGrid(year, month, holidays = []) {
  const total = daysInMonth(year, month);
  const days = [];

  const holidayMap = new Map();
  holidays.forEach((h) => {
    const hd = new Date(h.date);
    if (hd.getFullYear() === year && hd.getMonth() + 1 === month) {
      holidayMap.set(hd.getDate(), h.type);
    }
  });

  for (let day = 1; day <= total; day += 1) {
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    const hType = holidayMap.get(day);

    let defaultStatus = ATTENDANCE_STATUS.PRESENT;
    if (isSunday || hType === 'gazetted') {
      defaultStatus = ATTENDANCE_STATUS.HOLIDAY;
    } else if (hType === 'half-day') {
      defaultStatus = ATTENDANCE_STATUS.HALF_DAY;
    }
    days.push({
      day,
      status: defaultStatus,
      overtimeHours: 0,
      shiftType: 'DAY',
    });
  }
  return days;
}

module.exports = {
  SHIFT_MULTIPLIERS,
  daysInMonth,
  isValidMonth,
  isValidYear,
  normalizeOvertimeHours,
  computeShiftOvertimeMultiplier,
  parseBiometricLogs,
  validateGrid,
  computeTotals,
  derivePayrollInputs,
  buildDefaultGrid,
};
