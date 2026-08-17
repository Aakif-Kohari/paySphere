'use strict';

const {
  calculateDurationMinutes,
  calculateBillableAmount,
  aggregateTimesheetsForBilling,
  detectIdleOrFraud,
  buildInvoicePayloadFromTimesheets,
} = require('../timesheetAggregator');

describe('Timesheet Aggregator & Billing Engine', () => {
  describe('calculateDurationMinutes & calculateBillableAmount', () => {
    it('calculates duration in minutes accurately', () => {
      const start = new Date('2026-08-17T09:00:00Z');
      const end = new Date('2026-08-17T17:30:00Z'); // 8.5 hours = 510 mins
      expect(calculateDurationMinutes(start, end)).toBe(510);
    });

    it('calculates billable amount accurately with rounding', () => {
      const amount = calculateBillableAmount(90, 50); // 1.5 hrs * $50 = $75
      expect(amount).toBe(75);
    });
  });

  describe('aggregateTimesheetsForBilling', () => {
    it('aggregates entries without overtime when under threshold', () => {
      const entries = [
        { _id: 'e1', durationMinutes: 120, hourlyRate: 50, billableAmount: 100 },
        { _id: 'e2', durationMinutes: 180, hourlyRate: 50, billableAmount: 150 },
      ];

      const result = aggregateTimesheetsForBilling(entries, { weeklyOvertimeThresholdHours: 40 });
      expect(result.totalHours).toBe(5);
      expect(result.standardHours).toBe(5);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalAmount).toBe(250);
    });

    it('applies 1.5x overtime multiplier when exceeding threshold hours', () => {
      const entries = [
        { _id: 'e1', durationMinutes: 2400, hourlyRate: 100 }, // 40 hrs -> $4000
        { _id: 'e2', durationMinutes: 600, hourlyRate: 100 },  // 10 hrs OT -> 10 * 100 * 1.5 = $1500
      ];

      const result = aggregateTimesheetsForBilling(entries, { weeklyOvertimeThresholdHours: 40, overtimeMultiplier: 1.5 });
      expect(result.totalHours).toBe(50);
      expect(result.standardHours).toBe(40);
      expect(result.overtimeHours).toBe(10);
      expect(result.standardAmount).toBe(4000);
      expect(result.overtimeAmount).toBe(1500);
      expect(result.totalAmount).toBe(5500);
    });
  });

  describe('detectIdleOrFraud', () => {
    it('flags entries that exceed continuous working limit', () => {
      const result = detectIdleOrFraud(400, 360);
      expect(result.isFlagged).toBe(true);
      expect(result.reason).toContain('exceeded');
    });

    it('flags suspiciously short durations', () => {
      const result = detectIdleOrFraud(1);
      expect(result.isFlagged).toBe(true);
      expect(result.reason).toContain('too short');
    });

    it('clears normal duration entries', () => {
      const result = detectIdleOrFraud(120);
      expect(result.isFlagged).toBe(false);
    });
  });

  describe('buildInvoicePayloadFromTimesheets', () => {
    it('builds formatted client invoice payload', () => {
      const entries = [
        { _id: 'e1', durationMinutes: 120, hourlyRate: 50, billableAmount: 100 },
      ];
      const client = { _id: 'c1', defaultCurrency: 'USD' };

      const payload = buildInvoicePayloadFromTimesheets(entries, client, 'INV-101');
      expect(payload.invoiceNumber).toBe('INV-101');
      expect(payload.clientId).toBe('c1');
      expect(payload.foreignAmount).toBe(100);
      expect(payload.foreignCurrency).toBe('USD');
      expect(payload.billingSummary.totalHours).toBe(2);
    });
  });
});
