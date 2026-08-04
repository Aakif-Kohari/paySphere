const mongoose = require('mongoose');
const User = require('../models/user.model');
const Tenant = require('../models/tenant.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const Loan = require('../models/loan.model');
const Settlement = require('../models/settlement.model');
const SalaryStructure = require('../models/salaryStructure.model');
const Attendance = require('../models/attendance.model');
const ReportSchedule = require('../models/reportSchedule.model');
const logger = require('../utils/logger');

/**
 * Migration for #612.
 *
 * `#585` added `tenantId` to seven collections and switched every controller
 * over to filtering on it, but shipped no migration — so every document written
 * before it has no tenant, and every document written after it belongs to a
 * tenant that was never created. The collection is in three states at once:
 *
 *   1. Owner accounts with no tenant at all.
 *   2. Employee-portal logins (#443) that need their *employer's* tenant, not
 *      one of their own.
 *   3. Business rows — employees, payroll runs, loans, settlements, salary
 *      structures, attendance grids, report schedules — carrying `createdBy`
 *      and nothing else.
 *
 * This walks all three. Ownership is derived from `createdBy`, which is the
 * field that actually identified the owner for the whole life of the product
 * before #585 renamed the concept.
 *
 * Same contract as the migrations already in the boot sequence
 * (backfillAccountType #558, backfillPayrollStatus #458,
 * backfillSalaryStructures #461): idempotent, a no-op on a clean database, and
 * it never throws. A failed backfill leaves accounts unscoped, and
 * utils/tenantScope.js then refuses their requests — the safe direction.
 */

/**
 * The collections that carry `tenantId` and are scoped by it.
 *
 * Required in explicitly rather than read off `mongoose.models`: this runs from
 * the boot sequence in index.js, before app.js has pulled the routers in, so
 * the registry is not guaranteed to be populated yet. Adding a scoped
 * collection later is a one-line change here.
 */
const SCOPED_MODELS = [
  ['Employee', Employee],
  ['PayrollUpdate', PayrollUpdate],
  ['Loan', Loan],
  ['Settlement', Settlement],
  ['SalaryStructure', SalaryStructure],
  ['Attendance', Attendance],
  ['ReportSchedule', ReportSchedule],
];

/** Matches a document that has no usable tenant. */
const NO_TENANT = { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] };

/**
 * Count what is unscoped, so the log line is informative on an already-migrated
 * database as well as a fresh one.
 *
 * @returns {Promise<{usersWithoutTenant: number, documentsWithoutTenant: object}>}
 */
async function surveyTenants() {
  const usersWithoutTenant = await User.countDocuments(NO_TENANT);

  const documentsWithoutTenant = {};
  for (const [name, model] of SCOPED_MODELS) {
    documentsWithoutTenant[name] = await model.countDocuments(NO_TENANT);
  }

  return { usersWithoutTenant, documentsWithoutTenant };
}

/**
 * Give every owner account a tenant.
 *
 * An owner is an account with no `employeeId` — the same test
 * `resolveAccountType` uses (#558). One tenant each, named from the company
 * name they registered with.
 *
 * `updateOne` with an `$setOnInsert` upsert on `ownerId` rather than
 * `Tenant.create`, so a half-finished previous run that made the tenant but did
 * not stamp the user is repaired rather than duplicated.
 *
 * @returns {Promise<{created: number, linked: number}>}
 */
async function provisionOwnerTenants() {
  const owners = await User.find({
    ...NO_TENANT,
    $and: [{ $or: [{ employeeId: { $exists: false } }, { employeeId: null }] }],
  })
    .select('_id companyName fullName')
    .lean();

  let created = 0;
  let linked = 0;

  for (const owner of owners) {
    const result = await Tenant.updateOne(
      { ownerId: owner._id },
      {
        $setOnInsert: {
          ownerId: owner._id,
          name: owner.companyName || owner.fullName || 'Unnamed company',
          isActive: true,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount) created += 1;

    const tenant = await Tenant.findOne({ ownerId: owner._id }).select('_id').lean();
    if (!tenant) continue;

    await User.updateOne({ _id: owner._id }, { $set: { tenantId: tenant._id } });
    linked += 1;
  }

  return { created, linked };
}

/**
 * Point employee-portal logins at their employer's tenant.
 *
 * Deliberately runs after `provisionOwnerTenants`, because it reads the tenant
 * off the employer account that step has just stamped. An employee whose
 * Employee row or employer account is gone is left alone and counted as
 * `orphaned` — guessing a tenant for them is how you leak a payslip into the
 * wrong company.
 *
 * @returns {Promise<{linked: number, orphaned: number}>}
 */
async function linkEmployeeAccounts() {
  const employeeLogins = await User.find({
    ...NO_TENANT,
    employeeId: { $exists: true, $ne: null },
  })
    .select('_id employeeId')
    .lean();

  let linked = 0;
  let orphaned = 0;

  for (const account of employeeLogins) {
    const employee = await Employee.findById(account.employeeId)
      .select('tenantId createdBy')
      .lean();

    let tenantId = employee?.tenantId || null;

    if (!tenantId && employee?.createdBy) {
      const employer = await User.findById(employee.createdBy)
        .select('tenantId')
        .lean();
      tenantId = employer?.tenantId || null;
    }

    if (!tenantId) {
      orphaned += 1;
      continue;
    }

    await User.updateOne({ _id: account._id }, { $set: { tenantId } });
    linked += 1;
  }

  return { linked, orphaned };
}

/**
 * Stamp `tenantId` onto the business rows, derived from their `createdBy` owner.
 *
 * One `updateMany` per owner rather than per document: a customer with 400
 * employees is one write, not 400.
 *
 * Rows whose `createdBy` points at an account that no longer exists are left
 * untouched and reported. They are unreachable either way — an unscoped row is
 * invisible to a scoped query — and inventing a tenant for them would make them
 * visible to *somebody*, which is worse than leaving them dark.
 *
 * @returns {Promise<{stamped: object, orphaned: object}>}
 */
async function stampScopedDocuments() {
  const owners = await User.find({ tenantId: { $exists: true, $ne: null } })
    .select('_id tenantId')
    .lean();

  const stamped = {};
  const orphaned = {};

  for (const [name, model] of SCOPED_MODELS) {
    let total = 0;

    for (const owner of owners) {
      const result = await model.updateMany(
        { ...NO_TENANT, createdBy: owner._id },
        { $set: { tenantId: owner.tenantId } },
      );

      total += result.modifiedCount || 0;
    }

    stamped[name] = total;
    orphaned[name] = await model.countDocuments(NO_TENANT);
  }

  return { stamped, orphaned };
}

/**
 * Run the migration.
 *
 * @returns {Promise<{ok: boolean, survey: object, owners: object, employees: object, documents: object, error?: string}>}
 */
async function backfillTenants() {
  try {
    const survey = await surveyTenants();

    const owners = await provisionOwnerTenants();
    const employees = await linkEmployeeAccounts();
    const documents = await stampScopedDocuments();

    const stillOrphaned = Object.values(documents.orphaned).reduce(
      (sum, n) => sum + n,
      0,
    );

    if (stillOrphaned > 0 || employees.orphaned > 0) {
      logger.warn('Tenant backfill left rows unscoped', {
        documents: documents.orphaned,
        employeeLogins: employees.orphaned,
      });
    }

    logger.info('Tenant backfill complete', {
      survey,
      owners,
      employees,
      stamped: documents.stamped,
    });

    return { ok: true, survey, owners, employees, documents };
  } catch (error) {
    logger.error('Tenant backfill failed', { error: error.message });

    return {
      ok: false,
      survey: {},
      owners: { created: 0, linked: 0 },
      employees: { linked: 0, orphaned: 0 },
      documents: { stamped: {}, orphaned: {} },
      error: error.message,
    };
  }
}

// Allow running directly: `node src/migrations/backfillTenants.js`
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');

  (async () => {
    await connectDB();
    const result = await backfillTenants();
    await mongoose.disconnect();
    process.exit(result.ok ? 0 : 1);
  })();
}

module.exports = {
  backfillTenants,
  surveyTenants,
  provisionOwnerTenants,
  linkEmployeeAccounts,
  stampScopedDocuments,
  SCOPED_MODELS,
};
