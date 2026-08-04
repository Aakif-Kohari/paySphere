const mongoose = require('mongoose');
const {
  MissingTenantError,
  isUsableTenantId,
  getTenantId,
  requireTenant,
  tenantFilter,
  requireTenantScope,
} = require('../tenantScope');

const anId = () => new mongoose.Types.ObjectId();

/**
 * The premise of the whole module, asserted first so the rest of the suite has
 * a reason to exist: an undefined tenant does not narrow a query, it vanishes
 * from it. That is the behaviour #585 shipped on top of.
 *
 * The assertion is made against BSON serialisation rather than `getFilter()`,
 * because that is where the key is actually dropped. `getFilter()` still shows
 * `tenantId: undefined` and so does mongoose's cast — it is the driver that
 * omits undefined values when it encodes the filter for the wire. The query
 * that reaches the server has no tenant clause at all.
 */
describe('the mongoose behaviour tenantScope exists to prevent (#612)', () => {
  // The driver mongoose is actually going to hand the filter to, reached
  // through mongoose rather than a direct `require('mongodb')` — the backend
  // does not depend on the driver package directly.
  const { BSON } = mongoose.mongo;

  /** What the server actually receives for a given filter. */
  const onTheWire = (filter) => BSON.deserialize(BSON.serialize(filter));

  test('an undefined tenant is dropped from the filter, not matched against', () => {
    const sent = onTheWire({ tenantId: undefined, deletedAt: null });

    expect(sent).toEqual({ deletedAt: null });
    expect('tenantId' in sent).toBe(false);
  });

  test('a filter of nothing but an undefined tenant matches the whole collection', () => {
    expect(onTheWire({ tenantId: undefined })).toEqual({});
  });

  test('null survives, which is why null is not a safe stand-in either', () => {
    // It matches only rows that have no tenant — every row written before #585.
    expect(onTheWire({ tenantId: null })).toEqual({ tenantId: null });
  });

  test('mongoose keeps the undefined key right up to the driver, so nothing upstream catches it', () => {
    const Scoped = mongoose.model(
      'TenantScopeProbe',
      new mongoose.Schema({
        tenantId: mongoose.Schema.Types.ObjectId,
        deletedAt: Date,
      }),
    );

    // No cast error, no validation, no warning — the query looks well formed
    // all the way down.
    expect(
      Object.keys(Scoped.find({ tenantId: undefined, deletedAt: null }).getFilter()),
    ).toEqual(['tenantId', 'deletedAt']);
  });
});

describe('isUsableTenantId (#612)', () => {
  test('accepts an ObjectId', () => {
    expect(isUsableTenantId(anId())).toBe(true);
  });

  test('accepts a 24-character hex string', () => {
    expect(isUsableTenantId(anId().toString())).toBe(true);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a non-id string', 'not-an-id'],
  ])('rejects %s', (_label, value) => {
    expect(isUsableTenantId(value)).toBe(false);
  });

  test.each(['undefined', 'null'])(
    'rejects the literal string %p, which is what interpolating a missing id produces',
    (value) => {
      expect(isUsableTenantId(value)).toBe(false);
    },
  );
});

describe('getTenantId (#612)', () => {
  test('returns the tenant when the request carries one', () => {
    const tenantId = anId();

    expect(getTenantId({ tenantId })).toBe(tenantId);
  });

  test('returns null rather than the unusable value', () => {
    expect(getTenantId({ tenantId: undefined })).toBeNull();
    expect(getTenantId({})).toBeNull();
    expect(getTenantId(null)).toBeNull();
  });
});

describe('requireTenant (#612)', () => {
  test('returns the tenant id', () => {
    const tenantId = anId();

    expect(requireTenant({ tenantId })).toBe(tenantId);
  });

  test('throws rather than letting the caller proceed unscoped', () => {
    expect(() => requireTenant({})).toThrow(MissingTenantError);
  });

  test('the error carries a 403, so the handler is refused and not reported as a crash', () => {
    try {
      requireTenant({});
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.name).toBe('MissingTenantError');
      expect(error.status).toBe(403);
    }
  });
});

describe('tenantFilter (#612)', () => {
  test('scopes the filter to the request tenant', () => {
    const tenantId = anId();

    expect(tenantFilter({ tenantId })).toEqual({ tenantId });
  });

  test('keeps the caller clauses alongside the tenant', () => {
    const tenantId = anId();

    expect(tenantFilter({ tenantId }, { status: 'paid', deletedAt: null })).toEqual({
      status: 'paid',
      deletedAt: null,
      tenantId,
    });
  });

  test('a client-supplied tenantId cannot widen the scope', () => {
    const tenantId = anId();
    const someoneElse = anId();

    // `tenantFilter(req, req.query)` has to be safe, because that is how a
    // filtered list endpoint is naturally written.
    const filter = tenantFilter({ tenantId }, { tenantId: someoneElse });

    expect(filter.tenantId).toBe(tenantId);
    expect(filter.tenantId).not.toBe(someoneElse);
  });

  test('throws instead of returning a filter that matches everything', () => {
    expect(() => tenantFilter({}, { deletedAt: null })).toThrow(MissingTenantError);
  });
});

describe('requireTenantScope middleware (#612)', () => {
  const runGuard = (req) => {
    const res = {
      statusCode: undefined,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    const next = jest.fn();

    requireTenantScope()(req, res, next);

    return { res, next };
  };

  test('passes a scoped request through', () => {
    const { res, next } = runGuard({ tenantId: anId() });

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
  });

  test('refuses an unscoped request with 403', () => {
    const { res, next } = runGuard({});

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('the refusal tells the user what to do rather than leaking the internals', () => {
    const { res } = runGuard({});

    expect(res.body.message).toMatch(/sign in again/i);
    expect(res.body.message).not.toMatch(/tenantId/);
  });
});
