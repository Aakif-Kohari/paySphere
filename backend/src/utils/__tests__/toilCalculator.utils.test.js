'use strict';

const {
  isWeekend,
  convertExpiredToilToOvertime,
  evaluateUpcomingToilExpirations,
} = require('../toilCalculator.utils');

describe('TOIL Calculator & Overtime Conversion Engine', () => {
  describe('isWeekend', () => {
    it('identifies Saturdays and Sundays correctly', () => {
      expect(isWeekend('2026-08-22')).toBe(true); // Saturday
      expect(isWeekend('2026-08-23')).toBe(true); // Sunday
      expect(isWeekend('2026-08-24')).toBe(false); // Monday
    });
  });

  describe('convertExpiredToilToOvertime', () => {
    it('converts expired TOIL days to overtime compensation amount with 1.5x multiplier', () => {
      const expiredEntries = [
        { employeeId: 'emp-1', days: 2, monthlySalary: 30000 }, // daily rate: 1000 * 2 * 1.5 = 3000
        { employeeId: 'emp-2', days: 1, monthlySalary: 60000 }, // daily rate: 2000 * 1 * 1.5 = 3000
      ];

      const result = convertExpiredToilToOvertime(expiredEntries, {}, 1.5);
      expect(result.totalEntries).toBe(2);
      expect(result.totalDays).toBe(3);
      expect(result.totalCompensation).toBe(6000);
      expect(result.payrollLines).toHaveLength(2);
      expect(result.payrollLines[0].amount).toBe(3000);
      expect(result.payrollLines[0].isTaxable).toBe(true);
    });
  });

  describe('evaluateUpcomingToilExpirations', () => {
    it('filters ledger entries expiring within the window', () => {
      const asOf = new Date('2026-08-19');
      const ledgerEntries = [
        {
          employeeId: 'emp-1',
          days: 1,
          transactionType: 'Accrual',
          expiresAt: new Date('2026-08-25'), // in 6 days (within 30 days)
        },
        {
          employeeId: 'emp-2',
          days: 2,
          transactionType: 'Accrual',
          expiresAt: new Date('2026-10-15'), // in ~60 days (outside 30 days)
        },
        {
          employeeId: 'emp-3',
          days: 1,
          transactionType: 'Usage',
          expiresAt: new Date('2026-08-25'), // not an accrual
        },
      ];

      const upcoming = evaluateUpcomingToilExpirations(ledgerEntries, asOf, 30);
      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].employeeId).toBe('emp-1');
    });
  });
});
