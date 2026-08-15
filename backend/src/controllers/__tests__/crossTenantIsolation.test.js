/**
 * Cross-tenant isolation on `:id` handlers (#1010).
 *
 * The bug these cover is always the same shape: an id arrives in the URL or the
 * request body, the handler fetches it with `findById`, and nothing anywhere
 * asks whether the document belongs to the caller's company. The id is the only
 * thing between one customer and another's data.
 *
 * Two properties are asserted for each handler, and both matter:
 *
 *   1. The tenant is part of the *query*. Not checked afterwards — in the
 *      query, so the row is unfetchable rather than fetched-and-discarded.
 *      A post-fetch check still reads the document, and anything that logs,
 *      counts, caches or throws in between has already touched it.
 *
 *   2. A cross-tenant id answers 404/403 and performs no write.
 *
 * The post-fetch checks that did exist were worse than absent, which is the
 * detail worth keeping in mind while reading these. `taxProof.verifyProof` and
 * `employee.toggleActive` both compared `doc.tenantId.toString()` against
 * `req.tenantId`, and `auth.middleware` sets `req.tenantId` from
 * `user.tenantId` — a mongoose ObjectId. A string primitive is never strictly
 * equal to an object, so the comparison was always true and both endpoints
 * refused everybody, including the tenant that owns the row. They failed closed
 * by luck; the same expression as a positive test fails open.
 */

const mongoose = require('mongoose');

jest.mock('../../models/taxProof.model');
jest.mock('../../models/employee.model');
jest.mock('../../models/appraisal.model', () => ({
  AppraisalCycle: { create: jest.fn(), findOne: jest.fn() },
  AppraisalGoal: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
  AppraisalReview: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../../models/grievance.model', () => ({
  Grievance: {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
  CaseNote: { create: jest.fn() },
  ICCCommittee: { findOne: jest.fn() },
}));
jest.mock('../../utils/cryptoAnonymizer', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(() => 'the plaintext complaint'),
  generateCaseNumber: jest.fn(() => 'POSH-2026-001'),
}));
jest.mock('../../services/event.service', () => ({ emit: jest.fn() }));
jest.mock('../../services/cache.service', () => ({
  invalidateAnalytics: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../models/payroll.model');
jest.mock('../../models/user.model');
jest.mock('../../models/settlement.model', () => ({
  exists: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

const bcrypt = require('bcryptjs');
const TaxProof = require('../../models/taxProof.model');
const Employee = require('../../models/employee.model');
const {
  AppraisalGoal,
  AppraisalReview,
} = require('../../models/appraisal.model');
const { Grievance, ICCCommittee } = require('../../models/grievance.model');
const eventBus = require('../../services/event.service');

const { verifyProof } = require('../taxProof.controller');
const {
  submitSelfReview,
  submitManagerReview,
} = require('../appraisal.controller');
const { decryptCase } = require('../grievance.controller');
const { toggleEmployeeStatus } = require('../employee.controller');

const oid = () => new mongoose.Types.ObjectId().toString();

const TENANT = oid();
const USER = oid();
const RESOURCE = oid();

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  params: { id: RESOURCE },
  body: {},
  userId: USER,
  tenantId: TENANT,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('taxProof.verifyProof', () => {
  it('puts the tenant in the query rather than checking afterwards', async () => {
    TaxProof.findOne.mockResolvedValue(null);

    await verifyProof(
      makeReq({ body: { status: 'Approved', approvedAmount: 100 } }),
      makeRes(),
      jest.fn(),
    );

    const [filter] = TaxProof.findOne.mock.calls[0];

    expect(filter).toMatchObject({ _id: RESOURCE, tenantId: TENANT });
  });

  it('404s for a proof that is not in the tenant', async () => {
    // The scoped query returns nothing, which is the whole mechanism.
    TaxProof.findOne.mockResolvedValue(null);
    const res = makeRes();

    await verifyProof(
      makeReq({ body: { status: 'Approved', approvedAmount: 100 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('lets the owning tenant through', async () => {
    // The regression test for the ObjectId-versus-string comparison. Before the
    // fix this answered 404 to the owner as well, so HR could not approve a
    // tax proof at all — and since verification decides how much TDS comes out
    // of a salary, that is a payroll bug wearing a security bug's clothes.
    const proof = {
      _id: RESOURCE,
      tenantId: TENANT,
      claimedAmount: 50000,
      save: jest.fn().mockResolvedValue(true),
    };
    TaxProof.findOne.mockResolvedValue(proof);
    const res = makeRes();

    await verifyProof(
      makeReq({ body: { status: 'Approved', approvedAmount: 50000 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(proof.save).toHaveBeenCalled();
  });

  it('does not write when the proof is out of tenant', async () => {
    const save = jest.fn();
    TaxProof.findOne.mockResolvedValue(null);

    await verifyProof(
      makeReq({ body: { status: 'Rejected', approvedAmount: 0 } }),
      makeRes(),
      jest.fn(),
    );

    expect(save).not.toHaveBeenCalled();
  });
});

describe('appraisal.submitSelfReview', () => {
  it('scopes the review lookup', async () => {
    AppraisalReview.findOne.mockResolvedValue(null);

    await submitSelfReview(
      makeReq({ body: { goalRatings: [] } }),
      makeRes(),
      jest.fn(),
    );

    const [filter] = AppraisalReview.findOne.mock.calls[0];

    expect(filter).toMatchObject({ _id: RESOURCE, tenantId: TENANT });
  });

  it('scopes each goal update to the tenant, the cycle and the employee', async () => {
    // The goal ids come from the request body, so they are exactly as
    // untrusted as the `:id` — and this path *writes*. Unscoped, it let a
    // caller rewrite the achievement figures on any goal in the database by
    // id, in any company, without ever touching a review they were entitled
    // to.
    const cycleId = oid();
    const employeeId = oid();
    const foreignGoal = oid();

    AppraisalReview.findOne.mockResolvedValue({
      _id: RESOURCE,
      tenantId: TENANT,
      cycleId,
      employeeId,
      status: 'Self-Review',
      save: jest.fn().mockResolvedValue(true),
    });
    AppraisalGoal.findOneAndUpdate.mockResolvedValue(null);

    await submitSelfReview(
      makeReq({
        body: { goalRatings: [{ goalId: foreignGoal, selfAchievement: 100 }] },
      }),
      makeRes(),
      jest.fn(),
    );

    const [filter] = AppraisalGoal.findOneAndUpdate.mock.calls[0];

    expect(filter).toMatchObject({
      _id: foreignGoal,
      tenantId: TENANT,
      cycleId,
      employeeId,
    });
  });

  it('never reaches findByIdAndUpdate', async () => {
    // The unscoped call this replaced. Asserted by absence because it is the
    // one thing that must not come back.
    AppraisalReview.findOne.mockResolvedValue({
      _id: RESOURCE,
      tenantId: TENANT,
      cycleId: oid(),
      employeeId: oid(),
      status: 'Self-Review',
      save: jest.fn().mockResolvedValue(true),
    });
    AppraisalGoal.findOneAndUpdate.mockResolvedValue(null);

    await submitSelfReview(
      makeReq({
        body: { goalRatings: [{ goalId: oid(), selfAchievement: 90 }] },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(AppraisalGoal.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a non-array goalRatings instead of throwing', async () => {
    // `for (const rating of goalRatings)` on a non-iterable is a TypeError and
    // a 500. The body is user input.
    AppraisalReview.findOne.mockResolvedValue({
      _id: RESOURCE,
      tenantId: TENANT,
      cycleId: oid(),
      employeeId: oid(),
      status: 'Self-Review',
      save: jest.fn(),
    });
    const res = makeRes();

    await submitSelfReview(
      makeReq({ body: { goalRatings: 'not-an-array' } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('appraisal.submitManagerReview', () => {
  it('scopes the review lookup', async () => {
    AppraisalReview.findOne.mockResolvedValue(null);

    await submitManagerReview(
      makeReq({ body: { goalRatings: [] } }),
      makeRes(),
      jest.fn(),
    );

    const [filter] = AppraisalReview.findOne.mock.calls[0];

    expect(filter).toMatchObject({ _id: RESOURCE, tenantId: TENANT });
  });

  it('scopes the goal re-read used to compute the final score', async () => {
    // `finalScore` and the recommended increment are derived from these rows.
    // An unscoped read here would let another company's goals influence this
    // company's pay recommendation.
    const cycleId = oid();
    const employeeId = oid();

    AppraisalReview.findOne.mockResolvedValue({
      _id: RESOURCE,
      tenantId: TENANT,
      cycleId,
      employeeId,
      status: 'Manager-Review',
      save: jest.fn().mockResolvedValue(true),
    });
    AppraisalGoal.findOneAndUpdate.mockResolvedValue(null);
    AppraisalGoal.find.mockResolvedValue([]);

    await submitManagerReview(
      makeReq({ body: { goalRatings: [], managerOverallRating: 4 } }),
      makeRes(),
      jest.fn(),
    );

    const [filter] = AppraisalGoal.find.mock.calls[0];

    expect(filter).toMatchObject({ tenantId: TENANT, cycleId, employeeId });
  });
});

describe('grievance.decryptCase', () => {
  const iccMember = () => ({
    _id: oid(),
    tenantId: TENANT,
    userId: USER,
    isActive: true,
    decryptionPinHash: '$2a$10$hash',
  });

  const grievance = () => ({
    _id: RESOURCE,
    tenantId: TENANT,
    caseNumber: 'POSH-2026-001',
    encryptedDescription: 'ciphertext:authtag',
    encryptionIV: 'iv',
  });

  it('scopes the case lookup', async () => {
    // `requireICC` proves the caller is on *their own* committee. It cannot
    // constrain which case id they then name, because that comes from the URL.
    Grievance.findOne.mockResolvedValue(null);

    await decryptCase(makeReq({ body: { pin: '1234' } }), makeRes(), jest.fn());

    const [filter] = Grievance.findOne.mock.calls[0];

    expect(filter).toMatchObject({ _id: RESOURCE, tenantId: TENANT });
  });

  it('404s for a case belonging to another company', async () => {
    Grievance.findOne.mockResolvedValue(null);
    const res = makeRes();

    await decryptCase(makeReq({ body: { pin: '1234' } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('refuses when the caller is not on the committee', async () => {
    // `iccMember` used to be fetched and then never read — if the lookup
    // returned null, execution carried straight on and decrypted anyway.
    Grievance.findOne.mockResolvedValue(grievance());
    ICCCommittee.findOne.mockResolvedValue(null);
    const res = makeRes();

    await decryptCase(makeReq({ body: { pin: '1234' } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('refuses an incorrect PIN', async () => {
    // The second factor the endpoint advertises and did not have: the
    // comparison lived in a comment reading "in a real app, compare `pin`
    // against `iccMember.decryptionPinHash` using bcrypt".
    Grievance.findOne.mockResolvedValue(grievance());
    ICCCommittee.findOne.mockResolvedValue(iccMember());
    bcrypt.compare.mockResolvedValue(false);
    const res = makeRes();

    await decryptCase(makeReq({ body: { pin: 'wrong' } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid decryption PIN',
    });
  });

  it('refuses a missing PIN without calling bcrypt', async () => {
    // `bcrypt.compare(undefined, hash)` rejects rather than returning false,
    // which would surface as a 500 and, worse, as an unhandled rejection.
    Grievance.findOne.mockResolvedValue(grievance());
    ICCCommittee.findOne.mockResolvedValue(iccMember());
    const res = makeRes();

    await decryptCase(makeReq({ body: {} }), res, jest.fn());

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('records a denied attempt in the audit log', async () => {
    // An audit trail that only records successes cannot show somebody
    // guessing at PINs against a single case.
    Grievance.findOne.mockResolvedValue(grievance());
    ICCCommittee.findOne.mockResolvedValue(iccMember());
    bcrypt.compare.mockResolvedValue(false);

    await decryptCase(
      makeReq({ body: { pin: 'wrong' } }),
      makeRes(),
      jest.fn(),
    );

    expect(eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({ action: 'POSH_CASE_DECRYPT_DENIED' }),
    );
  });

  it('decrypts for a committee member with the right PIN', async () => {
    Grievance.findOne.mockResolvedValue(grievance());
    ICCCommittee.findOne.mockResolvedValue(iccMember());
    bcrypt.compare.mockResolvedValue(true);
    const res = makeRes();

    await decryptCase(makeReq({ body: { pin: 'correct' } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'the plaintext complaint' }),
    );
    expect(eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({ action: 'POSH_CASE_DECRYPTED' }),
    );
  });

  it('scopes the committee lookup to the tenant as well', async () => {
    Grievance.findOne.mockResolvedValue(grievance());
    ICCCommittee.findOne.mockResolvedValue(iccMember());
    bcrypt.compare.mockResolvedValue(true);

    await decryptCase(
      makeReq({ body: { pin: 'correct' } }),
      makeRes(),
      jest.fn(),
    );

    const [filter] = ICCCommittee.findOne.mock.calls[0];

    expect(filter).toMatchObject({
      tenantId: TENANT,
      userId: USER,
      isActive: true,
    });
  });
});

describe('employee.toggleEmployeeStatus', () => {
  it('scopes the lookup', async () => {
    Employee.findOne.mockResolvedValue(null);

    await toggleEmployeeStatus(makeReq(), makeRes(), jest.fn());

    const [filter] = Employee.findOne.mock.calls[0];

    expect(filter).toMatchObject({ _id: RESOURCE, tenantId: TENANT });
  });

  it('lets the owning tenant flip the flag', async () => {
    // Regression for the always-true comparison: before the fix this answered
    // 403 to everyone, so there was no way to deactivate a leaver — and
    // deactivation is what removes them from payroll (#260).
    const employee = {
      _id: RESOURCE,
      tenantId: TENANT,
      isActive: true,
      deletedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Employee.findOne.mockResolvedValue(employee);
    const res = makeRes();

    await toggleEmployeeStatus(makeReq(), res, jest.fn());

    expect(employee.isActive).toBe(false);
    expect(employee.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe('a request with no resolvable tenant', () => {
  it('is refused rather than served unscoped', async () => {
    // The failure `utils/tenantScope.js` exists to prevent: mongoose strips an
    // `undefined` value out of a query before the driver sees it, so
    // `{ tenantId: undefined }` is not a filter matching nothing — it is no
    // filter at all, and the read returns every row for every customer.
    // `tenantFilter` throws a 403 rather than handing back `{}`.
    const next = jest.fn();

    await verifyProof(
      {
        params: { id: RESOURCE },
        body: { status: 'Approved' },
        userId: USER,
        tenantId: undefined,
      },
      makeRes(),
      next,
    );

    expect(TaxProof.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MissingTenantError', status: 403 }),
    );
  });
});
