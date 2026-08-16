/**
 * Travel endpoints (#1077).
 *
 * The engine is covered in `utils/__tests__/perDiemCalculator.test.js`. What is
 * checked here is what the controller decides:
 *
 *   - approval refuses a breach unless it is explicitly acknowledged,
 *   - the violations found at approval are snapshotted, not recomputed,
 *   - an advance above the policy ceiling is refused, and released only once,
 *   - settlement recomputes the per-diem rather than trusting the body,
 *   - a trip settles once,
 *   - the self-service path resolves the employee from the session.
 */

jest.mock('../../models/travel.model', () => ({
  TravelPolicy: {
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  TravelRequest: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  TravelSettlement: { find: jest.fn(), create: jest.fn() },
}));
jest.mock('../../models/employee.model', () => ({ findOne: jest.fn() }));
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
  AUDIT_LOG_EVENT: 'AUDIT_LOG',
}));

const {
  TravelPolicy,
  TravelRequest,
  TravelSettlement,
} = require('../../models/travel.model');
const Employee = require('../../models/employee.model');
const {
  upsertPolicy,
  createRequest,
  approveRequest,
  rejectRequest,
  releaseAdvance,
  settleRequest,
  getOutstandingAdvances,
  getMyTrips,
} = require('../travel.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const REQUEST = '607f1f77bcf86cd7994390a1';
const EMPLOYEE = '607f1f77bcf86cd7994390b2';

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

const leanResolving = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const selectLeanResolving = (value) => ({
  select: jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const sortLeanResolving = (value) => ({
  sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

const policyDoc = (overrides = {}) => ({
  _id: 'p1',
  tenantId: TENANT,
  grade: 'M3',
  perDiemRates: { A: 3000, B: 2000, C: 1200, International: 8000 },
  lodgingCaps: { A: 8000, B: 5000, C: 3000, International: 20000 },
  cityClasses: { A: ['Mumbai'], B: ['Pune'], C: [] },
  defaultCityClass: 'C',
  permittedClasses: { Air: 'Economy', Rail: 'AC2', Road: 'Taxi' },
  partDayRule: 'half',
  advanceCeilingPercent: 80,
  currency: 'INR',
  isActive: true,
  ...overrides,
});

const legFixture = (overrides = {}) => ({
  fromCity: 'Chennai',
  toCity: 'Mumbai',
  departureAt: new Date('2026-09-01T09:00:00.000Z'),
  returnAt: new Date('2026-09-03T18:00:00.000Z'),
  mode: 'Air',
  travelClass: 'Economy',
  lodgingPerNight: 6000,
  ...overrides,
});

const requestDoc = (overrides = {}) => ({
  _id: REQUEST,
  tenantId: TENANT,
  employeeId: EMPLOYEE,
  grade: 'M3',
  purpose: 'Client visit',
  legs: [legFixture()],
  estimatedCost: 50000,
  advanceRequested: 0,
  advanceReleased: 0,
  advanceReleasedAt: null,
  status: 'Submitted',
  policyViolations: [],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('upsertPolicy', () => {
  it('upserts rather than refusing a second write for the same grade', async () => {
    // A policy is per grade and there is exactly one of them, so a second POST
    // is an edit; answering 409 would leave no way to change a rate.
    TravelPolicy.findOneAndUpdate.mockResolvedValue(policyDoc());

    const res = makeRes();
    await upsertPolicy(
      makeReq({ body: { grade: 'M3', perDiemRates: { A: 3500 } } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(TravelPolicy.findOneAndUpdate).toHaveBeenCalledWith(
      { tenantId: TENANT, grade: 'M3' },
      expect.anything(),
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
  });

  it('requires a grade', async () => {
    const res = makeRes();
    await upsertPolicy(makeReq({ body: {} }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TravelPolicy.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('createRequest', () => {
  const body = {
    purpose: 'Client visit',
    legs: [legFixture()],
    estimatedCost: 50000,
  };

  it('falls back to the caller own employee record when no id is sent', async () => {
    // This is what makes the self-service path safe: there is nothing to
    // substitute.
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, fullName: 'Asha Rao', grade: 'M3' }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelRequest.create.mockResolvedValue(requestDoc());

    await createRequest(makeReq({ body }), makeRes(), jest.fn());

    expect(Employee.findOne).toHaveBeenCalledWith({
      userId: USER,
      tenantId: TENANT,
    });
  });

  it('returns an estimated per-diem without storing it', async () => {
    // The trip has not happened and the legs will move; a stored estimate would
    // be mistaken for an entitlement.
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, grade: 'M3' }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelRequest.create.mockResolvedValue(requestDoc());

    const res = makeRes();
    await createRequest(makeReq({ body }), res, jest.fn());

    expect(res.json.mock.calls[0][0].estimatedPerDiem.total).toBe(9000);
    expect(TravelRequest.create.mock.calls[0][0].perDiem).toBeUndefined();
  });

  it('reports a missing policy as null rather than a zero entitlement', async () => {
    // Zero reads as "you are entitled to nothing"; the truth is "nobody has set
    // a policy for your grade".
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, grade: 'M9' }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(null));
    TravelRequest.create.mockResolvedValue(requestDoc({ grade: 'M9' }));

    const res = makeRes();
    await createRequest(makeReq({ body }), res, jest.fn());

    expect(res.json.mock.calls[0][0].estimatedPerDiem).toBeNull();
    expect(res.json.mock.calls[0][0].policyFound).toBe(false);
  });

  it('requires a purpose and at least one leg', async () => {
    const res = makeRes();
    await createRequest(
      makeReq({ body: { purpose: 'X', legs: [] } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TravelRequest.create).not.toHaveBeenCalled();
  });
});

describe('approveRequest', () => {
  it('approves a compliant trip', async () => {
    const request = requestDoc();
    TravelRequest.findOne.mockResolvedValue(request);
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    const res = makeRes();
    await approveRequest(makeReq({ params: { id: REQUEST } }), res, jest.fn());

    expect(request.status).toBe('Approved');
    expect(request.approvedBy).toBe(USER);
    expect(res.json.mock.calls[0][0].perDiem.total).toBe(9000);
  });

  it('refuses a breach until it is explicitly acknowledged', async () => {
    // An approver may knowingly authorise a business-class ticket. What they may
    // not do is authorise one without being told.
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({ legs: [legFixture({ travelClass: 'Business' })] }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    const res = makeRes();
    await approveRequest(makeReq({ params: { id: REQUEST } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].violations[0].type).toBe(
      'travel-class-above-entitlement',
    );
  });

  it('approves a breach that was acknowledged', async () => {
    const request = requestDoc({
      legs: [legFixture({ travelClass: 'Business' })],
    });
    TravelRequest.findOne.mockResolvedValue(request);
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    await approveRequest(
      makeReq({
        params: { id: REQUEST },
        body: { acknowledgeViolations: true },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(request.status).toBe('Approved');
  });

  it('snapshots the violations onto the request', async () => {
    // Amending the policy afterwards must not make an approved breach look
    // compliant in hindsight.
    const request = requestDoc({
      legs: [legFixture({ travelClass: 'Business' })],
    });
    TravelRequest.findOne.mockResolvedValue(request);
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    await approveRequest(
      makeReq({
        params: { id: REQUEST },
        body: { acknowledgeViolations: true },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(request.policyViolations).toHaveLength(1);
  });

  it('refuses when no policy exists for the grade', async () => {
    TravelRequest.findOne.mockResolvedValue(requestDoc({ grade: 'M9' }));
    TravelPolicy.findOne.mockReturnValue(leanResolving(null));

    const res = makeRes();
    await approveRequest(makeReq({ params: { id: REQUEST } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(
      /No active travel policy/,
    );
  });

  it('refuses to approve a trip that is not submitted', async () => {
    TravelRequest.findOne.mockResolvedValue(requestDoc({ status: 'Approved' }));

    const res = makeRes();
    await approveRequest(makeReq({ params: { id: REQUEST } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('rejectRequest', () => {
  it('records the reason', async () => {
    const request = requestDoc();
    TravelRequest.findOne.mockResolvedValue(request);

    await rejectRequest(
      makeReq({
        params: { id: REQUEST },
        body: { reason: 'Not budgeted this quarter' },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(request.status).toBe('Rejected');
    expect(request.rejectionReason).toBe('Not budgeted this quarter');
  });

  it('requires a reason', async () => {
    const res = makeRes();
    await rejectRequest(
      makeReq({ params: { id: REQUEST }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TravelRequest.findOne).not.toHaveBeenCalled();
  });
});

describe('releaseAdvance', () => {
  it('releases an advance within the ceiling', async () => {
    const request = requestDoc({ status: 'Approved' });
    TravelRequest.findOne.mockResolvedValue(request);
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    await releaseAdvance(
      makeReq({ params: { id: REQUEST }, body: { amount: 40000 } }),
      makeRes(),
      jest.fn(),
    );

    expect(request.advanceReleased).toBe(40000);
    expect(request.advanceReleasedAt).toBeInstanceOf(Date);
  });

  it('refuses an advance above the policy ceiling, with the ceiling', async () => {
    TravelRequest.findOne.mockResolvedValue(requestDoc({ status: 'Approved' }));
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    const res = makeRes();
    await releaseAdvance(
      makeReq({ params: { id: REQUEST }, body: { amount: 45000 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].ceiling).toBe(40000);
  });

  it('refuses a second release against the same trip', async () => {
    // Two advances against one trip is the shape a double payment takes.
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({ status: 'Approved', advanceReleased: 20000 }),
    );

    const res = makeRes();
    await releaseAdvance(
      makeReq({ params: { id: REQUEST }, body: { amount: 10000 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses an advance against a trip that was never approved', async () => {
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({ status: 'Submitted' }),
    );

    const res = makeRes();
    await releaseAdvance(
      makeReq({ params: { id: REQUEST }, body: { amount: 10000 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects a non-positive amount', async () => {
    const res = makeRes();
    await releaseAdvance(
      makeReq({ params: { id: REQUEST }, body: { amount: 0 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(TravelRequest.findOne).not.toHaveBeenCalled();
  });
});

describe('settleRequest', () => {
  it('recomputes the per-diem rather than trusting the body', async () => {
    // Per-diem is an entitlement, not a claim. Letting a claimant state it would
    // make the whole calculator decorative.
    const request = requestDoc({ status: 'Approved', advanceReleased: 40000 });
    TravelRequest.findOne.mockResolvedValue(request);
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelSettlement.create.mockResolvedValue({ _id: 's1' });

    await settleRequest(
      makeReq({
        params: { id: REQUEST },
        body: { actuals: { airfare: 18000 }, perDiemEntitlement: 999999 },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(TravelSettlement.create.mock.calls[0][0].perDiemEntitlement).toBe(
      9000,
    );
  });

  it('produces a recovery when the advance exceeded the spend', async () => {
    const request = requestDoc({ status: 'Approved', advanceReleased: 40000 });
    TravelRequest.findOne.mockResolvedValue(request);
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelSettlement.create.mockResolvedValue({ _id: 's1' });

    const res = makeRes();
    await settleRequest(
      makeReq({
        params: { id: REQUEST },
        body: { actuals: { airfare: 18000, lodging: 4500 } },
      }),
      res,
      jest.fn(),
    );

    const outcome = res.json.mock.calls[0][0].outcome;
    expect(outcome.type).toBe('recovery');
    expect(outcome.recoveryAmount).toBe(8500);
    expect(request.status).toBe('Settled');
  });

  it('produces a reimbursement when the spend exceeded the advance', async () => {
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({ status: 'Approved', advanceReleased: 20000 }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelSettlement.create.mockResolvedValue({ _id: 's1' });

    const res = makeRes();
    await settleRequest(
      makeReq({
        params: { id: REQUEST },
        body: { actuals: { airfare: 25000 } },
      }),
      res,
      jest.fn(),
    );

    expect(res.json.mock.calls[0][0].outcome.type).toBe('reimbursement');
  });

  it('stores the per-leg breakdown alongside the total', async () => {
    // So an employee disputing a per-diem can be shown how it was arrived at.
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({ status: 'Approved', advanceReleased: 0 }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelSettlement.create.mockResolvedValue({ _id: 's1' });

    await settleRequest(
      makeReq({ params: { id: REQUEST }, body: { actuals: {} } }),
      makeRes(),
      jest.fn(),
    );

    expect(
      TravelSettlement.create.mock.calls[0][0].perDiemBreakdown,
    ).toHaveLength(1);
  });

  it('refuses to settle a trip that was never approved', async () => {
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({ status: 'Submitted' }),
    );

    const res = makeRes();
    await settleRequest(
      makeReq({ params: { id: REQUEST }, body: { actuals: {} } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses a second settlement against the same trip', async () => {
    TravelRequest.findOne.mockResolvedValue(requestDoc({ status: 'Approved' }));
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));
    TravelSettlement.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    await settleRequest(
      makeReq({ params: { id: REQUEST }, body: { actuals: {} } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/already been settled/);
  });

  it('422s rather than 500s when the per-diem cannot be computed', async () => {
    TravelRequest.findOne.mockResolvedValue(
      requestDoc({
        status: 'Approved',
        legs: [legFixture({ returnAt: 'whenever' })],
      }),
    );
    TravelPolicy.findOne.mockReturnValue(leanResolving(policyDoc()));

    const res = makeRes();
    await settleRequest(
      makeReq({ params: { id: REQUEST }, body: { actuals: {} } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(422);
  });
});

describe('getOutstandingAdvances', () => {
  it('reports the ledger with ageing buckets', async () => {
    TravelRequest.find.mockReturnValue(
      leanResolving([
        {
          _id: 'r1',
          employeeId: EMPLOYEE,
          advanceReleased: 40000,
          advanceReleasedAt: new Date('2026-05-01'),
        },
      ]),
    );
    TravelSettlement.find.mockReturnValue(selectLeanResolving([]));

    const res = makeRes();
    await getOutstandingAdvances(
      makeReq({ query: { asOf: '2026-09-30T00:00:00.000Z' } }),
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.totalOutstanding).toBe(40000);
    expect(body.byBucket['90+']).toBe(40000);
  });

  it('only queries trips that were actually funded', async () => {
    TravelRequest.find.mockReturnValue(leanResolving([]));
    TravelSettlement.find.mockReturnValue(selectLeanResolving([]));

    await getOutstandingAdvances(makeReq(), makeRes(), jest.fn());

    expect(TravelRequest.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      advanceReleased: { $gt: 0 },
    });
  });
});

describe('getMyTrips', () => {
  it('resolves the employee from the session, never from a parameter', async () => {
    Employee.findOne.mockReturnValue(
      selectLeanResolving({ _id: EMPLOYEE, fullName: 'Asha Rao' }),
    );
    TravelRequest.find.mockReturnValue(sortLeanResolving([]));
    TravelSettlement.find.mockReturnValue(leanResolving([]));

    await getMyTrips(
      makeReq({ query: { employeeId: 'someone-else' } }),
      makeRes(),
      jest.fn(),
    );

    expect(Employee.findOne).toHaveBeenCalledWith({
      userId: USER,
      tenantId: TENANT,
    });
    expect(TravelRequest.find).toHaveBeenCalledWith({
      tenantId: TENANT,
      employeeId: EMPLOYEE,
    });
  });

  it('totals the advance the employee still owes', async () => {
    Employee.findOne.mockReturnValue(selectLeanResolving({ _id: EMPLOYEE }));
    TravelRequest.find.mockReturnValue(
      sortLeanResolving([
        { _id: 'r1', advanceReleased: 40000 },
        { _id: 'r2', advanceReleased: 15000 },
      ]),
    );
    TravelSettlement.find.mockReturnValue(leanResolving([{ requestId: 'r2' }]));

    const res = makeRes();
    await getMyTrips(makeReq(), res, jest.fn());

    expect(res.json.mock.calls[0][0].outstandingAdvance).toBe(40000);
  });

  it('404s when the account is not linked to an employee record', async () => {
    Employee.findOne.mockReturnValue(selectLeanResolving(null));

    const res = makeRes();
    await getMyTrips(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
