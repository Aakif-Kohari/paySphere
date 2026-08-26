const {
  resolveEffectiveApprover,
  evaluateExpenseSlaEscalation,
  validateDelegationPeriod,
  DEFAULT_SLA_HOURS,
} = require('../expenseDelegationEngine.utils');

describe('expenseDelegationEngine.utils - Expense Delegation & SLA Escalation', () => {
  describe('resolveEffectiveApprover', () => {
    const delegations = [
      {
        delegatorId: 'MGR_ALICE',
        delegateeId: 'MGR_BOB',
        startDate: '2026-08-20T00:00:00Z',
        endDate: '2026-08-30T23:59:59Z',
        isActive: true,
        reason: 'Annual Vacation',
      },
    ];

    it('routes approval to delegatee when within active delegation window', () => {
      const now = '2026-08-23T12:00:00Z';
      const result = resolveEffectiveApprover('MGR_ALICE', delegations, now);

      expect(result.isDelegated).toBe(true);
      expect(result.effectiveApproverId).toBe('MGR_BOB');
      expect(result.delegationReason).toBe('Annual Vacation');
    });

    it('routes approval to original approver when outside delegation window', () => {
      const past = '2026-08-15T12:00:00Z';
      const result = resolveEffectiveApprover('MGR_ALICE', delegations, past);

      expect(result.isDelegated).toBe(false);
      expect(result.effectiveApproverId).toBe('MGR_ALICE');
    });

    it('returns original approver if no delegation rule configured', () => {
      const result = resolveEffectiveApprover('MGR_CHARLIE', delegations);

      expect(result.isDelegated).toBe(false);
      expect(result.effectiveApproverId).toBe('MGR_CHARLIE');
    });
  });

  describe('evaluateExpenseSlaEscalation', () => {
    const hierarchy = {
      MGR_001: 'DIR_FINANCE',
    };

    it('triggers escalation when claim is pending past SLA threshold', () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const claim = {
        id: 'CLM-901',
        submittedAt: fourDaysAgo,
        status: 'PENDING',
        currentApproverId: 'MGR_001',
        isEscalated: false,
      };

      const result = evaluateExpenseSlaEscalation(claim, new Date(), 72, hierarchy);

      expect(result.shouldEscalate).toBe(true);
      expect(result.isOverdue).toBe(true);
      expect(result.escalatedApproverId).toBe('DIR_FINANCE');
      expect(result.escalationAudit.claimId).toBe('CLM-901');
    });

    it('does not escalate when claim is within SLA window', () => {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      const claim = {
        id: 'CLM-902',
        submittedAt: tenHoursAgo,
        status: 'PENDING',
        currentApproverId: 'MGR_001',
      };

      const result = evaluateExpenseSlaEscalation(claim, new Date(), 72, hierarchy);

      expect(result.shouldEscalate).toBe(false);
      expect(result.isOverdue).toBe(false);
    });

    it('ignores non-pending approved/rejected claims', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const claim = {
        id: 'CLM-903',
        submittedAt: tenDaysAgo,
        status: 'APPROVED',
        currentApproverId: 'MGR_001',
      };

      const result = evaluateExpenseSlaEscalation(claim, new Date(), 72, hierarchy);
      expect(result.shouldEscalate).toBe(false);
    });
  });

  describe('validateDelegationPeriod', () => {
    it('validates start and end timestamps', () => {
      const valid = validateDelegationPeriod('2026-09-01', '2026-09-10');
      expect(valid.valid).toBe(true);

      const invalidOrder = validateDelegationPeriod('2026-09-10', '2026-09-01');
      expect(invalidOrder.valid).toBe(false);

      const invalidDate = validateDelegationPeriod('invalid-date', '2026-09-10');
      expect(invalidDate.valid).toBe(false);
    });
  });
});
