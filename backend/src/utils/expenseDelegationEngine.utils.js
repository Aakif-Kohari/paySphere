/**
 * @fileoverview Expense Approval Delegation & SLA Escalation Engine
 * @description Manages temporary out-of-office approver proxy assignments,
 * hierarchy escalation for overdue reimbursement claims, and delegation auditing.
 * Issue: #1573
 */

const DEFAULT_SLA_HOURS = 72; // 72 hours approval SLA

/**
 * Resolves the effective approver for an expense claim based on active delegation rules.
 *
 * @param {string} originalApproverId - ID of the assigned manager/approver
 * @param {Array<object>} activeDelegations - List of configured delegation rules
 * @param {Date|string} referenceTime - Reference timestamp (default current time)
 * @returns {{ effectiveApproverId: string, isDelegated: boolean, delegateId: string|null, reason: string }}
 */
function resolveEffectiveApprover(originalApproverId, activeDelegations = [], referenceTime = new Date()) {
  const checkTime = new Date(referenceTime).getTime();

  const matchingDelegation = activeDelegations.find((del) => {
    if (String(del.delegatorId) !== String(originalApproverId)) return false;
    if (!del.isActive) return false;

    const start = new Date(del.startDate).getTime();
    const end = new Date(del.endDate).getTime();
    return checkTime >= start && checkTime <= end;
  });

  if (matchingDelegation) {
    return {
      effectiveApproverId: String(matchingDelegation.delegateeId),
      isDelegated: true,
      delegateId: String(matchingDelegation.delegateeId),
      originalApproverId: String(originalApproverId),
      delegationReason: matchingDelegation.reason || 'Out of Office Delegation',
    };
  }

  return {
    effectiveApproverId: String(originalApproverId),
    isDelegated: false,
    delegateId: null,
    originalApproverId: String(originalApproverId),
    delegationReason: null,
  };
}

/**
 * Evaluates whether an expense claim has exceeded approval SLA and determines escalation path.
 *
 * @param {object} claim - Expense claim object { id, submittedAt, status, currentApproverId, amount }
 * @param {Date|string} currentTimestamp - Current evaluation timestamp
 * @param {number} slaHours - SLA threshold in hours
 * @param {object} hierarchyMap - Map of managerId -> skipLevelManagerId
 * @returns {{ shouldEscalate: boolean, hoursElapsed: number, isOverdue: boolean, escalatedApproverId: string|null, escalationAudit: object|null }}
 */
function evaluateExpenseSlaEscalation(claim, currentTimestamp = new Date(), slaHours = DEFAULT_SLA_HOURS, hierarchyMap = {}) {
  if (claim.status !== 'PENDING') {
    return {
      shouldEscalate: false,
      hoursElapsed: 0,
      isOverdue: false,
      escalatedApproverId: null,
      escalationAudit: null,
    };
  }

  const submittedTime = new Date(claim.submittedAt).getTime();
  const evalTime = new Date(currentTimestamp).getTime();
  const hoursElapsed = Math.max(0, (evalTime - submittedTime) / (1000 * 60 * 60));
  const isOverdue = hoursElapsed > slaHours;

  if (isOverdue && !claim.isEscalated) {
    const currentApprover = String(claim.currentApproverId);
    const escalatedApprover = hierarchyMap[currentApprover] || 'SUPER_ADMIN_ESCALATION';

    return {
      shouldEscalate: true,
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      isOverdue: true,
      escalatedApproverId: escalatedApprover,
      escalationAudit: {
        claimId: claim.id || claim._id,
        previousApproverId: currentApprover,
        newApproverId: escalatedApprover,
        escalatedAt: new Date(evalTime).toISOString(),
        hoursPending: Math.round(hoursElapsed * 10) / 10,
        reason: `Exceeded ${slaHours}h SLA threshold without manager action.`,
      },
    };
  }

  return {
    shouldEscalate: false,
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    isOverdue,
    escalatedApproverId: null,
    escalationAudit: null,
  };
}

/**
 * Validates a delegation date window.
 */
function validateDelegationPeriod(startDate, endDate) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  if (isNaN(start) || isNaN(end)) {
    return { valid: false, message: 'Invalid start or end date format' };
  }

  if (end <= start) {
    return { valid: false, message: 'Delegation end date must be strictly after start date' };
  }

  return { valid: true };
}

module.exports = {
  DEFAULT_SLA_HOURS,
  resolveEffectiveApprover,
  evaluateExpenseSlaEscalation,
  validateDelegationPeriod,
};
