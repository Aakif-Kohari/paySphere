'use strict';

const {
  parseTime,
  evaluateShiftFatigueRules,
  calculatePriorityScore,
  rankBiddersBySeniorityAndScore,
} = require('../shiftConflict.utils');

describe('Shift Conflict, Fatigue & Seniority Priority Engine', () => {
  describe('parseTime', () => {
    it('parses HH:mm format into minutes from midnight', () => {
      expect(parseTime('09:30')).toBe(570);
      expect(parseTime('00:00')).toBe(0);
      expect(parseTime('23:59')).toBe(1439);
    });
  });

  describe('evaluateShiftFatigueRules', () => {
    it('detects violations when gap between consecutive shifts is less than 11 hours', () => {
      const existingShifts = [
        {
          date: '2026-08-17',
          startTime: '14:00',
          endTime: '22:00', // ends at 10 PM
        },
      ];

      const proposedShift = {
        date: '2026-08-18',
        startTime: '06:00', // starts at 6 AM -> gap is only 8 hours (< 11 hrs)
        endTime: '14:00',
      };

      const result = evaluateShiftFatigueRules(existingShifts, proposedShift, { minRestHours: 11 });
      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.includes('rest period'))).toBe(true);
    });

    it('clears when rest period is >= 11 hours', () => {
      const existingShifts = [
        {
          date: '2026-08-17',
          startTime: '09:00',
          endTime: '17:00', // ends at 5 PM
        },
      ];

      const proposedShift = {
        date: '2026-08-18',
        startTime: '09:00', // starts at 9 AM -> gap is 16 hours (>= 11 hrs)
        endTime: '17:00',
      };

      const result = evaluateShiftFatigueRules(existingShifts, proposedShift, { minRestHours: 11 });
      expect(result.isCompliant).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('detects weekly maximum hours violations (> 48 hrs)', () => {
      const existingShifts = [
        { date: '2026-08-15', startTime: '09:00', endTime: '21:00' }, // 12 hrs
        { date: '2026-08-16', startTime: '09:00', endTime: '21:00' }, // 12 hrs
        { date: '2026-08-17', startTime: '09:00', endTime: '21:00' }, // 12 hrs
        { date: '2026-08-18', startTime: '09:00', endTime: '17:00' }, // 8 hrs -> total 44 hrs
      ];

      const proposedShift = {
        date: '2026-08-19',
        startTime: '09:00',
        endTime: '17:00', // 8 hrs -> 44 + 8 = 52 hrs (> 48 hrs)
      };

      const result = evaluateShiftFatigueRules(existingShifts, proposedShift, { maxWeeklyHours: 48 });
      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.includes('weekly working limit'))).toBe(true);
    });
  });

  describe('calculatePriorityScore', () => {
    it('computes composite score for department and role match with tenure', () => {
      const employee = {
        department: 'Engineering',
        role: 'Senior Developer',
        joiningDate: new Date('2024-01-01'),
      };
      const openShift = {
        requiredDepartment: 'Engineering',
        requiredRole: 'Senior Developer',
      };

      const score = calculatePriorityScore(employee, openShift);
      expect(score).toBeGreaterThanOrEqual(80); // 50 (dept) + 30 (role) + tenure
    });
  });

  describe('rankBiddersBySeniorityAndScore', () => {
    it('breaks score ties by employee seniority/joiningDate', () => {
      const bids = [
        { employeeId: 'emp1', priorityScore: 100, createdAt: new Date('2026-08-17T10:00:00Z') },
        { employeeId: 'emp2', priorityScore: 100, createdAt: new Date('2026-08-17T09:00:00Z') },
      ];

      const empMap = new Map([
        ['emp1', { _id: 'emp1', joiningDate: new Date('2020-01-01') }], // more senior (2020)
        ['emp2', { _id: 'emp2', joiningDate: new Date('2023-01-01') }],
      ]);

      const ranked = rankBiddersBySeniorityAndScore(bids, empMap);
      expect(ranked[0].employeeId).toBe('emp1');
    });
  });
});
