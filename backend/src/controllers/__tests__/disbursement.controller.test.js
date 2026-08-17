/**
 * Salary disbursement endpoints (#1075).
 *
 * The engine is covered in `utils/__tests__/bankFileGenerator.test.js`. What is
 * checked here is the five refusals that guard the money:
 *
 *   - a batch cannot be built from a payroll month that was never approved,
 *   - a batch with any rejected line cannot be released,
 *   - a batch whose contents changed after validation cannot be released,
 *   - releasing twice does not pay twice,
 *   - a return file that matches nothing in the batch is not applied.
 *
 * Plus the one that is not a refusal but matters as much: full account numbers
 * never appear in a JSON response.
 */

jest.mock('../../models/disbursementBatch.model', () => ({
  DisbursementBatch: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
  DisbursementLine: {
    find: jest.fn(),
    insertMany: jest.fn(),
    updateMany: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock('../../models/payroll.model', () => ({ find: jest.fn() }));
jest.mock('../../models/employee.model', () => ({ find: jest.fn() }));
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
  DisbursementBatch,
  DisbursementLine,
} = require('../../models/disbursementBatch.model');
const PayrollUpdate = require('../../models/payroll.model');
const Employee = require('../../models/employee.model');
const {
  computeControlTotals,
  validateBatch,
  BATCH_STATUS,
  LINE_STATUS,
} = require('../../utils/bankFileGenerator');
const {
  createBatch,
  getBatch,
  validateBatchLines,
  getBatchFile,
  releaseBatch,
  recordReturns,
  getBankProfiles,
} = require('../disbursement.controller');

const TENANT = '507f1f77bcf86cd799439099';
const USER = '507f1f77bcf86cd799439011';
const BATCH = '607f1f77bcf86cd7994390a1';
const EMPLOYEE = '607f1f77bcf86cd7994390b2';
const DEBIT_IFSC = 'HDFC0001234';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  setHeader: jest.fn(),
});

const makeReq = (overrides = {}) => ({
  tenantId: TENANT,
  userId: USER,
  body: {},
  params: {},
  query: {},
  ...overrides,
});

const selectLeanResolving = (value) => ({
  select: jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const sortLeanResolving = (value) => ({
  sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const selectSortLeanResolving = (value) => ({
  select: jest.fn().mockReturnValue({
    sort: jest
      .fn()
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
  }),
});
const leanResolving = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

/** Stored lines, as `loadLinesForFile` returns them. */
const storedLines = () =>
  validateBatch(
    [
      {
        employeeId: EMPLOYEE,
        beneficiaryName: 'Asha Rao',
        accountNumber: '111111111111',
        ifsc: 'ICIC0000123',
        amount: 50000,
      },
      {
        employeeId: 'e2',
        beneficiaryName: 'Ravi Kumar',
        accountNumber: '222222222222',
        ifsc: 'ICIC0000123',
        amount: 60000,
      },
    ],
    { debitIfsc: DEBIT_IFSC },
  ).valid.map((line, index) => ({
    ...line,
    _id: `l${index + 1}`,
    serial: index + 1,
  }));

const batchDoc = (overrides = {}) => {
  const lines = storedLines();

  return {
    _id: BATCH,
    tenantId: TENANT,
    batchReference: 'SAL202608',
    month: 8,
    year: 2026,
    debitAccountNumber: '000111222333',
    debitIfsc: DEBIT_IFSC,
    valueDate: new Date('2026-08-31T00:00:00.000Z'),
    status: BATCH_STATUS.VALIDATED,
    controlTotals: computeControlTotals(lines),
    rejectedLines: [],
    releasedAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  DisbursementLine.updateMany.mockResolvedValue({});
  DisbursementLine.updateOne.mockResolvedValue({});
  DisbursementLine.insertMany.mockResolvedValue([]);
});

describe('createBatch', () => {
  const body = {
    month: 8,
    year: 2026,
    debitAccountNumber: '000111222333',
    debitIfsc: DEBIT_IFSC,
  };

  it('builds a batch from approved payroll rows', async () => {
    PayrollUpdate.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: 'p1',
          employeeId: EMPLOYEE,
          employeeName: 'Asha Rao',
          netSalary: 50000,
        },
      ]),
    );
    Employee.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: EMPLOYEE,
          fullName: 'Asha Rao',
          bankDetails: {
            accountNumber: '111111111111',
            routingCode: 'ICIC0000123',
          },
        },
      ]),
    );
    DisbursementBatch.create.mockResolvedValue({ _id: BATCH });

    const res = makeRes();
    await createBatch(makeReq({ body }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].accepted).toBe(1);
    expect(DisbursementLine.insertMany).toHaveBeenCalled();
  });

  it('only considers approved rows', async () => {
    // Not finalised: #458's maker-checker split exists so money does not move on
    // the maker's say-so, and generating a bank file from an unapproved run
    // would route around it.
    PayrollUpdate.find.mockReturnValue(selectLeanResolving([]));

    const res = makeRes();
    await createBatch(makeReq({ body }), res, jest.fn());

    expect(PayrollUpdate.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/must be approved/);
  });

  it('partitions an employee with no bank details into the rejected half', async () => {
    // One missing beneficiary must not sink the run, and must not be silently
    // dropped either.
    PayrollUpdate.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: 'p1',
          employeeId: EMPLOYEE,
          employeeName: 'Asha Rao',
          netSalary: 50000,
        },
        {
          _id: 'p2',
          employeeId: 'e2',
          employeeName: 'Ravi Kumar',
          netSalary: 60000,
        },
      ]),
    );
    Employee.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: EMPLOYEE,
          fullName: 'Asha Rao',
          bankDetails: {
            accountNumber: '111111111111',
            routingCode: 'ICIC0000123',
          },
        },
        { _id: 'e2', fullName: 'Ravi Kumar', bankDetails: {} },
      ]),
    );
    DisbursementBatch.create.mockResolvedValue({ _id: BATCH });

    const res = makeRes();
    await createBatch(makeReq({ body }), res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.accepted).toBe(1);
    expect(payload.rejected).toHaveLength(1);
    expect(payload.rejected[0].reasons.join(' ')).toMatch(/IFSC is missing/);
  });

  it('stores control totals computed from the accepted lines only', async () => {
    PayrollUpdate.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: 'p1',
          employeeId: EMPLOYEE,
          employeeName: 'Asha Rao',
          netSalary: 50000,
        },
        {
          _id: 'p2',
          employeeId: 'e2',
          employeeName: 'Ravi Kumar',
          netSalary: 60000,
        },
      ]),
    );
    Employee.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: EMPLOYEE,
          fullName: 'Asha Rao',
          bankDetails: {
            accountNumber: '111111111111',
            routingCode: 'ICIC0000123',
          },
        },
        { _id: 'e2', fullName: 'Ravi Kumar', bankDetails: {} },
      ]),
    );
    DisbursementBatch.create.mockResolvedValue({ _id: BATCH });

    await createBatch(makeReq({ body }), makeRes(), jest.fn());

    const created = DisbursementBatch.create.mock.calls[0][0];
    expect(created.controlTotals.recordCount).toBe(1);
    expect(created.controlTotals.totalAmountPaise).toBe(5000000);
  });

  it('refuses a second batch for the same period', async () => {
    PayrollUpdate.find.mockReturnValue(
      selectLeanResolving([
        {
          _id: 'p1',
          employeeId: EMPLOYEE,
          employeeName: 'Asha',
          netSalary: 1000,
        },
      ]),
    );
    Employee.find.mockReturnValue(selectLeanResolving([]));
    DisbursementBatch.create.mockRejectedValue({ code: 11000 });

    const res = makeRes();
    await createBatch(makeReq({ body }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('requires a debit account', async () => {
    const res = makeRes();
    await createBatch(
      makeReq({ body: { month: 8, year: 2026 } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(PayrollUpdate.find).not.toHaveBeenCalled();
  });
});

describe('getBatch', () => {
  it('never returns a full account number', async () => {
    // The single most important property of this API. `lean()` bypasses the
    // schema's toJSON transform, so the projection is what does the work.
    DisbursementBatch.findOne.mockReturnValue(leanResolving(batchDoc()));
    DisbursementLine.find.mockReturnValue(
      // Projected exactly as the controller's `select('-accountNumber')` would
      // return it, so the assertion below is about the controller and not about
      // the fixture.
      selectSortLeanResolving(
        storedLines().map((line) => {
          const projected = { ...line };
          delete projected.accountNumber;
          return projected;
        }),
      ),
    );

    const res = makeRes();
    await getBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('111111111111');
    expect(body.lines[0].maskedAccountNumber).toBe('XXXXXXXX1111');
  });

  it('projects the account number out of the query', async () => {
    DisbursementBatch.findOne.mockReturnValue(leanResolving(batchDoc()));
    const chain = selectSortLeanResolving([]);
    DisbursementLine.find.mockReturnValue(chain);

    await getBatch(makeReq({ params: { id: BATCH } }), makeRes(), jest.fn());

    expect(chain.select).toHaveBeenCalledWith('-accountNumber');
  });

  it('404s on a batch in another tenant', async () => {
    DisbursementBatch.findOne.mockReturnValue(leanResolving(null));

    const res = makeRes();
    await getBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('validateBatchLines', () => {
  it('marks a clean batch validated', async () => {
    const batch = batchDoc({ status: BATCH_STATUS.DRAFT });
    DisbursementBatch.findOne.mockResolvedValue(batch);
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await validateBatchLines(
      makeReq({ params: { id: BATCH } }),
      res,
      jest.fn(),
    );

    expect(batch.status).toBe(BATCH_STATUS.VALIDATED);
    expect(res.json.mock.calls[0][0].accepted).toBe(2);
  });

  it('leaves a batch in draft when a line still cannot be sent', async () => {
    const batch = batchDoc({ status: BATCH_STATUS.DRAFT });
    DisbursementBatch.findOne.mockResolvedValue(batch);
    DisbursementLine.find.mockReturnValue(
      sortLeanResolving([{ ...storedLines()[0], ifsc: 'BAD' }]),
    );

    const res = makeRes();
    await validateBatchLines(
      makeReq({ params: { id: BATCH } }),
      res,
      jest.fn(),
    );

    expect(batch.status).toBe(BATCH_STATUS.DRAFT);
    expect(res.json.mock.calls[0][0].rejected).toHaveLength(1);
  });

  it('refuses to revalidate a released batch', async () => {
    DisbursementBatch.findOne.mockResolvedValue(
      batchDoc({ status: BATCH_STATUS.RELEASED }),
    );

    const res = makeRes();
    await validateBatchLines(
      makeReq({ params: { id: BATCH } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('getBatchFile', () => {
  it('emits a NACH file as a download', async () => {
    DisbursementBatch.findOne.mockReturnValue(leanResolving(batchDoc()));
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await getBatchFile(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="SAL202608.txt"',
    );
    expect(res.send.mock.calls[0][0]).toContain('01SAL202608');
  });

  it('emits a delimited file for the requested bank profile', async () => {
    DisbursementBatch.findOne.mockReturnValue(leanResolving(batchDoc()));
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await getBatchFile(
      makeReq({
        params: { id: BATCH },
        query: { format: 'delimited', profile: 'icici' },
      }),
      res,
      jest.fn(),
    );

    expect(res.send.mock.calls[0][0]).toContain('BENE_IFSC');
  });

  it('refuses to generate a file from an unvalidated batch', async () => {
    DisbursementBatch.findOne.mockReturnValue(
      leanResolving(batchDoc({ status: BATCH_STATUS.DRAFT })),
    );

    const res = makeRes();
    await getBatchFile(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('reports an unknown bank profile as a 400', async () => {
    DisbursementBatch.findOne.mockReturnValue(leanResolving(batchDoc()));
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await getBatchFile(
      makeReq({
        params: { id: BATCH },
        query: { format: 'delimited', profile: 'barclays' },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('releaseBatch', () => {
  it('releases a validated batch and marks its lines', async () => {
    const batch = batchDoc();
    DisbursementBatch.findOne.mockResolvedValue(batch);
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await releaseBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(batch.status).toBe(BATCH_STATUS.RELEASED);
    expect(batch.releasedBy).toBe(USER);
    expect(DisbursementLine.updateMany).toHaveBeenCalledWith(
      { tenantId: TENANT, batchId: BATCH },
      { $set: { status: LINE_STATUS.RELEASED } },
    );
  });

  it('is idempotent — a second release does not pay twice', async () => {
    // A maker-checker endpoint on a retryable network. "The request timed out,
    // click again" must not be a way to pay everybody a second time.
    const releasedAt = new Date('2026-08-31T10:00:00.000Z');
    const batch = batchDoc({ status: BATCH_STATUS.RELEASED, releasedAt });
    DisbursementBatch.findOne.mockResolvedValue(batch);

    const res = makeRes();
    await releaseBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].alreadyReleased).toBe(true);
    expect(res.json.mock.calls[0][0].releasedAt).toBe(releasedAt);
    expect(batch.save).not.toHaveBeenCalled();
    expect(DisbursementLine.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to release a batch that was never validated', async () => {
    DisbursementBatch.findOne.mockResolvedValue(
      batchDoc({ status: BATCH_STATUS.DRAFT }),
    );

    const res = makeRes();
    await releaseBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('refuses to release while any line is rejected', async () => {
    DisbursementBatch.findOne.mockResolvedValue(
      batchDoc({ rejectedLines: [{ index: 3, reasons: ['IFSC is missing'] }] }),
    );

    const res = makeRes();
    await releaseBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].rejected).toHaveLength(1);
  });

  it('refuses to release when the contents changed after validation', async () => {
    // Otherwise the bank gets a file whose trailer disagrees with its body, and
    // rejects the whole thing — or worse, does not.
    const batch = batchDoc();
    DisbursementBatch.findOne.mockResolvedValue(batch);

    const tampered = storedLines();
    tampered[0].amountPaise += 100000;
    DisbursementLine.find.mockReturnValue(sortLeanResolving(tampered));

    const res = makeRes();
    await releaseBatch(makeReq({ params: { id: BATCH } }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].differences.join(' ')).toMatch(
      /does not match/,
    );
    expect(batch.status).toBe(BATCH_STATUS.VALIDATED);
  });
});

describe('recordReturns', () => {
  const released = () => batchDoc({ status: BATCH_STATUS.RELEASED });

  it('marks the named credits returned and leaves the rest alone', async () => {
    DisbursementBatch.findOne.mockResolvedValue(released());
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await recordReturns(
      makeReq({
        params: { id: BATCH },
        body: { content: '2,222222222222,R01' },
      }),
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.returnedCount).toBe(1);
    expect(body.creditedCount).toBe(1);
    expect(body.returnedAmount).toBe(60000);
  });

  it('separates what can be re-issued from what needs new bank details', async () => {
    DisbursementBatch.findOne.mockResolvedValue(released());
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await recordReturns(
      makeReq({
        params: { id: BATCH },
        body: { content: '1,111111111111,R07\n2,222222222222,R01' },
      }),
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.reissuableAmount).toBe(50000);
    expect(body.needsNewBankDetails).toBe(1);
  });

  it('refuses a return file that matches nothing in this batch', async () => {
    // Almost always the wrong file. Applying the part that happened to match
    // would mark the rest of the batch credited on somebody else's failures.
    DisbursementBatch.findOne.mockResolvedValue(released());
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    const res = makeRes();
    await recordReturns(
      makeReq({
        params: { id: BATCH },
        body: { content: '1,999999999999,R01' },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toMatch(/right file/);
  });

  it('marks a clean run reconciled', async () => {
    const batch = released();
    DisbursementBatch.findOne.mockResolvedValue(batch);
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    await recordReturns(
      makeReq({
        params: { id: BATCH },
        body: { content: 'Serial,Account,Reason' },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(batch.status).toBe(BATCH_STATUS.RECONCILED);
  });

  it('marks a run with returns as failed rather than reconciled', async () => {
    const batch = released();
    DisbursementBatch.findOne.mockResolvedValue(batch);
    DisbursementLine.find.mockReturnValue(sortLeanResolving(storedLines()));

    await recordReturns(
      makeReq({
        params: { id: BATCH },
        body: { content: '2,222222222222,R01' },
      }),
      makeRes(),
      jest.fn(),
    );

    expect(batch.status).toBe(BATCH_STATUS.FAILED);
  });

  it('refuses returns against a batch that was never released', async () => {
    DisbursementBatch.findOne.mockResolvedValue(batchDoc());

    const res = makeRes();
    await recordReturns(
      makeReq({
        params: { id: BATCH },
        body: { content: '1,111111111111,R01' },
      }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('requires the file content', async () => {
    const res = makeRes();
    await recordReturns(
      makeReq({ params: { id: BATCH }, body: {} }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(DisbursementBatch.findOne).not.toHaveBeenCalled();
  });
});

describe('getBankProfiles', () => {
  it('lists the layouts this server can emit', async () => {
    // A UI that hard-codes the list drifts the moment a profile is added.
    const res = makeRes();
    await getBankProfiles(makeReq(), res);

    const keys = res.json.mock.calls[0][0].profiles.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['hdfc', 'icici', 'sbi']));
  });
});
