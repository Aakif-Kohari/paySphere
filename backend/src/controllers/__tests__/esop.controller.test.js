/**
 * ESOP endpoints (#1073).
 *
 * The engine's arithmetic is covered next door in
 * `utils/__tests__/vestingCalculator.test.js`. What is checked here is the four
 * refusals the controller exists for, because each of them is a rule that
 * cannot be expressed in a schema:
 *
 *   - a grant that would take the scheme past its authorised pool,
 *   - an exercise of more options than have vested,
 *   - an exercise against a forfeited grant, or after the post-termination
 *     window has closed,
 *   - a self-service route resolving the employee from the session rather than
 *     from a parameter.
 *
 * Models are stubbed. This is about the decisions, not about Mongoose.
 */

jest.mock('../../models/esop.model', () => ({
  EsopScheme: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  EsopGrant: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  EsopExercise: { create: jest.fn(), find: jest.fn() },
}));
jest.mock('../../models/employee.model', () => ({ findOne: jest.fn() }));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  EsopScheme,
  EsopGrant,
  EsopExercise,
} = require('../../models/esop.model');
const Employee = require('../../models/employee.model');
const {
  createScheme,
  getSchemes,
  createGrant,
  getGrants,
  getVestingSchedule,
  exerciseOptions,
  forfeitGrant,
  getMyGrants,
} = require('../esop.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const SCHEME = '607f1f77bcf86cd7994390a1';
const EMPLOYEE = '607f1f77bcf86cd7994390b2';
const GRANT = '607f1f77bcf86cd7994390c3';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  tenantId: TENANT,
  userId: USER,
  body: {},
  params: {},
  query: {},
  ...overrides,
});

/** A find() whose result is reached through `.lean()`. */
const leanResolving = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

/** A find() whose result is reached through `.populate().lean()`. */
const populateLeanResolving = (value) => ({
  populate: jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

/** A find() whose result is reached through `.select().lean()`. */
const selectLeanResolving = (value) => ({
  select: jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

/** A find() whose result is reached through `.sort().lean()`. */
const sortLeanResolving = (value) => ({
  sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

const activeScheme = (overrides = {}) => ({
  _id: SCHEME,
  tenantId: TENANT,
  name: 'ESOP 2024',
  authorisedPool: 10000,
  isActive: true,
  defaultCliffMonths: 12,
  defaultVestingDurationMonths: 48,
  defaultVestingFrequency: 'monthly',
  postTerminationExerciseWindowDays: 90,
  ...overrides,
});

/** A saveable grant document, as `findOne` (without `.lean()`) returns one. */
const grantDoc = (overrides = {}) => ({
  _id: GRANT,
  tenantId: TENANT,
  schemeId: SCHEME,
  employeeId: EMPLOYEE,
  grantReference: 'G-001',
  optionsGranted: 1000,
  exercisePrice: 10,
  grantDate: new Date('2024-01-01T00:00:00.000Z'),
  vestingStartDate: new Date('2024-01-01T00:00:00.000Z'),
  cliffMonths: 12,
  vestingDurationMonths: 48,
  vestingFrequency: 'monthly',
  optionsExercised: 0,
  optionsForfeited: 0,
  status: 'Active',
  exerciseWindowClosesOn: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createScheme', () => {
  it('creates a scheme and returns 201', async () => {
    EsopScheme.create.mockResolvedValue({ _id: SCHEME, name: 'ESOP 2024' });

    const res = makeRes();
    await createScheme(
      makeReq({ body: { name: 'ESOP 2024', authorisedPool: 10000 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(EsopScheme.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, authorisedPool: 10000 }),
    );
  });

  it('rejects a scheme with no authorised pool', async () => {
    const res = makeRes();
    await createScheme(
      makeReq({ body: { name: 'ESOP 2024' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(EsopScheme.create).not.toHaveBeenCalled();
  });

  it('turns a duplicate-key error into a 409 rather than a 500', async () => {
    EsopScheme.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    const next = jest.fn();
    await createScheme(
      makeReq({ body: { name: 'ESOP 2024', authorisedPool: 100 } }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('getSchemes', () => {
  it('returns each scheme with its pool position', async () => {
    // The first question about a scheme is always how much of it is left, so a
    // scheme without a pool summary is not useful to a caller.
    EsopScheme.find.mockReturnValue(leanResolving([activeScheme()]));
    EsopGrant.find.mockReturnValue(
      selectLeanResolving([
        {
          schemeId: SCHEME,
          optionsGranted: 4000,
          optionsExercised: 0,
          optionsForfeited: 0,
        },
      ]),
    );

    const res = makeRes();
    await getSchemes(makeReq(), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.schemes[0].pool.optionsAvailable).toBe(6000);
  });

  it('scopes the query to the caller tenant', async () => {
    EsopScheme.find.mockReturnValue(leanResolving([]));
    EsopGrant.find.mockReturnValue(selectLeanResolving([]));

    await getSchemes(makeReq(), makeRes(), jest.fn());

    expect(EsopScheme.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });
});

describe('createGrant', () => {
  const validBody = {
    schemeId: SCHEME,
    employeeId: EMPLOYEE,
    grantReference: 'G-001',
    optionsGranted: 1000,
    exercisePrice: 10,
    grantDate: '2024-01-01',
  };

  it('issues a grant the pool can absorb', async () => {
    EsopScheme.findOne.mockResolvedValue(activeScheme());
    Employee.findOne.mockResolvedValue({ _id: EMPLOYEE });
    EsopGrant.find.mockReturnValue(selectLeanResolving([]));
    EsopGrant.create.mockResolvedValue({ _id: GRANT, ...validBody });

    const res = makeRes();
    await createGrant(makeReq({ body: validBody }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('refuses a grant that would take the scheme past its authorised pool', async () => {
    // Not a validation nicety: the company would have promised more equity than
    // the board authorised.
    EsopScheme.findOne.mockResolvedValue(
      activeScheme({ authorisedPool: 1000 }),
    );
    Employee.findOne.mockResolvedValue({ _id: EMPLOYEE });
    EsopGrant.find.mockReturnValue(
      selectLeanResolving([
        { optionsGranted: 900, optionsExercised: 0, optionsForfeited: 0 },
      ]),
    );

    const res = makeRes();
    await createGrant(makeReq({ body: validBody }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain(
      '100 options available',
    );
    expect(EsopGrant.create).not.toHaveBeenCalled();
  });

  it('inherits vesting terms from the scheme when the body omits them', async () => {
    EsopScheme.findOne.mockResolvedValue(
      activeScheme({
        defaultCliffMonths: 6,
        defaultVestingFrequency: 'quarterly',
      }),
    );
    Employee.findOne.mockResolvedValue({ _id: EMPLOYEE });
    EsopGrant.find.mockReturnValue(selectLeanResolving([]));
    EsopGrant.create.mockResolvedValue({ _id: GRANT });

    await createGrant(makeReq({ body: validBody }), makeRes(), jest.fn());

    expect(EsopGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cliffMonths: 6,
        vestingFrequency: 'quarterly',
      }),
    );
  });

  it('rejects vesting terms that would never vest anything', async () => {
    EsopScheme.findOne.mockResolvedValue(activeScheme());
    Employee.findOne.mockResolvedValue({ _id: EMPLOYEE });
    EsopGrant.find.mockReturnValue(selectLeanResolving([]));

    const res = makeRes();
    await createGrant(
      makeReq({
        body: { ...validBody, cliffMonths: 60, vestingDurationMonths: 48 },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors.join(' ')).toMatch(/exceeds/);
  });

  it('refuses to grant against a closed scheme', async () => {
    EsopScheme.findOne.mockResolvedValue(activeScheme({ isActive: false }));

    const res = makeRes();
    await createGrant(makeReq({ body: validBody }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('404s on a scheme belonging to another tenant', async () => {
    // The tenant is in the filter, so a foreign scheme simply does not match.
    EsopScheme.findOne.mockResolvedValue(null);

    const res = makeRes();
    await createGrant(makeReq({ body: validBody }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(EsopScheme.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT }),
    );
  });

  it('rejects a malformed id before touching the database', async () => {
    const res = makeRes();
    await createGrant(
      makeReq({ body: { ...validBody, schemeId: 'not-an-id' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(EsopScheme.findOne).not.toHaveBeenCalled();
  });
});

describe('getGrants', () => {
  it('attaches a vesting position computed at the requested date', async () => {
    EsopGrant.find.mockReturnValue(populateLeanResolving([grantDoc()]));

    const res = makeRes();
    await getGrants(makeReq({ query: { asOf: '2025-01-01' } }), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.grants[0].position.vested).toBe(240);
  });

  it('ignores an employeeId filter that is not a valid id', async () => {
    // Passing it straight into the filter would make Mongoose throw a
    // CastError, which surfaces as a 500 for what is a bad request.
    EsopGrant.find.mockReturnValue(populateLeanResolving([]));

    await getGrants(
      makeReq({ query: { employeeId: 'nope' } }),
      makeRes(),
      jest.fn(),
    );

    expect(EsopGrant.find).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  it('falls back to now when asOf is unparseable', async () => {
    // An Invalid Date compares false against every tranche and would silently
    // report nothing as vested.
    EsopGrant.find.mockReturnValue(populateLeanResolving([grantDoc()]));

    const res = makeRes();
    await getGrants(
      makeReq({ query: { asOf: 'yesterday-ish' } }),
      res,
      jest.fn(),
    );

    expect(Number.isNaN(res.json.mock.calls[0][0].asOf.getTime())).toBe(false);
  });
});

describe('getVestingSchedule', () => {
  it('returns the tranches and the position', async () => {
    EsopGrant.findOne.mockReturnValue(leanResolving(grantDoc()));

    const res = makeRes();
    await getVestingSchedule(
      makeReq({ params: { id: GRANT }, query: { asOf: '2025-06-01' } }),
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.tranches).toHaveLength(37);
    expect(body.position.vested).toBe(340); // cliff 240 + 5 monthly tranches
  });

  it('422s rather than 500s on a stored grant with unusable terms', async () => {
    // A data problem, not a client one. A 500 would be wrong and so would
    // quietly reporting that the grant vests nothing.
    EsopGrant.findOne.mockReturnValue(
      leanResolving(grantDoc({ cliffMonths: 99 })),
    );

    const res = makeRes();
    await getVestingSchedule(
      makeReq({ params: { id: GRANT } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('404s on a grant in another tenant', async () => {
    EsopGrant.findOne.mockReturnValue(leanResolving(null));

    const res = makeRes();
    await getVestingSchedule(
      makeReq({ params: { id: GRANT } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('exerciseOptions', () => {
  const body = {
    optionsToExercise: 100,
    fmvPerShare: 250,
    exerciseDate: '2025-01-01',
    taxRatePercent: 30,
  };

  it('records the exercise, the perquisite and the TDS', async () => {
    const grant = grantDoc();
    EsopGrant.findOne.mockResolvedValue(grant);
    EsopExercise.create.mockResolvedValue({ _id: 'ex1' });

    const res = makeRes();
    await exerciseOptions(
      makeReq({ params: { id: GRANT }, body }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(EsopExercise.create).toHaveBeenCalledWith(
      expect.objectContaining({ perquisiteValue: 24000, tdsWithheld: 7200 }),
    );
    expect(grant.optionsExercised).toBe(100);
    expect(grant.save).toHaveBeenCalled();
  });

  it('refuses to exercise more options than have vested', async () => {
    // 240 vested at the cliff; 500 asked for.
    EsopGrant.findOne.mockResolvedValue(grantDoc());

    const res = makeRes();
    await exerciseOptions(
      makeReq({
        params: { id: GRANT },
        body: { ...body, optionsToExercise: 500 },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Only 240 options');
    expect(EsopExercise.create).not.toHaveBeenCalled();
  });

  it('counts earlier exercises against what is left', async () => {
    EsopGrant.findOne.mockResolvedValue(grantDoc({ optionsExercised: 200 }));

    const res = makeRes();
    await exerciseOptions(
      makeReq({
        params: { id: GRANT },
        body: { ...body, optionsToExercise: 100 },
      }),
      res,
      jest.fn(),
    );

    // 240 vested, 200 already taken up, so only 40 remain exercisable.
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Only 40 options');
  });

  it('refuses an exercise against a forfeited grant', async () => {
    EsopGrant.findOne.mockResolvedValue(grantDoc({ status: 'Forfeited' }));

    const res = makeRes();
    await exerciseOptions(
      makeReq({ params: { id: GRANT }, body }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses an exercise after the post-termination window has closed', async () => {
    EsopGrant.findOne.mockResolvedValue(
      grantDoc({ exerciseWindowClosesOn: new Date('2024-12-01') }),
    );

    const res = makeRes();
    await exerciseOptions(
      makeReq({ params: { id: GRANT }, body }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/window .* has closed/);
  });

  it('allows an exercise inside the window', async () => {
    EsopGrant.findOne.mockResolvedValue(
      grantDoc({ exerciseWindowClosesOn: new Date('2025-04-01') }),
    );
    EsopExercise.create.mockResolvedValue({ _id: 'ex1' });

    const res = makeRes();
    await exerciseOptions(
      makeReq({ params: { id: GRANT }, body }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('marks the grant fully exercised when nothing is left', async () => {
    const grant = grantDoc({ optionsExercised: 900 });
    EsopGrant.findOne.mockResolvedValue(grant);
    EsopExercise.create.mockResolvedValue({ _id: 'ex1' });

    const res = makeRes();
    await exerciseOptions(
      makeReq({
        params: { id: GRANT },
        body: { ...body, optionsToExercise: 100, exerciseDate: '2028-06-01' },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(grant.status).toBe('FullyExercised');
  });

  it('records a zero perquisite for an underwater exercise rather than a negative one', async () => {
    EsopGrant.findOne.mockResolvedValue(grantDoc());
    EsopExercise.create.mockResolvedValue({ _id: 'ex1' });

    const res = makeRes();
    await exerciseOptions(
      makeReq({ params: { id: GRANT }, body: { ...body, fmvPerShare: 5 } }),
      res,
      jest.fn(),
    );

    expect(EsopExercise.create).toHaveBeenCalledWith(
      expect.objectContaining({ perquisiteValue: 0, tdsWithheld: 0 }),
    );
    expect(res.json.mock.calls[0][0].valuation.underwater).toBe(true);
  });

  it('rejects a non-positive quantity', async () => {
    const res = makeRes();
    await exerciseOptions(
      makeReq({
        params: { id: GRANT },
        body: { ...body, optionsToExercise: 0 },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(EsopGrant.findOne).not.toHaveBeenCalled();
  });

  it('rejects a missing FMV', async () => {
    // Without it there is no perquisite, and defaulting it to zero would record
    // a taxable event of zero on an in-the-money exercise.
    const res = makeRes();
    await exerciseOptions(
      makeReq({ params: { id: GRANT }, body: { optionsToExercise: 10 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('forfeitGrant', () => {
  it('lapses the unvested, retains the vested and stamps the deadline', async () => {
    const grant = grantDoc();
    EsopGrant.findOne.mockResolvedValue(grant);
    EsopScheme.findOne.mockReturnValue(leanResolving(activeScheme()));

    const res = makeRes();
    await forfeitGrant(
      makeReq({ params: { id: GRANT }, body: { exitDate: '2025-01-01' } }),
      res,
      jest.fn(),
    );

    expect(grant.optionsForfeited).toBe(760);
    expect(grant.exerciseWindowClosesOn.toISOString()).toContain('2025-04-01');
    expect(grant.status).toBe('Active'); // vested options survive the window
  });

  it('marks the grant forfeited outright when the holder leaves before the cliff', async () => {
    const grant = grantDoc();
    EsopGrant.findOne.mockResolvedValue(grant);
    EsopScheme.findOne.mockReturnValue(leanResolving(activeScheme()));

    await forfeitGrant(
      makeReq({ params: { id: GRANT }, body: { exitDate: '2024-06-01' } }),
      makeRes(),
      jest.fn(),
    );

    expect(grant.optionsForfeited).toBe(1000);
    expect(grant.status).toBe('Forfeited');
  });

  it('uses the scheme window when the body does not override it', async () => {
    const grant = grantDoc();
    EsopGrant.findOne.mockResolvedValue(grant);
    EsopScheme.findOne.mockReturnValue(
      leanResolving(activeScheme({ postTerminationExerciseWindowDays: 30 })),
    );

    await forfeitGrant(
      makeReq({ params: { id: GRANT }, body: { exitDate: '2025-01-01' } }),
      makeRes(),
      jest.fn(),
    );

    expect(grant.exerciseWindowClosesOn.toISOString()).toContain('2025-01-31');
  });

  it('refuses to forfeit a grant that is not active', async () => {
    EsopGrant.findOne.mockResolvedValue(grantDoc({ status: 'Forfeited' }));

    const res = makeRes();
    await forfeitGrant(
      makeReq({ params: { id: GRANT }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('getMyGrants', () => {
  it('resolves the employee from the session, never from a parameter', async () => {
    // The whole point of a self-service route. If this ever reads an id from
    // the request, one employee can read another's holding.
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, fullName: 'Asha Rao' }),
    );
    EsopGrant.find.mockReturnValue(leanResolving([grantDoc()]));
    EsopExercise.find.mockReturnValue(sortLeanResolving([]));

    const res = makeRes();
    await getMyGrants(
      makeReq({ query: { asOf: '2025-01-01', employeeId: 'someone-else' } }),
      res,
      jest.fn(),
    );

    expect(Employee.findOne).toHaveBeenCalledWith({
      userId: USER,
      tenantId: TENANT,
    });
    expect(EsopGrant.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      employeeId: EMPLOYEE,
    });
  });

  it('totals the position across grants', async () => {
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, fullName: 'Asha Rao' }),
    );
    EsopGrant.find.mockReturnValue(
      leanResolving([grantDoc(), grantDoc({ optionsGranted: 500 })]),
    );
    EsopExercise.find.mockReturnValue(sortLeanResolving([]));

    const res = makeRes();
    await getMyGrants(
      makeReq({ query: { asOf: '2025-01-01' } }),
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.totals.vested).toBe(240 + 120);
    expect(body.totals.exercisable).toBe(240 + 120);
  });

  it('404s when the account is not linked to an employee record', async () => {
    Employee.findOne.mockReturnValue(selectLeanResolving(null));

    const res = makeRes();
    await getMyGrants(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
