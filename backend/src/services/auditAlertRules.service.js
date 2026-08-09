/**
 * Audit Alert Rules Service
 *
 * Evaluates incoming audit events against active AlertRule documents stored
 * in MongoDB.  When a rule fires, an alert object is returned to the caller
 * (the audit stream socket) for broadcasting to connected clients.
 *
 * Rule types:
 *   - `threshold`: fires when a numeric field changes by >= N percent.
 *   - `action_match`: fires when the audit action equals a target value.
 *
 * Adding a new rule type requires only adding an entry to the EVALUATORS map.
 */
'use strict';

const logger = require('./logger');

const EVALUATORS = {
  /**
   * Fires when `payload.changes.<field>.after` differs from `before` by
   * at least `rule.thresholdPercent` percent.
   */
  threshold(rule, payload) {
    const changes = payload.changes || {};
    const before  = changes[rule.field]?.before;
    const after   = changes[rule.field]?.after;
    if (before == null || after == null || Number(before) === 0) return false;
    return Math.abs((Number(after) - Number(before)) / Number(before)) * 100 >= rule.thresholdPercent;
  },

  /**
   * Fires when `payload.action` exactly matches `rule.targetAction`.
   */
  action_match(rule, payload) {
    return payload.action === rule.targetAction;
  },
};

class AuditAlertRulesService {
  /**
   * Evaluate `payload` against all active rules.
   *
   * @param  {object}   payload  Audit event from EventBus.
   * @returns {Promise<object[]>} Array of fired alert objects (may be empty).
   */
  static async evaluate(payload) {
    try {
      const AlertRule = require('../models/alertRule.model');
      const rules     = await AlertRule.find({ isActive: true }).lean();

      const alerts = [];
      for (const rule of rules) {
        const evaluator = EVALUATORS[rule.type];
        if (!evaluator) continue;

        let fired = false;
        try { fired = evaluator(rule, payload); }
        catch (err) { logger.warn('Alert evaluator threw', { ruleId: rule._id, error: err.message }); }

        if (fired) {
          alerts.push({
            ruleId:   rule._id,
            ruleName: rule.name,
            severity: rule.severity || 'medium',
            message:  rule.message  || `Alert "${rule.name}" fired`,
            payload,
            firedAt:  new Date().toISOString(),
          });
        }
      }
      return alerts;
    } catch (err) {
      logger.error('AuditAlertRulesService.evaluate error', { error: err.message });
      return [];
    }
  }
}

module.exports = { AuditAlertRulesService };
