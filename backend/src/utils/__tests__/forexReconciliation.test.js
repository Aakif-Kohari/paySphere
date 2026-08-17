'use strict';

const {
  calculateRealizedGainLoss,
  calculateUnrealizedGainLoss,
  calculateAgingBuckets,
  calculateOverdueInterest,
  getDunningStage,
} = require('../forexReconciliation');

describe('Forex Reconciliation & AR Aging Engine', () => {
  describe('calculateRealizedGainLoss', () => {
    it('calculates realized forex gain correctly', () => {
      const result = calculateRealizedGainLoss(85000, 83500, 500);
      expect(result.netInr).toBe(84500);
      expect(result.realizedGainLoss).toBe(1000);
    });

    it('calculates realized forex loss correctly', () => {
      const result = calculateRealizedGainLoss(82000, 83500, 200);
      expect(result.netInr).toBe(81800);
      expect(result.realizedGainLoss).toBe(-1700);
    });
  });

  describe('calculateUnrealizedGainLoss', () => {
    it('computes year-end unrealized revaluation', () => {
      const loss = calculateUnrealizedGainLoss(1000, 84.0, 82.5);
      expect(loss).toBe(-1500);

      const gain = calculateUnrealizedGainLoss(1000, 82.0, 83.5);
      expect(gain).toBe(1500);
    });
  });

  describe('calculateAgingBuckets', () => {
    it('buckets invoices accurately into 0-30, 31-60, 61-90, 90+ buckets', () => {
      const now = new Date('2026-08-14T00:00:00Z');
      const invoices = [
        {
          _id: 'inv1',
          invoiceNumber: 'INV-001',
          invoiceDate: new Date('2026-08-01T00:00:00Z'), // ~13 days -> current
          inrEquivalent: 10000,
          amountReceivedINR: 0,
        },
        {
          _id: 'inv2',
          invoiceNumber: 'INV-002',
          invoiceDate: new Date('2026-07-01T00:00:00Z'), // ~44 days -> 31-60
          inrEquivalent: 20000,
          amountReceivedINR: 5000, // open: 15000
        },
        {
          _id: 'inv3',
          invoiceNumber: 'INV-003',
          invoiceDate: new Date('2026-05-20T00:00:00Z'), // ~86 days -> 61-90
          inrEquivalent: 30000,
          amountReceivedINR: 0,
        },
        {
          _id: 'inv4',
          invoiceNumber: 'INV-004',
          invoiceDate: new Date('2026-04-01T00:00:00Z'), // ~135 days -> >90
          inrEquivalent: 50000,
          amountReceivedINR: 0,
        },
      ];

      const report = calculateAgingBuckets(invoices, now);

      expect(report.totalOutstanding).toBe(105000);
      expect(report.buckets.current.count).toBe(1);
      expect(report.buckets.current.totalAmount).toBe(10000);
      expect(report.buckets.days31to60.count).toBe(1);
      expect(report.buckets.days31to60.totalAmount).toBe(15000);
      expect(report.buckets.days61to90.count).toBe(1);
      expect(report.buckets.days61to90.totalAmount).toBe(30000);
      expect(report.buckets.daysOver90.count).toBe(1);
      expect(report.buckets.daysOver90.totalAmount).toBe(50000);
    });
  });

  describe('calculateOverdueInterest & getDunningStage', () => {
    it('calculates overdue penalty interest correctly', () => {
      const interest = calculateOverdueInterest(100000, 30, 18);
      // 100000 * 0.18 * 30 / 365 = 1479.45
      expect(interest).toBe(1479.45);
    });

    it('returns appropriate dunning stage string', () => {
      expect(getDunningStage(15)).toBe('CURRENT');
      expect(getDunningStage(45)).toBe('REMINDER');
      expect(getDunningStage(75)).toBe('WARNING');
      expect(getDunningStage(110)).toBe('FINAL_NOTICE');
      expect(getDunningStage(150)).toBe('DEFAULTED');
    });
  });
});
