jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../utils/logger');

/**
 * `elasticsearch.service.js` (#895).
 *
 * The module used to require `./logger`, and the logger lives in `utils/`. So
 * it threw `MODULE_NOT_FOUND` on require — before the lazy `getClient()` it
 * documents could degrade anything — and because `search.controller` requires
 * it and `app.js` transitively requires that, a wrong path in an optional
 * integration took the whole API down at boot. The first test below is that
 * one: it fails at `require` if the path regresses.
 *
 * The rest is the tenancy filter. `search` ran `multi_match` over `fields:
 * ['*']` of an entire index with no filter at all, and had no parameter through
 * which a caller could have supplied one. Anyone with a token could read every
 * company's employees and payroll.
 */

/** A fake @elastic/elasticsearch client, injected through the module registry. */
const makeFakeClient = (hits = []) => ({
  search: jest.fn().mockResolvedValue({ hits: { hits } }),
  index: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
});

/**
 * Load the service with `@elastic/elasticsearch` resolving to `client`, or
 * absent entirely when `client` is null.
 *
 * `isSearchAvailable()` is called inside the isolated registry on purpose. The
 * service resolves the package lazily on first use, which is the behaviour that
 * lets CI boot without Docker — but it also means that without this line the
 * `require` would happen after the block has been torn down and the virtual
 * mock is no longer registered, so every client would come back null and the
 * assertions below would pass against nothing.
 */
const loadService = (client) => {
  let service;

  jest.isolateModules(() => {
    jest.doMock(
      '@elastic/elasticsearch',
      () => {
        if (!client) throw new Error('Cannot find module');
        return { Client: jest.fn(() => client) };
      },
      { virtual: true },
    );

    service = require('../elasticsearch.service');
    service.isSearchAvailable();
  });

  return service;
};

const TENANT = '507f1f77bcf86cd799439011';
const OTHER_TENANT = '507f1f77bcf86cd799439012';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('module loading (#895)', () => {
  test('the service can be required', () => {
    // The regression in one line. `require('./logger')` from `services/` throws
    // MODULE_NOT_FOUND, and every test in this file fails on that before
    // reaching an assertion.
    expect(() => require('../elasticsearch.service')).not.toThrow();
  });

  test('it exposes the indices and helpers the controller imports', () => {
    const service = require('../elasticsearch.service');

    expect(service.INDICES.EMPLOYEES).toBe('paysphere-employees');
    expect(typeof service.search).toBe('function');
    expect(typeof service.indexDocument).toBe('function');
    expect(typeof service.isSearchAvailable).toBe('function');
  });

  test('a missing elasticsearch package degrades instead of throwing', () => {
    // The behaviour the file's own header claims and the bad require defeated:
    // CI without Docker must boot.
    const service = loadService(null);

    expect(service.isSearchAvailable()).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('search — tenancy (#895)', () => {
  test('the query carries a tenant filter', () => {
    const client = makeFakeClient();
    const service = loadService(client);

    return service
      .search('paysphere-employees', 'priya', { tenantId: TENANT })
      .then(() => {
        const [[body]] = client.search.mock.calls;

        expect(body.query.bool.filter).toEqual([
          { term: { tenantId: TENANT } },
        ]);
      });
  });

  test('the term is still ranked, not turned into a filter', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.search('paysphere-employees', 'priya', { tenantId: TENANT });
    const [[body]] = client.search.mock.calls;

    expect(body.query.bool.must[0].multi_match.query).toBe('priya');
    expect(body.query.bool.must[0].multi_match.fuzziness).toBe('AUTO');
  });

  test('a search without a tenant throws instead of searching everything', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await expect(
      service.search('paysphere-employees', 'priya', {}),
    ).rejects.toThrow(service.MissingTenantError);
    expect(client.search).not.toHaveBeenCalled();
  });

  test('a search with no options at all throws', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await expect(
      service.search('paysphere-employees', 'priya'),
    ).rejects.toThrow(/scoped to a company/);
    expect(client.search).not.toHaveBeenCalled();
  });

  test('the string "undefined" is not accepted as a tenant', async () => {
    // What an id interpolated into a template literal upstream looks like by
    // the time it gets here. It is a perfectly good filter term that matches
    // nothing, which is the kind of value that reads as working.
    const client = makeFakeClient();
    const service = loadService(client);

    await expect(
      service.search('paysphere-employees', 'priya', { tenantId: 'undefined' }),
    ).rejects.toThrow(service.MissingTenantError);
  });

  test('two tenants produce two different filters', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.search('paysphere-employees', 'priya', { tenantId: TENANT });
    await service.search('paysphere-employees', 'priya', {
      tenantId: OTHER_TENANT,
    });

    const [first, second] = client.search.mock.calls.map(
      ([body]) => body.query.bool.filter[0].term.tenantId,
    );

    expect(first).toBe(TENANT);
    expect(second).toBe(OTHER_TENANT);
  });
});

describe('search — result shape and limits', () => {
  test('hits are flattened with their id and score', async () => {
    const client = makeFakeClient([
      { _id: 'e1', _score: 4.2, _source: { fullName: 'Priya' } },
    ]);
    const service = loadService(client);

    const results = await service.search('paysphere-employees', 'priya', {
      tenantId: TENANT,
    });

    expect(results).toEqual([{ id: 'e1', score: 4.2, fullName: 'Priya' }]);
  });

  test('size defaults to 20', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.search('paysphere-employees', 'priya', { tenantId: TENANT });

    expect(client.search.mock.calls[0][0].size).toBe(20);
  });

  test('size is capped, so a caller cannot ask for an index dump', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.search('paysphere-employees', 'priya', {
      tenantId: TENANT,
      size: 10000,
    });

    expect(client.search.mock.calls[0][0].size).toBe(service.MAX_SIZE);
  });

  test('a nonsense size falls back to the default rather than to NaN', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.search('paysphere-employees', 'priya', {
      tenantId: TENANT,
      size: 'lots',
    });

    expect(client.search.mock.calls[0][0].size).toBe(20);
  });

  test('a cluster error is an empty result, not a 500', async () => {
    const client = makeFakeClient();
    client.search.mockRejectedValue(new Error('connection refused'));
    const service = loadService(client);

    await expect(
      service.search('paysphere-employees', 'priya', { tenantId: TENANT }),
    ).resolves.toEqual([]);
  });

  test('the search term is not written to the log on error', async () => {
    // It is whatever someone typed into a box that searches salaries and email
    // addresses, and the error line was the one place it was recorded in
    // plaintext.
    const client = makeFakeClient();
    client.search.mockRejectedValue(new Error('connection refused'));
    const service = loadService(client);

    await service.search('paysphere-employees', 'priya.sharma@example.com', {
      tenantId: TENANT,
    });

    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).not.toMatch(/priya\.sharma/);
  });

  test('no client means an empty result and no throw', async () => {
    const service = loadService(null);

    await expect(
      service.search('paysphere-employees', 'priya', { tenantId: TENANT }),
    ).resolves.toEqual([]);
  });
});

describe('indexDocument — tenancy (#895)', () => {
  test('the tenant is stamped onto the indexed body', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.indexDocument(
      'paysphere-employees',
      'e1',
      { fullName: 'Priya' },
      TENANT,
    );

    expect(client.index).toHaveBeenCalledWith({
      index: 'paysphere-employees',
      id: 'e1',
      document: { fullName: 'Priya', tenantId: TENANT },
    });
  });

  test('a tenant in the body cannot override the one passed in', async () => {
    // Otherwise indexing is a way to plant a document in another company's
    // scope, and the filter on the read side is worth nothing.
    const client = makeFakeClient();
    const service = loadService(client);

    await service.indexDocument(
      'paysphere-employees',
      'e1',
      { fullName: 'Priya', tenantId: OTHER_TENANT },
      TENANT,
    );

    expect(client.index.mock.calls[0][0].document.tenantId).toBe(TENANT);
  });

  test('indexing without a tenant throws rather than writing an unscoped doc', async () => {
    // An unscoped document is invisible to its owner and matched by nobody,
    // with no error to explain why — worse than refusing the write.
    const client = makeFakeClient();
    const service = loadService(client);

    await expect(
      service.indexDocument('paysphere-employees', 'e1', { fullName: 'Priya' }),
    ).rejects.toThrow(service.MissingTenantError);
    expect(client.index).not.toHaveBeenCalled();
  });

  test('an index error is swallowed — indexing must not fail a write', async () => {
    const client = makeFakeClient();
    client.index.mockRejectedValue(new Error('cluster_block_exception'));
    const service = loadService(client);

    await expect(
      service.indexDocument('paysphere-employees', 'e1', {}, TENANT),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('removeDocument', () => {
  test('deletes by id and suppresses a 404', async () => {
    const client = makeFakeClient();
    const service = loadService(client);

    await service.removeDocument('paysphere-employees', 'e1');

    expect(client.delete).toHaveBeenCalledWith({
      index: 'paysphere-employees',
      id: 'e1',
      ignore: [404],
    });
  });

  test('a delete error is swallowed', async () => {
    const client = makeFakeClient();
    client.delete.mockRejectedValue(new Error('nope'));
    const service = loadService(client);

    await expect(
      service.removeDocument('paysphere-employees', 'e1'),
    ).resolves.toBeUndefined();
  });
});
