/**
 * AlertRule Model
 *
 * Configurable compliance alert rules evaluated by AuditAlertRulesService
 * against every incoming audit event.
 *
 * Example rule:
 *   {
 *     name: "Large salary change",
 *     type: "threshold",
 *     field: "monthlySalary",
 *     thresholdPercent: 30,
 *     severity: "high",
 *     message: "Salary changed by more than 30% — review required"
 *   }
 */
'use strict';

const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    description:      { type: String, default: '' },
    type:             { type: String, enum: ['threshold', 'action_match'], required: true },
    /** For `threshold` rules: the audit changes field to watch. */
    field:            { type: String, default: null },
    /** For `threshold` rules: minimum absolute percentage change to fire. */
    thresholdPercent: { type: Number, default: null },
    /** For `action_match` rules: the exact action string to match. */
    targetAction:     { type: String, default: null },
    severity:         { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    message:          { type: String, default: null },
    isActive:         { type: Boolean, default: true },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('AlertRule', alertRuleSchema);
