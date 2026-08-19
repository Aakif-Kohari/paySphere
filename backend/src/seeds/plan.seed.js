/**
 * Plan Seed - Issue #1113
 *
 * Creates Basic, Pro, Enterprise plans.
 * Idempotent - safe to run multiple times.
 */
'use strict';

const Plan   = require('../models/plan.model');
const logger = require('../utils/logger');

const DEFAULT_PLANS = [
  {
    name: 'Basic',
    slug: 'basic',
    features: ['PAYROLL', 'EMPLOYEES', 'REPORTS_BASIC'],
    limits: { employeeCount: 25, reportSchedules: 2 },
  },
  {
    name: 'Pro',
    slug: 'pro',
    features: ['PAYROLL', 'EMPLOYEES', 'REPORTS_BASIC', 'VARIANCE_REPORT', 'BULK_IMPORT', 'LOAN_MANAGEMENT'],
    limits: { employeeCount: 200, reportSchedules: 10 },
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    features: ['PAYROLL', 'EMPLOYEES', 'REPORTS_BASIC', 'VARIANCE_REPORT', 'BULK_IMPORT', 'LOAN_MANAGEMENT', 'EMPLOYEE_SELF_SERVICE', 'FORMULA_ENGINE', 'AUDIT_EXPORT'],
    limits: { employeeCount: 9999, reportSchedules: 50 },
  },
];

async function seedPlans() {
  let created = 0;
  for (const plan of DEFAULT_PLANS) {
    const exists = await Plan.findOne({ slug: plan.slug });
    if (!exists) { await Plan.create(plan); created++; }
  }
  if (created > 0) logger.info('Plan seed: created default plans', { count: created });
}

module.exports = { seedPlans };