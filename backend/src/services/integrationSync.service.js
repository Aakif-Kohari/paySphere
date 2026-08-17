'use strict';

/**
 * Pulling employees in from an external HRMS (#954).
 *
 * `src/integrations/` has held a complete adapter layer since it was written —
 * an abstract `BaseIntegration`, a registry that validates adapters at
 * registration, and working BambooHR and Workday adapters — and nothing outside
 * that directory referred to any of it:
 *
 *     $ grep -rn "integrations/registry\|IntegrationConfig" src --include='*.js' \
 *         | grep -v "^src/integrations/"
 *     $
 *
 * So `IntegrationConfig` had no writer, `fetchEmployees()` had never run, and
 * the `lastSyncAt` / `lastSyncStatus` / `lastSyncError` fields an admin would
 * look at were permanently null. The base class's own docstring says adding a
 * provider needs "no changes to controllers, sync jobs, or any other file",
 * which was true because there were none.
 *
 * The decisions a sync has to make, and why they are made this way:
 *
 *   - **Match before insert.** PaySphere already has employees with the same
 *     email addresses. Inserting everything the adapter returns duplicates the
 *     workforce on the first run, and there is no undo for that.
 *   - **Never delete.** An employee in PaySphere that the HRMS does not know
 *     about is not proof they have left — the HRMS may cover one office, one
 *     country, or only salaried staff. Deleting on absence is the one mistake
 *     here that destroys payroll history.
 *   - **Partial success is a real outcome.** One malformed row must not discard
 *     the other four hundred, which is what `lastSyncStatus: 'partial'` is for.
 */

const IntegrationConfig = require('../models/integrationConfig.model');
const Employee = require('../models/employee.model');
const registry = require('../integrations/registry');
const { decrypt } = require('./encryption.service');
const logger = require('../utils/logger');

/** Fields a sync is allowed to write. Anything else the adapter sends is ignored. */
const SYNCABLE_FIELDS = ['fullName', 'email', 'department', 'dateOfJoining'];

/**
 * Turn the stored credentials blob back into something an adapter can use.
 *
 * Every value is stored encrypted (see `saveCredentials` in the controller), so
 * this decrypts each one. A value that is not encrypted — a subdomain, a URL —
 * comes back unchanged, because `decrypt` returns its input when it cannot
 * recognise the format.
 *
 * @param {object} credentials
 * @returns {object}
 */
function decryptCredentials(credentials = {}) {
  return Object.entries(credentials).reduce((acc, [key, value]) => {
    acc[key] = typeof value === 'string' ? decrypt(value) : value;
    return acc;
  }, {});
}

/**
 * Normalise one row from an adapter into the fields PaySphere stores.
 *
 * @param {object} row
 * @returns {{ok: true, employee: object} | {ok: false, reason: string}}
 */
function normalizeRow(row) {
  const email = String(row?.email || '')
    .trim()
    .toLowerCase();

  // Email is the join key when there is no external id on file yet, and it is
  // the field the employee record is unique on. A row without one cannot be
  // matched or safely inserted.
  if (!email) return { ok: false, reason: 'no email' };

  const fullName = String(row?.fullName || '').trim();
  if (!fullName) return { ok: false, reason: 'no name' };

  const employee = { email, fullName };

  if (row.department) employee.department = String(row.department).trim();
  if (row.dateOfJoining) {
    const joined = new Date(row.dateOfJoining);
    if (!Number.isNaN(joined.getTime())) employee.joiningDate = joined;
  }

  return {
    ok: true,
    employee,
    externalId: row.externalId ? String(row.externalId) : null,
  };
}

/**
 * Sync one tenant's configured provider.
 *
 * Never throws: it is called from a cron job and from a request handler that
 * has already answered, and a provider being unreachable is an outcome to
 * record rather than an exception to propagate.
 *
 * @param {object} config an IntegrationConfig document
 * @returns {Promise<{status: string, created: number, updated: number, skipped: object[], error: string|null}>}
 */
async function syncTenant(config) {
  const result = {
    status: 'failed',
    created: 0,
    updated: 0,
    skipped: [],
    error: null,
  };

  if (!config?.tenantId || !config?.provider) {
    result.error = 'Incomplete integration config';
    return result;
  }

  let rows;

  try {
    const adapter = registry.getAdapter(
      config.provider,
      decryptCredentials(config.credentials),
    );

    rows = await adapter.fetchEmployees();
  } catch (error) {
    result.error = error.message;
    await recordOutcome(config, result);
    return result;
  }

  // The adapters catch their own errors and return [] on failure, so an empty
  // response is indistinguishable from "this company has no employees". Treated
  // as a failure rather than as a successful sync of nothing: the alternative
  // is a green status on a run that fetched nothing at all.
  if (!Array.isArray(rows) || rows.length === 0) {
    result.error = 'The provider returned no employees';
    await recordOutcome(config, result);
    return result;
  }

  for (const row of rows) {
    const normalized = normalizeRow(row);

    if (!normalized.ok) {
      result.skipped.push({
        row: row?.externalId || row?.email || 'unknown',
        reason: normalized.reason,
      });
      continue;
    }

    try {
      const written = await upsertEmployee(config, normalized);
      if (written === 'created') result.created += 1;
      if (written === 'updated') result.updated += 1;
    } catch (error) {
      result.skipped.push({
        row: normalized.employee.email,
        reason: error.message,
      });
    }
  }

  result.status = result.skipped.length === 0 ? 'success' : 'partial';
  await recordOutcome(config, result);

  logger.info('HRMS sync finished', {
    tenantId: String(config.tenantId),
    provider: config.provider,
    ...result,
    skipped: result.skipped.length,
  });

  return result;
}

/**
 * Match an incoming row to an existing employee, or create one.
 *
 * Matched on the external id first and the email second. The external id is the
 * stronger key — it survives somebody changing their email address — but it
 * only exists on records a previous sync created, so the first run has to fall
 * back to email or it duplicates the entire workforce.
 *
 * @param {object} config
 * @param {{employee: object, externalId: string|null}} normalized
 * @returns {Promise<'created'|'updated'>}
 */
async function upsertEmployee(config, { employee, externalId }) {
  const tenantId = config.tenantId;

  const existing = externalId
    ? await Employee.findOne({
        tenantId,
        externalId,
        externalProvider: config.provider,
      })
    : null;

  const match =
    existing || (await Employee.findOne({ tenantId, email: employee.email }));

  if (match) {
    const update = {};

    for (const field of SYNCABLE_FIELDS) {
      const key = field === 'dateOfJoining' ? 'joiningDate' : field;
      if (employee[key] !== undefined) update[key] = employee[key];
    }

    if (externalId) {
      update.externalId = externalId;
      update.externalProvider = config.provider;
    }

    await Employee.updateOne({ _id: match._id, tenantId }, { $set: update });

    return 'updated';
  }

  // Salary is deliberately not set from the HRMS. What somebody is paid is a
  // decision that lives here, and a sync that could write it would let an
  // external system change payroll.
  await Employee.create({
    ...employee,
    tenantId,
    createdBy: config.createdBy || config.updatedBy,
    externalId: externalId || undefined,
    externalProvider: externalId ? config.provider : undefined,
    monthlySalary: 0,
  });

  return 'created';
}

/**
 * Write the run's outcome back onto the config.
 *
 * The three fields exist on the model and nothing had ever written them, so an
 * admin looking at whether their integration works had nothing to look at.
 *
 * @param {object} config
 * @param {object} result
 * @returns {Promise<void>}
 */
async function recordOutcome(config, result) {
  try {
    await IntegrationConfig.updateOne(
      { _id: config._id },
      {
        $set: {
          lastSyncAt: new Date(),
          lastSyncStatus: result.status,
          lastSyncError: result.error,
        },
      },
    );
  } catch (error) {
    // The sync itself succeeded or failed on its own terms; failing to record
    // that is a reporting problem, not a reason to retry the whole run.
    logger.error('Could not record the HRMS sync outcome', {
      configId: String(config._id),
      error: error.message,
    });
  }
}

/**
 * Sync every active integration in the system.
 *
 * Sequential rather than parallel: each tenant's run makes a series of writes
 * against the same collection, and a provider's rate limit is per account.
 *
 * @returns {Promise<{tenants: number, succeeded: number, failed: number}>}
 */
async function syncAllTenants() {
  const configs = await IntegrationConfig.find({ isActive: true }).lean();
  const summary = { tenants: configs.length, succeeded: 0, failed: 0 };

  for (const config of configs) {
    const result = await syncTenant(config);

    if (result.status === 'failed') summary.failed += 1;
    else summary.succeeded += 1;
  }

  return summary;
}

module.exports = {
  syncTenant,
  syncAllTenants,
  SYNCABLE_FIELDS,
  _internals: {
    normalizeRow,
    decryptCredentials,
    upsertEmployee,
    recordOutcome,
  },
};
