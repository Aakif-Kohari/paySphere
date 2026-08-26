/**
 * Approval Escalation Job - Issue #1247
 *
 * BullMQ repeatable job that runs every 15 minutes. Finds payroll
 * approval instances that have been sitting at a stage past their
 * escalationDeadlineAt and auto-escalates them.
 *
 * Registered in cron.jobs.js as a repeatable job.
 */
'use strict';

const approvalService = require('../services/payrollApproval.service');
const logger = require('../utils/logger');

const JOB_NAME = 'payroll-approval-escalation';
const EVERY_15_MINUTES = '*/15 * * * *';

/**
 * The job processor. Called by BullMQ on each tick.
 */
async function processEscalation() {
  logger.info('Running payroll approval escalation check...');

  try {
    const escalated = await approvalService.escalateStaleApprovals();

    if (escalated.length > 0) {
      logger.info(`Escalated ${escalated.length} stale payroll approval(s).`);
    } else {
      logger.info('No stale approvals to escalate.');
    }

    return { escalated: escalated.length };
  } catch (err) {
    logger.error('Escalation job failed', { error: err.message });
    throw err;
  }
}

module.exports = {
  JOB_NAME,
  EVERY_15_MINUTES,
  processEscalation,
};
