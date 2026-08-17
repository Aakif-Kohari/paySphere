'use strict';

const {
  INTEREST_METHOD,
  LOAN_STATUS,
  validateLoanInput,
  computeInstallmentAmount,
  buildAmortizationSchedule,
  computeOutstanding,
  applyRepayment,
} = require('../loanSchedule');

describe('Employee Loan Amortization Schedule Engine', () => {
  describe('validateLoanInput', () => {
    it('should validate valid loan inputs correctly', () => {
      const result = validateLoanInput({
        principal: 100000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.REDUCING,
        interestRatePercent: 10,
        startMonth: 1,
        startYear: 2026,
      });

      expect(result.ok).toBe(true);
      expect(result.value.principal).toBe(100000);
    });

    it('should reject negative principal or invalid tenure', () => {
      const result = validateLoanInput({
        principal: -500,
        tenureMonths: 0,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('computeInstallmentAmount', () => {
    it('should compute zero-interest linear instalment', () => {
      const emi = computeInstallmentAmount({
        principal: 120000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.NONE,
      });

      expect(emi).toBe(10000);
    });

    it('should compute flat rate interest instalment', () => {
      const emi = computeInstallmentAmount({
        principal: 100000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.FLAT,
        interestRatePercent: 12,
      });

      expect(emi).toBe(9333.33); // (100000 + 12000) / 12
    });

    it('should compute standard reducing balance EMI formula', () => {
      const emi = computeInstallmentAmount({
        principal: 100000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.REDUCING,
        interestRatePercent: 12,
      });

      expect(emi).toBe(8884.88);
    });
  });

  describe('buildAmortizationSchedule', () => {
    it('should generate complete 12-month amortization schedule with zero closing balance', () => {
      const result = buildAmortizationSchedule({
        principal: 100000,
        tenureMonths: 12,
        interestMethod: INTEREST_METHOD.REDUCING,
        interestRatePercent: 10,
        startMonth: 1,
        startYear: 2026,
      });

      expect(result.ok).toBe(true);
      expect(result.schedule.length).toBe(12);
      expect(result.schedule[11].closingBalance).toBe(0);
    });
  });

  describe('computeOutstanding & applyRepayment', () => {
    it('should apply repayments and calculate remaining balance', () => {
      const scheduleResult = buildAmortizationSchedule({
        principal: 50000,
        tenureMonths: 5,
        interestMethod: INTEREST_METHOD.NONE,
        startMonth: 1,
        startYear: 2026,
      });

      const updated = applyRepayment(
        { schedule: scheduleResult.schedule, status: LOAN_STATUS.ACTIVE },
        1,
        2026,
        10000
      );

      expect(updated.schedule[0].paid).toBe(true);
      expect(updated.schedule[0].amountPaid).toBe(10000);
    });
  });
});
