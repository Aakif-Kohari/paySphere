jest.mock('../../models/auditLog.model', () => {
  const create = jest.fn().mockResolvedValue({});
  const model = { create };
  model.AUDIT_ACTIONS = ['PAYROLL_APPROVE', 'WORKFLOW_TRANSITION'];
  model.AUDIT_RESOURCE_TYPES = ['Payroll', 'WorkflowInstance'];
  return model;
});
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mongoose = require('mongoose');
const AuditLog = require('../../models/auditLog.model');
const logger = require('../../utils/logger');
const { createAuditLog } = require('../audit.service');

const USER_ID = new mongoose.Types.ObjectId().toString();
const TENANT_ID = new mongoose.Types.ObjectId().toString();

const validPayload = (overrides = {}) => ({
  userId: USER_ID,
  action: 'PAYROLL_APPROVE',
  resourceType: 'Payroll',
  req: { tenantId: TENANT_ID, ip: '10.0.0.1', headers: { 'user-agent': 'jest' } },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  AuditLog.create.mockResolvedValue({});
});

describe('createAuditLog — tenant resolution (#664)', () => {
  test('writes the entry with the tenant from the request', async () => {
    await expect(createAuditLog(validPayload())).resolves.toBe(true);

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        tenantId: TENANT_ID,
        action: 'PAYROLL_APPROVE',
        resourceType: 'Payroll',
        result: 'success',
        ipAddress: '10.0.0.1',
        userAgent: 'jest',
      }),
    );
  });

  test('an explicit tenantId wins over the request', async () => {
    const explicit = new mongoose.Types.ObjectId().toString();

    await createAuditLog(validPayload({ tenantId: explicit }));

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: explicit }),
    );
  });

  test('drops the entry rather than writing one with no tenant', async () => {
    // An entry with no tenant cannot be read back by a scoped query, so it is
    // write-only noise — and `{ tenantId: undefined }` in a filter is a filter
    // mongoose deletes, which is the failure utils/tenantScope.js exists for.
    await expect(
      createAuditLog(validPayload({ req: { ip: '10.0.0.1' } })),
    ).resolves.toBe(false);

    expect(AuditLog.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Audit entry dropped: no tenant on the request',
      expect.any(Object),
    );
  });

  test('the string "undefined" is not a tenant', async () => {
    await expect(
      createAuditLog(validPayload({ req: { tenantId: 'undefined' } })),
    ).resolves.toBe(false);

    expect(AuditLog.create).not.toHaveBeenCalled();
  });
});

describe('createAuditLog — vocabulary (#664)', () => {
  test('rejects an action the schema does not accept, and says which', async () => {
    await expect(
      createAuditLog(validPayload({ action: 'SOMETHING_NEW' })),
    ).resolves.toBe(false);

    expect(AuditLog.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Audit entry dropped: unknown action',
      expect.objectContaining({ action: 'SOMETHING_NEW' }),
    );
  });

  test('rejects an unknown resource type', async () => {
    await expect(
      createAuditLog(validPayload({ resourceType: 'Spaceship' })),
    ).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(
      'Audit entry dropped: unknown resource type',
      expect.objectContaining({ resourceType: 'Spaceship' }),
    );
  });

  test('accepts every action in the vocabulary', async () => {
    await expect(
      createAuditLog(
        validPayload({
          action: 'WORKFLOW_TRANSITION',
          resourceType: 'WorkflowInstance',
        }),
      ),
    ).resolves.toBe(true);
  });
});

describe('createAuditLog — failure containment (#390, #411)', () => {
  test('a database failure is reported, never thrown', async () => {
    AuditLog.create.mockRejectedValueOnce(new Error('connection lost'));

    await expect(createAuditLog(validPayload())).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to create audit log',
      expect.objectContaining({ error: 'connection lost' }),
    );
  });

  test('defaults resourceIds and details rather than writing undefined', async () => {
    await createAuditLog(validPayload());

    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ resourceIds: [], details: {} }),
    );
  });
});
