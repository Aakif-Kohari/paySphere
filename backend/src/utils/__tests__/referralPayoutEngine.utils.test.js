'use strict';

const {
  evaluateReferralMilestoneVesting,
  generateReferralPayrollLineItems,
} = require('../referralPayoutEngine.utils');

describe('Employee Referral Multi-Milestone Vesting Engine', () => {
  const program = {
    bountyAmount: 50000,
    milestoneSplits: [
      { label: 'Joining Bonus', percentage: 50, trigger: 'HIRED' },
      { label: 'Probation Completion Bonus', percentage: 50, trigger: 'PROBATION_COMPLETE' },
    ],
  };

  describe('evaluateReferralMilestoneVesting', () => {
    it('vests joining tranche immediately when candidate is hired', () => {
      const candidate = {
        status: 'Hired',
        isActive: true,
        probationEndDate: new Date('2026-11-19'), // future date
      };

      const result = evaluateReferralMilestoneVesting(candidate, program, '2026-08-19');
      expect(result.totalBounty).toBe(50000);
      expect(result.vestedAmount).toBe(25000); // 50%
      expect(result.pendingAmount).toBe(25000);
      expect(result.forfeitedAmount).toBe(0);
      expect(result.milestones[0].status).toBe('Vested');
      expect(result.milestones[1].status).toBe('Pending');
    });

    it('vests full bounty after candidate completes probation period', () => {
      const candidate = {
        status: 'Hired',
        isActive: true,
        probationEndDate: new Date('2026-07-01'), // past date
      };

      const result = evaluateReferralMilestoneVesting(candidate, program, '2026-08-19');
      expect(result.vestedAmount).toBe(50000); // 100%
      expect(result.pendingAmount).toBe(0);
      expect(result.forfeitedAmount).toBe(0);
    });

    it('forfeits pending milestone when candidate leaves company prematurely', () => {
      const candidate = {
        status: 'Hired',
        isActive: false, // exited
        probationEndDate: new Date('2026-11-19'),
      };

      const result = evaluateReferralMilestoneVesting(candidate, program, '2026-08-19');
      expect(result.forfeitedAmount).toBe(50000);
      expect(result.vestedAmount).toBe(0);
      expect(result.milestones[0].status).toBe('Forfeited');
    });
  });

  describe('generateReferralPayrollLineItems', () => {
    it('creates taxable payroll addition line items for approved payouts', () => {
      const payouts = [
        {
          referrerId: 'emp-1',
          candidateId: 'cand-1',
          milestoneLabel: 'Joining Bonus',
          amount: 25000,
          status: 'Approved',
        },
        {
          referrerId: 'emp-2',
          candidateId: 'cand-2',
          milestoneLabel: 'Probation Bonus',
          amount: 25000,
          status: 'Pending', // not approved yet
        },
      ];

      const lines = generateReferralPayrollLineItems(payouts);
      expect(lines).toHaveLength(1);
      expect(lines[0].employeeId).toBe('emp-1');
      expect(lines[0].component).toBe('Referral Bonus');
      expect(lines[0].amount).toBe(25000);
      expect(lines[0].isTaxable).toBe(true);
    });
  });
});
