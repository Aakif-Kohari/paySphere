'use strict';
const Policy = require('../models/policy.model');
const Tenant = require('../models/tenant.model');
const logger = require('../utils/logger');

const BUILT_IN_POLICIES = [
  {
    name: 'manager-department-scope',
    description: 'Managers read only employees in their own department.',
    resource: 'Employee', action: 'read', roles: ['manager'],
    condition: { field: 'department', op: 'eq', value: '{{user.department}}' },
    effect: 'allow',
  },
  {
    name: 'employee-self-scope',
    description: 'Employees read only their own record.',
    resource: 'Employee', action: 'read', roles: ['employee'],
    condition: { field: 'createdBy', op: 'createdBy', value: '{{user._id}}' },
    effect: 'allow',
  },
];

async function seedPolicies() {
  try {
    const tenants = await Tenant.find().lean();
    let created = 0;
    for (const tenant of tenants) {
      for (const tmpl of BUILT_IN_POLICIES) {
        const exists = await Policy.findOne({ tenantId: tenant._id, name: tmpl.name });
        if (!exists) { await Policy.create({ ...tmpl, tenantId: tenant._id }); created++; }
      }
    }
    if (created > 0) logger.info('Policy seed: created built-in policies', { count: created });
  } catch (err) {
    logger.error('Policy seed failed', { error: err.message });
  }
}
module.exports = { seedPolicies };