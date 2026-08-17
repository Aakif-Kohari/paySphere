const mongoose = require('mongoose');
const User = require('../../models/user.model');
const Tenant = require('../../models/tenant.model');
const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const Loan = require('../../models/loan.model');
const Settlement = require('../../models/settlement.model');
const SalaryStructure = require('../../models/salaryStructure.model');
const Attendance = require('../../models/attendance.model');
const ReportSchedule = require('../../models/reportSchedule.model');
const {
  backfillTenants,
  surveyTenants,
  provisionOwnerTenants,
  linkEmployeeAccounts,
  stampScopedDocuments,
  SCOPED_MODELS,
} = require('../backfillTenants');

jest.mock('../../models/user.model');
jest.mock('../../models/tenant.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/payroll.model');
jest.mock('../../models/loan.model');
jest.mock('../../models/settlement.model');
jest.mock('../../models/salaryStructure.model');
jest.mock('../../models/attendance.model');
jest.mock('../../models/reportSchedule.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const logger = require('../../utils/logger');

const anId = () => new mongoose.Types.ObjectId();

/** `Model.find(...).select(...).lean()` as a resolved value. */
const findLean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

const allModels = [
  Employee,
  PayrollUpdate,
  Loan,
  Settlement,
  SalaryStructure,
  Attendance,
  ReportSchedule,
];

beforeEach(() => {
  jest.clearAllMocks();

  for (const model of [...allModels, User, Tenant]) {
    model.countDocuments = jest.fn().mockResolvedValue(0);
    model.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
    model.updateOne = jest.fn().mockResolvedValue({});
    model.find = jest.fn().mockReturnValue(findLean([]));
    model.findById = jest.fn().mockReturnValue(findLean(null));
    model.findOne = jest.fn().mockReturnValue(findLean(null));
  }
});

describe('backfillTenants — the collections it covers (#612)', () => {
  test('covers every collection #585 put a tenantId on', () => {
    expect(SCOPED_MODELS.map(([name]) => name)).toEqual([
      'Employee',
      'PayrollUpdate',
      'Loan',
      'Settlement',
      'SalaryStructure',
      'Attendance',
      'ReportSchedule',
    ]);
  });

  test('holds the models directly rather than reading mongoose.models', () => {
    // The migration runs from index.js before app.js has pulled the routers in,
    // so the model registry is not guaranteed to be populated yet.
    for (const [, model] of SCOPED_MODELS) {
      expect(typeof model.updateMany).toBe('function');
    }
  });
});

describe('surveyTenants (#612)', () => {
  test('counts unscoped accounts and unscoped rows in every collection', async () => {
    User.countDocuments.mockResolvedValue(4);
    for (const model of allModels) model.countDocuments.mockResolvedValue(9);

    const survey = await surveyTenants();

    expect(survey.usersWithoutTenant).toBe(4);
    expect(Object.keys(survey.documentsWithoutTenant)).toHaveLength(7);
    expect(survey.documentsWithoutTenant.Employee).toBe(9);
  });

  test('treats a missing field and an explicit null as the same thing', async () => {
    await surveyTenants();

    // Documents written before #585 have no `tenantId` key at all; ones written
    // after it and then cleared have `null`. Both are unscoped.
    expect(User.countDocuments).toHaveBeenCalledWith({
      $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
    });
  });
});

describe('provisionOwnerTenants (#612)', () => {
  test('creates one tenant per owner and binds the account to it', async () => {
    const ownerId = anId();
    const tenantId = anId();

    User.find.mockReturnValue(findLean([{ _id: ownerId, companyName: 'Acme' }]));
    Tenant.updateOne.mockResolvedValue({ upsertedCount: 1 });
    Tenant.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: tenantId }) }),
    });

    const result = await provisionOwnerTenants();

    expect(result).toEqual({ created: 1, linked: 1 });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: ownerId },
      { $set: { tenantId } },
    );
  });

  test('names the tenant after the company the account registered', async () => {
    User.find.mockReturnValue(findLean([{ _id: anId(), companyName: 'Acme Payroll' }]));
    Tenant.updateOne.mockResolvedValue({ upsertedCount: 1 });
    Tenant.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: anId() }) }),
    });

    await provisionOwnerTenants();

    const [, update, options] = Tenant.updateOne.mock.calls[0];
    expect(update.$setOnInsert.name).toBe('Acme Payroll');
    expect(options).toEqual({ upsert: true });
  });

  test('only looks at accounts that own a company, not employee logins', async () => {
    await provisionOwnerTenants();

    const [filter] = User.find.mock.calls[0];
    expect(filter.$and[0]).toEqual({
      $or: [{ employeeId: { $exists: false } }, { employeeId: null }],
    });
  });

  test('upserts on ownerId, so a half-finished previous run is repaired not duplicated', async () => {
    const ownerId = anId();
    User.find.mockReturnValue(findLean([{ _id: ownerId, companyName: 'Acme' }]));
    // The tenant already exists from a run that died before stamping the user.
    Tenant.updateOne.mockResolvedValue({ upsertedCount: 0 });
    Tenant.findOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ _id: anId() }) }),
    });

    const result = await provisionOwnerTenants();

    expect(Tenant.updateOne.mock.calls[0][0]).toEqual({ ownerId });
    expect(result.created).toBe(0);
    expect(result.linked).toBe(1);
  });

  test('is a no-op on an already-scoped database', async () => {
    User.find.mockReturnValue(findLean([]));

    await expect(provisionOwnerTenants()).resolves.toEqual({ created: 0, linked: 0 });
    expect(Tenant.updateOne).not.toHaveBeenCalled();
  });
});

describe('linkEmployeeAccounts (#612)', () => {
  test("points an employee login at its employer's tenant", async () => {
    const tenantId = anId();
    const accountId = anId();

    User.find.mockReturnValue(
      findLean([{ _id: accountId, employeeId: anId() }]),
    );
    Employee.findById.mockReturnValue(findLean({ tenantId }));

    const result = await linkEmployeeAccounts();

    expect(result).toEqual({ linked: 1, orphaned: 0 });
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: accountId },
      { $set: { tenantId } },
    );
  });

  test('falls back to the employer account for a pre-#585 employee row', async () => {
    const employerId = anId();
    const tenantId = anId();

    User.find.mockReturnValue(findLean([{ _id: anId(), employeeId: anId() }]));
    Employee.findById.mockReturnValue(findLean({ createdBy: employerId }));
    User.findById.mockReturnValue(findLean({ tenantId }));

    await expect(linkEmployeeAccounts()).resolves.toEqual({ linked: 1, orphaned: 0 });
  });

  test('leaves an unresolvable employee login alone rather than guessing a tenant', async () => {
    User.find.mockReturnValue(findLean([{ _id: anId(), employeeId: anId() }]));
    Employee.findById.mockReturnValue(findLean(null));

    const result = await linkEmployeeAccounts();

    // Putting them in the wrong company is how a payslip leaks. Unscoped is
    // recoverable; misscoped is not.
    expect(result).toEqual({ linked: 0, orphaned: 1 });
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});

describe('stampScopedDocuments (#612)', () => {
  test('derives each row\'s tenant from the createdBy owner', async () => {
    const ownerId = anId();
    const tenantId = anId();

    User.find.mockReturnValue(findLean([{ _id: ownerId, tenantId }]));
    for (const model of allModels) {
      model.updateMany.mockResolvedValue({ modifiedCount: 3 });
    }

    const result = await stampScopedDocuments();

    expect(Employee.updateMany).toHaveBeenCalledWith(
      {
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
        createdBy: ownerId,
      },
      { $set: { tenantId } },
    );
    expect(result.stamped.Employee).toBe(3);
  });

  test('touches all seven collections', async () => {
    User.find.mockReturnValue(findLean([{ _id: anId(), tenantId: anId() }]));

    await stampScopedDocuments();

    for (const model of allModels) {
      expect(model.updateMany).toHaveBeenCalled();
    }
  });

  test('one write per owner, not per document', async () => {
    User.find.mockReturnValue(
      findLean([
        { _id: anId(), tenantId: anId() },
        { _id: anId(), tenantId: anId() },
      ]),
    );

    await stampScopedDocuments();

    // A customer with 400 employees is one updateMany, not 400 updateOnes.
    expect(Employee.updateMany).toHaveBeenCalledTimes(2);
  });

  test('reports rows it could not attribute instead of inventing a tenant for them', async () => {
    User.find.mockReturnValue(findLean([{ _id: anId(), tenantId: anId() }]));
    Employee.countDocuments.mockResolvedValue(5);

    const result = await stampScopedDocuments();

    expect(result.orphaned.Employee).toBe(5);
  });

  test('skips owners who have no tenant themselves', async () => {
    User.find.mockReturnValue(findLean([]));

    await stampScopedDocuments();

    expect(Employee.updateMany).not.toHaveBeenCalled();
    expect(User.find.mock.calls[0][0]).toEqual({
      tenantId: { $exists: true, $ne: null },
    });
  });
});

describe('backfillTenants — orchestration and contract (#612)', () => {
  test('reports success on a clean database', async () => {
    const result = await backfillTenants();

    expect(result.ok).toBe(true);
  });

  test('never throws — a failed backfill must not stop the server booting', async () => {
    User.countDocuments.mockRejectedValue(new Error('connection lost'));

    const result = await backfillTenants();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('connection lost');
    expect(logger.error).toHaveBeenCalled();
  });

  test('warns when rows are left unscoped, rather than reporting a clean run', async () => {
    User.find.mockReturnValue(findLean([{ _id: anId(), tenantId: anId() }]));
    Employee.countDocuments.mockResolvedValue(0);
    Loan.countDocuments.mockResolvedValue(7);

    await backfillTenants();

    expect(logger.warn).toHaveBeenCalledWith(
      'Tenant backfill left rows unscoped',
      expect.objectContaining({ documents: expect.objectContaining({ Loan: 7 }) }),
    );
  });

  test('runs owners before employees, because employees read the tenant owners were just given', async () => {
    const order = [];
    User.find.mockImplementation((filter) => {
      order.push(filter.employeeId ? 'employees' : 'owners');
      return findLean([]);
    });

    await backfillTenants();

    expect(order.slice(0, 2)).toEqual(['owners', 'employees']);
  });
});
