'use strict';
const mongoose = require('mongoose');
const PayrollReconciliation = require('../models/payrollReconciliation.model');
const logger = require('../utils/logger');

async function reconciliationGuard(req, res, next) {
  try {
    const payrollId = req.body.payrollId || req.body.payrollRunId;
    if (!payrollId) return next();

    const unreconciledAnomalies = await mongoose.model('Anomaly').find({
      payrollRunId: payrollId,
      severity: { $in: ['HIGH', 'CRITICAL'] },
      resolved: false,
    });

    if (unreconciledAnomalies.length > 0) {
      const reconciliations = await PayrollReconciliation.find({
        payrollId,
        status: 'reconciled',
      });

      const reconciledTypes = new Set(reconciliations.map(r => r.anomalyType));
      
      // Check if there are active anomalies not covered by overrides
      const activeUnreconciled = unreconciledAnomalies.filter(a => !reconciledTypes.has(a.severity));

      if (activeUnreconciled.length > 0) {
        return res.status(422).json({
          message: 'Cannot finalize payroll. There are active critical/high anomalies that must be reconciled.',
          anomalies: activeUnreconciled,
        });
      }
    }
    next();
  } catch (err) {
    logger.error('reconciliationGuard error', { error: err.message });
    next();
  }
}

module.exports = reconciliationGuard;