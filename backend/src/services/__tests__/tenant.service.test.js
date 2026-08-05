const mongoose = require('mongoose');
const Tenant = require('../../models/tenant.model');
const User = require('../../models/user.model');
const Employee = require('../../models/employee.model');
const {
  ensureTenantForUser,
  findOrCreateTenantForOwner,
  resolveEmployerTenant,
} = require('../tenant.service');

jest.mock('../../models/tenant.model');
jest.mock('../../models/user.model');
jest.mock('../../models/employee.model');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const logger = require('../../utils/logger');

const anId = () => new mongoose.Types.ObjectId();

/** `Model.findById(id).select(...).lean()` as a resolved value. */
const leanChain = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('findOrCreateTenantForOwner (#612)', () => {
  test('returns the existing tenant without writing', async () => {
    const existing = { _id: anId() };
    Tenant.findOne.mockResolvedValue(existing);

    const tenant = await findOrCreateTenantForOwner({ _id: anId() });

    expect(tenant).toBe(existing);
    expect(Tenant.create).not.toHaveBeenCalled();
  });

  test('names the tenant after the company the account registered', async () => {
    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockImplementation(async (doc) => ({ _id: anId(), ...doc }));

    const ownerId = anId();
    await findOrCreateTenantForOwner({
      _id: ownerId,
      companyName: 'Acme Payroll Ltd',
      fullName: 'Ada Lovelace',
    });

    expect(Tenant.create).toHaveBeenCalledWith({
      name: 'Acme Payroll Ltd',
      ownerId,
    });
  });

  test('falls back to the account name when no company name is set', async () => {
    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockImplementation(async (doc) => doc);

    await findOrCreateTenantForOwner({ _id: anId(), fullName: 'Ada Lovelace' });

    expect(Tenant.create.mock.calls[0][0].name).toBe('Ada Lovelace');
  });

  test('a concurrent provision loses the race gracefully rather than throwing', async () => {
    const winner = { _id: anId() };
    Tenant.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    Tenant.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

    // Two logins for the same account can arrive together; `ownerId` is
    // uniquely indexed, so one insert wins and the other must adopt it instead
    // of failing the request.
    await expect(findOrCreateTenantForOwner({ _id: anId() })).resolves.toBe(winner);
  });

  test('a real write failure is not swallowed here', async () => {
    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockRejectedValue(new Error('connection lost'));

    await expect(findOrCreateTenantForOwner({ _id: anId() })).rejects.toThrow(
      'connection lost',
    );
  });
});

describe('resolveEmployerTenant (#612)', () => {
  test("uses the employee row's own tenant when it has one", async () => {
    const tenantId = anId();
    Employee.findById.mockReturnValue(leanChain({ tenantId }));

    await expect(resolveEmployerTenant({ employeeId: anId() })).resolves.toBe(tenantId);
    expect(User.findById).not.toHaveBeenCalled();
  });

  test("falls back to the employer account's tenant for a pre-#585 employee row", async () => {
    const employerId = anId();
    const tenantId = anId();
    Employee.findById.mockReturnValue(leanChain({ createdBy: employerId }));
    User.findById.mockReturnValue(leanChain({ tenantId }));

    await expect(resolveEmployerTenant({ employeeId: anId() })).resolves.toBe(tenantId);
    expect(User.findById).toHaveBeenCalledWith(employerId);
  });

  test('returns null when the employee row is gone', async () => {
    Employee.findById.mockReturnValue(leanChain(null));

    await expect(resolveEmployerTenant({ employeeId: anId() })).resolves.toBeNull();
  });

  test('returns null when the employer account is gone', async () => {
    Employee.findById.mockReturnValue(leanChain({ createdBy: anId() }));
    User.findById.mockReturnValue(leanChain(null));

    await expect(resolveEmployerTenant({ employeeId: anId() })).resolves.toBeNull();
  });
});

describe('ensureTenantForUser — already provisioned (#612)', () => {
  test('returns the existing tenant and touches nothing', async () => {
    const tenantId = anId();

    await expect(ensureTenantForUser({ _id: anId(), tenantId })).resolves.toBe(tenantId);

    expect(Tenant.findOne).not.toHaveBeenCalled();
    expect(Tenant.create).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  test('handles being called with nothing', async () => {
    await expect(ensureTenantForUser(null)).resolves.toBeNull();
    await expect(ensureTenantForUser(undefined)).resolves.toBeNull();
    await expect(ensureTenantForUser({})).resolves.toBeNull();
  });
});

describe('ensureTenantForUser — owner accounts (#612)', () => {
  test('creates a tenant and binds the account to it', async () => {
    const tenantId = anId();
    const user = { _id: anId(), companyName: 'Acme' };

    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockResolvedValue({ _id: tenantId });
    User.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await expect(ensureTenantForUser(user)).resolves.toBe(tenantId);

    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: user._id },
      { $set: { tenantId } },
    );
  });

  test('mutates the in-memory document too, so the caller can mint a token from it', async () => {
    const tenantId = anId();
    const user = { _id: anId(), companyName: 'Acme' };

    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockResolvedValue({ _id: tenantId });
    User.updateOne.mockResolvedValue({});

    await ensureTenantForUser(user);

    // `signup` calls this and then hands the same object to `generateTokens`,
    // which reads `user.tenantId` into the JWT claim.
    expect(user.tenantId).toBe(tenantId);
  });

  test('writes with $set rather than save(), so a projected document is not clobbered', async () => {
    const user = { _id: anId(), companyName: 'Acme', save: jest.fn() };

    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockResolvedValue({ _id: anId() });
    User.updateOne.mockResolvedValue({});

    await ensureTenantForUser(user);

    expect(user.save).not.toHaveBeenCalled();
    expect(User.updateOne).toHaveBeenCalled();
  });
});

describe('ensureTenantForUser — employee portal logins (#612)', () => {
  test("joins the employer's tenant instead of creating its own", async () => {
    const tenantId = anId();
    const user = { _id: anId(), employeeId: anId() };

    Employee.findById.mockReturnValue(leanChain({ tenantId }));
    User.updateOne.mockResolvedValue({});

    await expect(ensureTenantForUser(user)).resolves.toBe(tenantId);

    // An employee does not own a company, so nothing should be created for one.
    expect(Tenant.create).not.toHaveBeenCalled();
  });

  test('leaves an unresolvable employee login unscoped rather than guessing', async () => {
    const user = { _id: anId(), employeeId: anId() };

    Employee.findById.mockReturnValue(leanChain(null));

    await expect(ensureTenantForUser(user)).resolves.toBeNull();

    // Guessing a tenant here is how a payslip ends up in another company.
    expect(User.updateOne).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('ensureTenantForUser — failure is not allowed to break the session (#612)', () => {
  test('returns null instead of throwing when provisioning fails', async () => {
    Tenant.findOne.mockRejectedValue(new Error('connection lost'));

    // This runs on the login path. A tenant that cannot be created must not
    // stop someone signing in — tenantScope refuses their scoped requests
    // afterwards, which fails closed rather than open.
    await expect(ensureTenantForUser({ _id: anId(), companyName: 'Acme' })).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalled();
  });

  test('does not bind the account to a tenant it failed to create', async () => {
    const user = { _id: anId(), companyName: 'Acme' };
    Tenant.findOne.mockResolvedValue(null);
    Tenant.create.mockRejectedValue(new Error('connection lost'));

    await ensureTenantForUser(user);

    expect(user.tenantId).toBeUndefined();
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});
