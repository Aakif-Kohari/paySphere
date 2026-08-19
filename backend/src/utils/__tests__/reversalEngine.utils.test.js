'use strict';

const {
  calculateReversalDeltas,
  generateNegativeJournals,
  verifyDoubleEntryBalancing,
  computeForm24QTdsAdjustments,
  generateClawbackSchedule,
  validateReversal,
} = require('../reversalEngine.utils');

describe('Payroll Reversal & Statutory TDS Adjustment Engine', () => {
  describe('calculateReversalDeltas', () => {
    it('calculates financial deltas between paid and corrected amounts', () => {
      const original = { grossSalary: 100000, tds: 10000, employerPF: 12000, netSalary: 78000 };
      const corrected = { grossSalary: 80000, tds: 8000, employerPF: 9600, netSalary: 62400 };

      const deltas = calculateReversalDeltas(original, corrected);
      expect(deltas.grossOverpaid).toBe(20000);
      expect(deltas.taxOverpaid).toBe(2000);
      expect(deltas.statutoryOverpaid).toBe(2400);
      expect(deltas.netOverpaid).toBe(15600);
    });
  });

  describe('generateNegativeJournals & verifyDoubleEntryBalancing', () => {
    it('creates balanced negative journal voucher legs', () => {
      const deltas = {
        grossOverpaid: 20000,
        taxOverpaid: 4400,
        netOverpaid: 15600,
      };

      const journals = generateNegativeJournals(deltas);
      expect(journals).toHaveLength(3);

      const check = verifyDoubleEntryBalancing(journals);
      expect(check.isBalanced).toBe(true);
      expect(check.totalDebits).toBe(20000); // 4400 (TDS) + 15600 (Net)
      expect(check.totalCredits).toBe(20000); // 20000 (Gross Expense)
    });
  });

  describe('computeForm24QTdsAdjustments', () => {
    it('computes Section 192 quarterly TDS credit adjustment', () => {
      const deltas = { taxOverpaid: 3500 };
      const adj = computeForm24QTdsAdjustments(deltas, 'Q2', '2026-2027');

      expect(adj.quarter).toBe('Q2');
      expect(adj.financialYear).toBe('2026-2027');
      expect(adj.section).toBe('192');
      expect(adj.tdsCreditAdjustment).toBe(3500);
      expect(adj.requiresCorrectionReturn).toBe(true);
      expect(adj.adjustmentStatus).toBe('Pending Filing');
    });
  });

  describe('generateClawbackSchedule', () => {
    it('spreads net overpayment across recovery months with precision remainder', () => {
      const schedule = generateClawbackSchedule(10000, 3, 1, 2026);
      expect(schedule).toHaveLength(3);
      expect(schedule[0].deductionAmount).toBe(3333.33);
      expect(schedule[1].deductionAmount).toBe(3333.33);
      expect(schedule[2].deductionAmount).toBe(3333.34);

      const total = schedule.reduce((sum, s) => sum + s.deductionAmount, 0);
      expect(Math.round(total)).toBe(10000);
    });
  });

  describe('validateReversal', () => {
    it('rejects reversal if payroll is not paid or approved', () => {
      expect(validateReversal(null).isValid).toBe(false);
      expect(validateReversal({ status: 'draft' }).isValid).toBe(false);
      expect(validateReversal({ status: 'paid', isReversed: true }).isValid).toBe(false);
      expect(validateReversal({ status: 'paid', isReversed: false }).isValid).toBe(true);
    });
  });
});
