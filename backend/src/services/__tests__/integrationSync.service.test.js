/**
 * HRMS sync (#954).
 *
 * `src/integrations/` held a complete adapter layer that nothing outside it
 * referred to, so `fetchEmployees()` had never run and `IntegrationConfig` had
 * no writer. The decisions tested here are the ones that are expensive to get
 * wrong: matching before inserting, never deleting, and treating a partial run
 * as a partial run.
 */

jest.mock('../../models/integrationConfig.model', () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../models/employee.model', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../../integrations/registry', () => ({
  getAdapter: jest.fn(),
  listProviders: jest.fn(() => ['bamboohr', 'workday']),
}));
jest.mock('../encryption.service', () => ({
  encrypt: jest.fn((v) => `enc(${v})`),
  decrypt: jest.fn((v) => String(v).replace(/^enc\((.*)\)$/, '$1')),
  mask: jest.fn(() => '****'),
}));

const IntegrationConfig = require('../../models/integrationConfig.model');
const Employee = require('../../models/employee.model');
const registry = require('../../integrations/registry');
const {
  syncTenant,
  syncAllTenants,
  _internals,
} = require('../integrationSync.service');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';

const config = (overrides = {}) => ({
  _id: 'config-1',
  tenantId: TENANT,
  provider: 'bamboohr',
  credentials: { apiKey: 'enc(secret-key)', subdomain: 'acme' },
  isActive: true,
  createdBy: USER,
  ...overrides,
});

/** A row in the shape the adapters return. */
const row = (overrides = {}) => ({
  externalId: '4021',
  fullName: 'Alice Smith',
  email: 'alice@acme.example',
  department: 'Engineering',
  dateOfJoining: '2024-06-01',
  provider: 'bamboohr',
  ...overrides,
});

const adapterReturning = (rows) => {
  const adapter = { fetchEmployees: jest.fn().mockResolvedValue(rows) };
  registry.getAdapter.mockReturnValue(adapter);
  return adapter;
};

beforeEach(() => {
  jest.clearAllMocks();
  Employee.findOne.mockResolvedValue(null);
  Employee.updateOne.mockResolvedValue({});
  Employee.create.mockResolvedValue({ _id: 'employee-1' });
  IntegrationConfig.updateOne.mockResolvedValue({});
  IntegrationConfig.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue([]),
  });
});

describe('building the adapter', () => {
  it('decrypts the credentials before handing them over', async () => {
    adapterReturning([row()]);

    await syncTenant(config());

    expect(registry.getAdapter).toHaveBeenCalledWith('bamboohr', {
      apiKey: 'secret-key',
      subdomain: 'acme',
    });
  });

  it('records a provider that cannot be built as a failed run', async () => {
    registry.getAdapter.mockImplementation(() => {
      throw new Error('No adapter registered for provider "sap"');
    });

    const result = await syncTenant(config({ provider: 'sap' }));

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/No adapter registered/);
    // And the outcome reaches the config, which is what an admin looks at.
    expect(IntegrationConfig.updateOne).toHaveBeenCalledWith(
      { _id: 'config-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ lastSyncStatus: 'failed' }),
      }),
    );
  });
});

describe('matching an incoming row', () => {
  it('creates an employee that does not exist yet', async () => {
    adapterReturning([row()]);

    const result = await syncTenant(config());

    expect(result).toMatchObject({ status: 'success', created: 1, updated: 0 });
    expect(Employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'alice@acme.example',
        tenantId: TENANT,
        externalId: '4021',
        externalProvider: 'bamboohr',
      }),
    );
  });

  it('matches an existing employee by email on the first run', async () => {
    // The one that duplicates a workforce if it is got wrong: PaySphere already
    // has these people, and nothing has an external id on it yet.
    Employee.findOne
      .mockResolvedValueOnce(null) // no external id match
      .mockResolvedValueOnce({ _id: 'employee-1' }); // email match

    adapterReturning([row()]);

    const result = await syncTenant(config());

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(Employee.create).not.toHaveBeenCalled();
  });

  it('prefers the external id, so a changed email does not create a second record', async () => {
    Employee.findOne.mockResolvedValueOnce({ _id: 'employee-1' });

    adapterReturning([row({ email: 'alice.smith@acme.example' })]);

    const result = await syncTenant(config());

    expect(result.updated).toBe(1);
    expect(Employee.findOne).toHaveBeenCalledWith({
      tenantId: TENANT,
      externalId: '4021',
      externalProvider: 'bamboohr',
    });
  });

  it('stamps the external id onto a record that was matched by email', async () => {
    Employee.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'employee-1' });

    adapterReturning([row()]);

    await syncTenant(config());

    const [, update] = Employee.updateOne.mock.calls[0];

    // So the second sync can recognise it without falling back to email.
    expect(update.$set.externalId).toBe('4021');
    expect(update.$set.externalProvider).toBe('bamboohr');
  });

  it('never writes a salary', async () => {
    adapterReturning([row({ monthlySalary: 999999 })]);

    await syncTenant(config());

    // What somebody is paid is a decision that lives here. A sync that could
    // write it would let an external system change payroll.
    expect(Employee.create.mock.calls[0][0].monthlySalary).toBe(0);
  });
});

describe('rows it will not import', () => {
  it('skips a row with no email and keeps going', async () => {
    adapterReturning([
      row({ email: '' }),
      row({ externalId: '4022', email: 'bob@acme.example' }),
    ]);

    const result = await syncTenant(config());

    // One bad row must not discard the rest of the batch.
    expect(result.created).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.status).toBe('partial');
  });

  it('skips a row with no name', async () => {
    adapterReturning([row({ fullName: '   ' })]);

    const result = await syncTenant(config());

    expect(result.skipped[0].reason).toBe('no name');
  });

  it('records a write failure against the row rather than failing the run', async () => {
    Employee.create.mockRejectedValue(new Error('E11000 duplicate key'));
    adapterReturning([row()]);

    const result = await syncTenant(config());

    expect(result.status).toBe('partial');
    expect(result.skipped[0]).toMatchObject({ row: 'alice@acme.example' });
  });
});

describe('a provider that returns nothing', () => {
  it('is a failure, not a successful sync of nothing', async () => {
    // The adapters catch their own errors and return [], so an empty response
    // is indistinguishable from "this company has no employees". A green status
    // on a run that fetched nothing would be a lie.
    adapterReturning([]);

    const result = await syncTenant(config());

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no employees/i);
  });

  it('deletes nobody', async () => {
    adapterReturning([]);

    await syncTenant(config());

    // An employee the HRMS does not know about has not necessarily left: it
    // may cover one office, one country, or only salaried staff. Deleting on
    // absence is the one mistake here that destroys payroll history.
    expect(Employee.updateOne).not.toHaveBeenCalled();
    expect(Employee.create).not.toHaveBeenCalled();
  });
});

describe('recording the outcome', () => {
  it('writes the three fields nothing had ever written', async () => {
    adapterReturning([row()]);

    await syncTenant(config());

    const [, update] = IntegrationConfig.updateOne.mock.calls[0];

    expect(update.$set.lastSyncStatus).toBe('success');
    expect(update.$set.lastSyncAt).toBeInstanceOf(Date);
    expect(update.$set.lastSyncError).toBeNull();
  });

  it('does not fail the run when the outcome cannot be recorded', async () => {
    IntegrationConfig.updateOne.mockRejectedValue(new Error('write concern'));
    adapterReturning([row()]);

    await expect(syncTenant(config())).resolves.toMatchObject({ created: 1 });
  });
});

describe('syncing everybody', () => {
  it('runs only the active integrations, and counts the outcomes', async () => {
    IntegrationConfig.find.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([config(), config({ _id: 'config-2' })]),
    });
    adapterReturning([row()]);

    const summary = await syncAllTenants();

    expect(IntegrationConfig.find).toHaveBeenCalledWith({ isActive: true });
    expect(summary).toEqual({ tenants: 2, succeeded: 2, failed: 0 });
  });
});

describe('normalising a row', () => {
  const { normalizeRow } = _internals;

  it('lowercases and trims the email', () => {
    const result = normalizeRow(row({ email: '  Alice@ACME.example ' }));

    expect(result.employee.email).toBe('alice@acme.example');
  });

  it('drops an unparseable joining date rather than storing Invalid Date', () => {
    const result = normalizeRow(row({ dateOfJoining: 'sometime in June' }));

    expect(result.ok).toBe(true);
    expect(result.employee.joiningDate).toBeUndefined();
  });
});
