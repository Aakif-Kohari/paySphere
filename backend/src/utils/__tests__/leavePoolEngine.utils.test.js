const {
  validateLeaveDonation,
  evaluateReliefGrant,
  calculatePoolMetrics,
  STATUTORY_MINIMUM_RETAINED_DAYS,
  MAX_ANNUAL_DONATION_DAYS,
} = require('../leavePoolEngine.utils');

describe('leavePoolEngine.utils - Leave Donation & Emergency Bank Engine', () => {
  describe('validateLeaveDonation', () => {
    it('approves donation when employee retains required statutory minimum balance', () => {
      const balance = 24; // 24 days
      const daysToDonate = 5;
      const result = validateLeaveDonation(balance, daysToDonate, 0, STATUTORY_MINIMUM_RETAINED_DAYS);

      expect(result.isEligible).toBe(true);
      expect(result.transferableDays).toBe(5);
      expect(result.remainingBalance).toBe(19);
      expect(result.rejectionReason).toBeNull();
    });

    it('rejects donation if employee would breach statutory floor of 12 days', () => {
      const balance = 14;
      const daysToDonate = 5; // Surplus is only 14 - 12 = 2 days
      const result = validateLeaveDonation(balance, daysToDonate, 0, STATUTORY_MINIMUM_RETAINED_DAYS);

      expect(result.isEligible).toBe(true);
      expect(result.transferableDays).toBe(2); // Capped at surplus 2
      expect(result.remainingBalance).toBe(12);
    });

    it('rejects completely if employee has <= 12 days balance', () => {
      const balance = 10;
      const daysToDonate = 2;
      const result = validateLeaveDonation(balance, daysToDonate, 0, STATUTORY_MINIMUM_RETAINED_DAYS);

      expect(result.isEligible).toBe(false);
      expect(result.transferableDays).toBe(0);
      expect(result.rejectionReason).toContain('Statutory compliance requires retaining at least 12 leave days');
    });

    it('caps donations at annual limit of 10 days', () => {
      const balance = 35;
      const daysToDonate = 8;
      const ytdDonated = 6; // Only 4 days left under 10-day cap
      const result = validateLeaveDonation(balance, daysToDonate, ytdDonated, STATUTORY_MINIMUM_RETAINED_DAYS);

      expect(result.transferableDays).toBe(4);
    });
  });

  describe('evaluateReliefGrant', () => {
    it('allocates requested relief days within pool balance', () => {
      const requested = 10;
      const poolBalance = 25;
      const result = evaluateReliefGrant(requested, poolBalance, 30);

      expect(result.canGrant).toBe(true);
      expect(result.approvedDays).toBe(10);
      expect(result.remainingPoolDays).toBe(15);
    });

    it('caps grant at remaining pool balance if requested exceeds pool', () => {
      const requested = 20;
      const poolBalance = 8;
      const result = evaluateReliefGrant(requested, poolBalance, 30);

      expect(result.canGrant).toBe(true);
      expect(result.approvedDays).toBe(8);
      expect(result.remainingPoolDays).toBe(0);
    });

    it('rejects relief grant if pool is completely exhausted', () => {
      const result = evaluateReliefGrant(5, 0, 30);

      expect(result.canGrant).toBe(false);
      expect(result.rejectionReason).toContain('Emergency leave pool balance is exhausted');
    });
  });

  describe('calculatePoolMetrics', () => {
    it('computes net available days and unique donor counts', () => {
      const donations = [
        { donorId: 'D1', days: 5, status: 'APPROVED' },
        { donorId: 'D2', days: 10, status: 'APPROVED' },
        { donorId: 'D1', days: 3, status: 'APPROVED' },
      ];
      const grants = [
        { beneficiaryId: 'B1', days: 6, status: 'APPROVED' },
      ];

      const metrics = calculatePoolMetrics(donations, grants);

      expect(metrics.totalDonatedDays).toBe(18);
      expect(metrics.totalGrantedDays).toBe(6);
      expect(metrics.netAvailableDays).toBe(12);
      expect(metrics.activeDonorCount).toBe(2); // D1, D2
      expect(metrics.beneficiaryCount).toBe(1);
    });
  });
});
