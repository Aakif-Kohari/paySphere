'use strict';

const {
  round2,
  daysInMonth,
  computeProratedSalary,
  computeLeaveEncashment,
  computeServiceYears,
  computeGratuity,
  computeNoticeShortfall,
  buildSettlement,
  validateSettlement,
} = require('../settlement');

describe('Full & Final Settlement Engine', () => {
  describe('round2', () => {
    it('should round numbers accurately to 2 decimal places', () => {
      expect(round2(100.456)).toBe(100.46);
      expect(round2(50.1)).toBe(50.1);
    });
  });

  describe('daysInMonth', () => {
    it('should return correct number of days in month', () => {
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2026, 8)).toBe(31);
    });
  });

  describe('computeProratedSalary', () => {
    it('should compute prorated salary for partial worked month', () => {
      const result = computeProratedSalary(60000, '2026-08-15');
      expect(result.amount).toBeGreaterThan(0);
      expect(result.daysWorked).toBe(15);
    });

    it('should return 0 when salary is zero or missing', () => {
      const result = computeProratedSalary(0, '2026-08-15');
      expect(result.amount).toBe(0);
    });
  });

  describe('computeLeaveEncashment', () => {
    it('should compute leave encashment for unused leaves', () => {
      const result = computeLeaveEncashment({
        unusedLeaveDays: 10,
        monthlySalary: 52000,
        capDays: 30,
      });

      expect(result.amount).toBe(20000); // 52000 / 26 * 10
      expect(result.encashableDays).toBe(10);
    });

    it('should cap leave encashment at maximum policy limit', () => {
      const result = computeLeaveEncashment({
        unusedLeaveDays: 45,
        monthlySalary: 52000,
        capDays: 30,
      });

      expect(result.encashableDays).toBe(30);
      expect(result.capApplied).toBe(true);
    });
  });

  describe('computeGratuity', () => {
    it('should calculate statutory gratuity for employees with >= 5 years of service', () => {
      const result = computeGratuity({
        joiningDate: '2020-01-01',
        lastWorkingDay: '2026-08-01',
        lastDrawnBasic: 30000,
        enabled: true,
      });

      expect(result.eligible).toBe(true);
      expect(result.years).toBe(7); // 6 yrs 7 mos rounded up
      expect(result.amount).toBe(121153.85); // (30000 * 15 * 7) / 26
    });

    it('should mark employee ineligible for gratuity if tenure < 5 years', () => {
      const result = computeGratuity({
        joiningDate: '2023-01-01',
        lastWorkingDay: '2026-08-01',
        lastDrawnBasic: 30000,
        enabled: true,
      });

      expect(result.eligible).toBe(false);
      expect(result.amount).toBe(0);
    });
  });

  describe('computeNoticeShortfall', () => {
    it('should calculate notice shortfall deduction when unserved days exist', () => {
      const result = computeNoticeShortfall({
        noticePeriodDays: 30,
        noticeServedDays: 10,
        monthlySalary: 52000,
      });

      expect(result.shortfallDays).toBe(20);
      expect(result.amount).toBe(40000); // 52000 / 26 * 20
    });
  });

  describe('buildSettlement & validateSettlement', () => {
    it('should assemble complete FnF statement and validate net settlement', () => {
      const statement = buildSettlement({
        monthlySalary: 52000,
        lastWorkingDay: '2026-08-15',
        joiningDate: '2019-01-01',
        unusedLeaveDays: 5,
        noticePeriodDays: 30,
        noticeServedDays: 30,
        bonus: 10000,
        advanceRecovery: 2000,
      });

      expect(statement.netSettlement).toBeGreaterThan(0);
      expect(statement.grossEarnings).toBeGreaterThan(0);
      expect(statement.totalDeductions).toBe(2000);

      const validation = validateSettlement(statement);
      expect(validation.ok).toBe(true);
    });
  });
});
