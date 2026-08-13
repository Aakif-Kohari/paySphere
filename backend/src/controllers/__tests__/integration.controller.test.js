/**
 * HRMS integration settings (#954).
 *
 * The property that matters most here: credentials go in encrypted and never
 * come back out. `IntegrationConfig` had no writer at all before this, so
 * nothing had ever had to encrypt one — and the first implementation that
 * forgets stores a BambooHR API key and a Workday password in plaintext and
 * hands them back on the next GET.
 */

jest.mock('../../models/integrationConfig.model', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));
jest.mock('../../integrations/registry', () => ({
  listProviders: jest.fn(() => ['bamboohr', 'workday']),
  getAdapter: jest.fn(),
}));
jest.mock('../../services/integrationSync.service', () => ({
  syncTenant: jest.fn(),
}));
jest.mock('../../services/encryption.service', () => ({
  encrypt: jest.fn((v) => `enc(${v})`),
  decrypt: jest.fn((v) => v),
  mask: jest.fn(() => '****3456'),
}));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));

const IntegrationConfig = require('../../models/integrationConfig.model');
const { syncTenant } = require('../../services/integrationSync.service');
const { encrypt } = require('../../services/encryption.service');
const {
  listProviders,
  listIntegrations,
  upsertIntegration,
  triggerSync,
  deleteIntegration,
} = require('../integration.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const stored = (overrides = {}) => ({
  _id: 'config-1',
  tenantId: TENANT,
  provider: 'bamboohr',
  credentials: { apiKey: 'enc(secret-key-3456)', subdomain: 'acme' },
  isActive: true,
  syncSchedule: '0 2 * * *',
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
  ...overrides,
});

let req;
let res;
let next;

beforeEach(() => {
  jest.clearAllMocks();

  req = {
    userId: USER,
    tenantId: TENANT,
    params: {},
    query: {},
    body: {},
  };
  res = makeRes();
  next = jest.fn();

  IntegrationConfig.find.mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([stored()]),
  });
  IntegrationConfig.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(stored()),
  });
  IntegrationConfig.findOneAndUpdate.mockResolvedValue(stored());
  IntegrationConfig.findOneAndDelete.mockResolvedValue(stored());
  syncTenant.mockResolvedValue({
    status: 'success',
    created: 2,
    updated: 3,
    skipped: [],
    error: null,
  });
});

describe('listing what can be connected', () => {
  it('serves the providers from the registry, with what each one needs', async () => {
    // From the registry, so a provider registered elsewhere appears without
    // this file being touched.
    await listProviders(req, res, next);

    const { providers } = res.json.mock.calls[0][0];

    expect(providers.map((p) => p.name)).toEqual(['bamboohr', 'workday']);
    expect(providers[0].requiredCredentials).toEqual(['apiKey', 'subdomain']);
  });
});

describe('reading a configured integration', () => {
  it('masks the secrets and keeps the addresses readable', async () => {
    await listIntegrations(req, res, next);

    const [integration] = res.json.mock.calls[0][0].integrations;

    // Enough to recognise which key is installed, not enough to use it.
    expect(integration.credentials.apiKey).toBe('****3456');
    // A subdomain is not a secret, and hiding it makes the screen useless.
    expect(integration.credentials.subdomain).toBe('acme');
  });

  it('never returns the stored ciphertext', async () => {
    await listIntegrations(req, res, next);

    const body = JSON.stringify(res.json.mock.calls[0][0]);

    expect(body).not.toContain('enc(');
    expect(body).not.toContain('secret-key');
  });

  it('reads only the caller’s tenant', async () => {
    await listIntegrations(req, res, next);

    expect(IntegrationConfig.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });
});

describe('saving an integration', () => {
  it('rejects a provider with no adapter behind it', async () => {
    // A 400 the caller can act on, rather than the 500 `registry.getAdapter`
    // would produce by throwing.
    req.params = { provider: 'peoplesoft' };
    req.body = { credentials: { apiKey: 'x' } };

    await upsertIntegration(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(IntegrationConfig.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a config that is missing a credential the provider needs', async () => {
    req.params = { provider: 'workday' };
    req.body = { credentials: { username: 'svc' } };

    await upsertIntegration(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/password, raasUrl/);
  });

  it('encrypts the secrets and leaves the addresses alone', async () => {
    req.params = { provider: 'bamboohr' };
    req.body = {
      credentials: { apiKey: 'secret-key-3456', subdomain: 'acme' },
    };

    await upsertIntegration(req, res, next);

    const [, update] = IntegrationConfig.findOneAndUpdate.mock.calls[0];

    expect(encrypt).toHaveBeenCalledWith('secret-key-3456');
    expect(update.$set.credentials.apiKey).toBe('enc(secret-key-3456)');
    expect(update.$set.credentials.subdomain).toBe('acme');
  });

  it('upserts against the caller’s tenant and provider', async () => {
    req.params = { provider: 'bamboohr' };
    req.body = { credentials: { apiKey: 'k', subdomain: 'acme' } };

    await upsertIntegration(req, res, next);

    const [filter, , options] =
      IntegrationConfig.findOneAndUpdate.mock.calls[0];

    expect(filter).toEqual({ tenantId: TENANT, provider: 'bamboohr' });
    expect(options.upsert).toBe(true);
  });

  it('does not echo the credentials back in the response', async () => {
    req.params = { provider: 'bamboohr' };
    req.body = {
      credentials: { apiKey: 'secret-key-3456', subdomain: 'acme' },
    };

    await upsertIntegration(req, res, next);

    const body = JSON.stringify(res.json.mock.calls[0][0]);

    expect(body).not.toContain('secret-key-3456');
  });
});

describe('triggering a sync', () => {
  it('runs it and reports what it did', async () => {
    req.params = { provider: 'bamboohr' };

    await triggerSync(req, res, next);

    expect(syncTenant).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ created: 2, updated: 3 });
  });

  it('answers 404 when nothing is configured', async () => {
    IntegrationConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    req.params = { provider: 'workday' };

    await triggerSync(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(syncTenant).not.toHaveBeenCalled();
  });

  it('refuses to sync a disabled integration', async () => {
    IntegrationConfig.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(stored({ isActive: false })),
    });
    req.params = { provider: 'bamboohr' };

    await triggerSync(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(syncTenant).not.toHaveBeenCalled();
  });

  it('reports a partial run as a success with the skipped rows', async () => {
    // Some employees really were imported, and the body says which rows were
    // not. A 500 would suggest nothing happened.
    syncTenant.mockResolvedValue({
      status: 'partial',
      created: 1,
      updated: 0,
      skipped: [{ row: 'bob@acme.example', reason: 'no email' }],
      error: null,
    });
    req.params = { provider: 'bamboohr' };

    await triggerSync(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].skipped).toHaveLength(1);
  });

  it('reports a failed run as an upstream failure', async () => {
    syncTenant.mockResolvedValue({
      status: 'failed',
      created: 0,
      updated: 0,
      skipped: [],
      error: 'BambooHR API 401: Unauthorized',
    });
    req.params = { provider: 'bamboohr' };

    await triggerSync(req, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});

describe('removing an integration', () => {
  it('deletes it scoped by tenant and keeps the employees it imported', async () => {
    req.params = { provider: 'bamboohr' };

    await deleteIntegration(req, res, next);

    expect(IntegrationConfig.findOneAndDelete).toHaveBeenCalledWith({
      tenantId: TENANT,
      provider: 'bamboohr',
    });
    // Disconnecting a source is not a decision to delete the people it told us
    // about — they are this company's records now.
    expect(res.json.mock.calls[0][0].message).toMatch(/kept/i);
  });

  it('answers 404 for a provider this company never configured', async () => {
    IntegrationConfig.findOneAndDelete.mockResolvedValue(null);
    req.params = { provider: 'workday' };

    await deleteIntegration(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
