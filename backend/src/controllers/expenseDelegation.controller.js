/**
 * @fileoverview Expense Approval Delegation & SLA Escalation Controller
 * @description Manages proxy delegation rules, active delegations list, and automated claim escalation sweeps.
 * Issue: #1573
 */

const {
  resolveEffectiveApprover,
  evaluateExpenseSlaEscalation,
  validateDelegationPeriod,
} = require('../utils/expenseDelegationEngine.utils');
const logger = require('../utils/logger');

// In-memory or database-backed delegation store
const delegationRules = new Map();
const pendingExpenseClaims = new Map();

/**
 * POST /api/expense-delegation/delegate
 * Creates or updates an out-of-office approval delegation.
 */
async function createDelegation(req, res, next) {
  try {
    const { delegatorId, delegateeId, startDate, endDate, reason } = req.body;

    if (!delegatorId || !delegateeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'delegatorId, delegateeId, startDate, and endDate are required',
      });
    }

    if (String(delegatorId) === String(delegateeId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delegate approval authority to yourself',
      });
    }

    const validation = validateDelegationPeriod(startDate, endDate);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const delegationId = `DEL-${Date.now()}`;
    const record = {
      id: delegationId,
      delegatorId: String(delegatorId),
      delegateeId: String(delegateeId),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      reason: reason || 'Temporary Out-of-Office Delegation',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    delegationRules.set(delegationId, record);

    return res.status(201).json({
      success: true,
      message: 'Approval delegation registered successfully',
      data: record,
    });
  } catch (error) {
    logger.error('Error creating approval delegation:', error);
    return next(error);
  }
}

/**
 * GET /api/expense-delegation/active
 * Lists active delegation rules.
 */
async function getActiveDelegations(req, res, next) {
  try {
    const now = Date.now();
    const active = [];

    for (const rule of delegationRules.values()) {
      const start = new Date(rule.startDate).getTime();
      const end = new Date(rule.endDate).getTime();
      if (rule.isActive && now >= start && now <= end) {
        active.push(rule);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        activeCount: active.length,
        delegations: active,
      },
    });
  } catch (error) {
    logger.error('Error fetching active delegations:', error);
    return next(error);
  }
}

/**
 * POST /api/expense-delegation/process-escalations
 * Runs an SLA audit sweep and escalates overdue expense claims.
 */
async function processEscalations(req, res, next) {
  try {
    const { slaHours = 72, claims = [] } = req.body;

    const evaluationList = claims.length > 0
      ? claims
      : Array.from(pendingExpenseClaims.values());

    const escalatedClaims = [];
    const hierarchyMap = {
      MGR_001: 'DIR_FINANCE_01',
      MGR_002: 'VP_OPERATIONS_01',
      DIR_FINANCE_01: 'CFO_GLOBAL',
    };

    for (const claim of evaluationList) {
      const result = evaluateExpenseSlaEscalation(claim, new Date(), Number(slaHours), hierarchyMap);
      if (result.shouldEscalate) {
        escalatedClaims.push({
          claimId: claim.id || claim._id,
          ...result,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Evaluated ${evaluationList.length} claims. Escalated ${escalatedClaims.length} overdue vouchers.`,
      data: {
        totalEvaluated: evaluationList.length,
        totalEscalated: escalatedClaims.length,
        escalations: escalatedClaims,
      },
    });
  } catch (error) {
    logger.error('Error processing expense escalations:', error);
    return next(error);
  }
}

module.exports = {
  createDelegation,
  getActiveDelegations,
  processEscalations,
  delegationRules,
  pendingExpenseClaims,
};
