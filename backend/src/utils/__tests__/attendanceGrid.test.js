'use strict';

const {
  computeShiftOvertimeMultiplier,
  parseBiometricLogs,
  validateGrid,
  computeTotals,
  derivePayrollInputs,
} = require('../attendanceGrid');

describe('Biometric Attendance & Shift Overtime Engine', () => {
  describe('computeShiftOvertimeMultiplier', () => {
    it('should apply 1.0x for standard day shift overtime', () => {
      const hours = computeShiftOvertimeMultiplier(2, 'DAY');
      expect(hours).toBe(2);
    });

    it('should apply 1.5x multiplier for night shift overtime', () => {
      const hours = computeShiftOvertimeMultiplier(2, 'NIGHT');
      expect(hours).toBe(3);
    });

    it('should apply 2.0x multiplier for weekend shift overtime', () => {
      const hours = computeShiftOvertimeMultiplier(2, 'DAY', true, false);
      expect(hours).toBe(4);
    });

    it('should apply 2.5x multiplier for public holiday overtime', () => {
      const hours = computeShiftOvertimeMultiplier(2, 'DAY', false, true);
      expect(hours).toBe(5);
    });
  });

  describe('parseBiometricLogs', () => {
    it('should convert biometric clock timestamps into daily attendance status', () => {
      const logs = [
        {
          date: '2026-08-01',
          clockIn: '2026-08-01T09:00:00Z',
          clockOut: '2026-08-01T19:00:00Z', // 10 hrs worked -> 2 hrs OT
          shiftType: 'DAY',
        },
      ];

      const grid = parseBiometricLogs(logs, 2026, 8);
      expect(grid.length).toBe(31);
      expect(grid[0].status).toBe('PRESENT');
      expect(grid[0].overtimeHours).toBe(2);
    });
  });

  describe('derivePayrollInputs', () => {
    it('should include weighted overtime hours in payroll inputs', () => {
      const days = [
        { day: 1, status: 'PRESENT', overtimeHours: 2, shiftType: 'NIGHT' },
      ];
      const inputs = derivePayrollInputs(days, 2026, 8);

      expect(inputs.overtimeHours).toBe(2);
      expect(inputs.weightedOvertimeHours).toBe(3); // 2 * 1.5
    });
  });
});
