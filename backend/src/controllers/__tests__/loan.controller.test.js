const mongoose = require('mongoose');
const {
  createLoan,
  getLoans,
  getLoanById,
  getLoanSchedule,
  getLoanSummary,
  previewLoanSchedule,
  updateLoanStatus,
  recordManualRepayment,
} = require('../loan.controller');

const Loan = require('../../models/loan.model');
const Employee = require('../../models/employee.model');
const eventBus = require('../../services/event.service');
const { LOAN_STATUS, INTEREST_METHOD } = require('../../utils/loanSchedule');

jest.mock('../../models/loan.model');
jest.mock('../../models/employee.model');

const OWNER = '507f1f77bcf86cd799439011';
const EMP_A = '607f1f77bcf86cd7994390a1';
const LOAN_ID = '707f1f77bcf86cd7994390b1';

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const selectMock = (data) => ({ select: jest.fn().mockResolvedValue(data) });

const listMock = (data) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockResolvedValue(data),
});

const employeeDoc = (overrides = {}) => ({
  _id: oid(EMP_A),
  fullName: 'Alice Smith',
  monthlySalary: 30000,
  createdBy: oid(OWNER),
  ...overrides,
});

const loanDoc = (overrides = {}) => ({
  _id: oid(LOAN_ID),
  employeeId: oid(EMP_A),
  employeeName: 'Alice Smith',
  createdBy: oid(OWNER),
  status: LOAN_STATUS.ACTIVE,
  principal: 12000,
  totalPayable: 12000,
  installmentAmount: 1000,
  tenureMonths: 12,
  startMonth: 1,
  startYear: 2026,
  schedule: [],
  repayments: [],
  totalRepaid: 0,
  outstanding: 12000,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Employee.findOne.mockResolvedValue(employeeDoc());
  Loan.find.mockImplementation(() => selectMock([]));
  Loan.findOne.mockResolvedValue(null);
  Loan.countDocuments.mockResolvedValue(0);
  Loan.aggregate.mockResolvedValue([]);
  Loan.create.mockImplementation((doc) =>
    Promise.resolve({ _id: oid(LOAN_ID), ...doc }),
  );
});

describe('createLoan — ownership and terms (#460)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      body: {
        employeeId: EMP_A,
        principal: 12000,
        tenureMonths: 12,
        startMonth: 1,
        startYear: 2026,
      },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('issues a loan with a frozen schedule', async () => {
    await createLoan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);

    const created = Loan.create.mock.calls[0][0];
    expect(created.installmentAmount).toBe(1000);
    expect(created.totalPayable).toBe(12000);
    expect(created.schedule).toHaveLength(12);
    expect(created.outstanding).toBe(12000);
  });

  test('scopes the employee lookup by createdBy', async () => {
    await createLoan(req, res, next);

    expect(Employee.findOne).toHaveBeenCalledWith({
      _id: EMP_A,
      createdBy: OWNER,
    });
  });

  test("another company's employee cannot be lent to", async () => {
    Employee.findOne.mockResolvedValue(null);

    await createLoan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Loan.create).not.toHaveBeenCalled();
  });

  test('rejects a malformed employee id before querying', async () => {
    req.body.employeeId = 'nope';

    await createLoan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Employee.findOne).not.toHaveBeenCalled();
  });

  test('rejects invalid terms with every reason listed', async () => {
    req.body = { employeeId: EMP_A, principal: -5, tenureMonths: 0 };

    await createLoan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors.length).toBeGreaterThan(1);
    expect(Loan.create).not.toHaveBeenCalled();
  });

  test('refuses an advance beyond 6x monthly salary', async () => {
    // An advance larger than a few months' pay cannot be recovered from that
    // pay — the instalment would be capped away every month while the balance
    // stood still.
    req.body.principal = 500000; // salary 30000 -> cap 180000

    await createLoan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('exceed');
    expect(Loan.create).not.toHaveBeenCalled();
  });

  test('counts existing outstanding advances towards the cap', async () => {
    Loan.find.mockImplementation(() => selectMock([{ outstanding: 170000 }]));
    req.body.principal = 20000; // 170000 + 20000 > 180000

    await createLoan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].existingOutstanding).toBe(170000);
  });

  test('the cap query only counts live loans', async () => {
    await createLoan(req, res, next);

    const filter = Loan.find.mock.calls[0][0];
    expect(filter.createdBy).toBe(OWNER);
    expect(filter.status.$in).toEqual(
      expect.arrayContaining([LOAN_STATUS.ACTIVE, LOAN_STATUS.ON_HOLD]),
    );
  });

  test('supports a reducing-balance loan', async () => {
    req.body.interestMethod = INTEREST_METHOD.REDUCING;
    req.body.interestRatePercent = 12;

    await createLoan(req, res, next);

    const created = Loan.create.mock.calls[0][0];
    expect(created.totalInterest).toBeGreaterThan(0);
    expect(created.totalPayable).toBeGreaterThan(12000);
    expect(created.outstanding).toBe(created.totalPayable);
  });

  test('emits a LOAN_ISSUE audit event', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');

    await createLoan(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([event, payload]) => event === 'AUDIT_LOG' && payload.action === 'LOAN_ISSUE',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[1].resourceType).toBe('Loan');
    emitSpy.mockRestore();
  });

  test('defaults the start period to the current month', async () => {
    delete req.body.startMonth;
    delete req.body.startYear;
    const now = new Date();

    await createLoan(req, res, next);

    const created = Loan.create.mock.calls[0][0];
    expect(created.startMonth).toBe(now.getMonth() + 1);
    expect(created.startYear).toBe(now.getFullYear());
  });
});

describe('getLoans — listing (#460)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, query: {} };
    res = makeRes();
    next = jest.fn();
    Loan.find.mockImplementation(() => listMock([]));
  });

  test('scopes by createdBy', async () => {
    await getLoans(req, res, next);
    expect(Loan.find).toHaveBeenCalledWith({ createdBy: OWNER });
  });

  test('filters by status and employee', async () => {
    req.query = { status: LOAN_STATUS.ACTIVE, employeeId: EMP_A };

    await getLoans(req, res, next);

    expect(Loan.find).toHaveBeenCalledWith({
      createdBy: OWNER,
      status: LOAN_STATUS.ACTIVE,
      employeeId: EMP_A,
    });
  });

  test('rejects an unknown status filter', async () => {
    req.query = { status: 'defaulted' };

    await getLoans(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects a malformed employee filter', async () => {
    req.query = { employeeId: 'nope' };

    await getLoans(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('clamps pagination', async () => {
    req.query = { page: '-2', limit: '9999' };

    await getLoans(req, res, next);

    expect(res.json.mock.calls[0][0].currentPage).toBe(1);
  });

  test('omits the schedule from the list payload', async () => {
    const chain = listMock([]);
    Loan.find.mockImplementation(() => chain);

    await getLoans(req, res, next);

    expect(chain.select).toHaveBeenCalledWith('-schedule');
  });
});

describe('getLoanById and getLoanSchedule (#460)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, params: { id: LOAN_ID } };
    res = makeRes();
    next = jest.fn();
  });

  test('scopes the lookup by createdBy', async () => {
    Loan.findOne.mockResolvedValue(loanDoc());

    await getLoanById(req, res, next);

    expect(Loan.findOne).toHaveBeenCalledWith({ _id: LOAN_ID, createdBy: OWNER });
  });

  test("another company's loan is a 404", async () => {
    Loan.findOne.mockResolvedValue(null);

    await getLoanById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects a malformed id', async () => {
    req.params.id = 'nope';

    await getLoanById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Loan.findOne).not.toHaveBeenCalled();
  });

  test('recomputes the outstanding balance from the ledger', async () => {
    // Derived rather than trusted, so a drift from the stored field is visible.
    Loan.findOne.mockResolvedValue(
      loanDoc({
        repayments: [{ month: 1, year: 2026, amount: 3000 }],
        outstanding: 12000, // deliberately stale
      }),
    );

    await getLoanById(req, res, next);

    expect(res.json.mock.calls[0][0].derivedOutstanding).toBe(9000);
  });

  test('the schedule marks which instalments were actually collected', async () => {
    Loan.findOne.mockResolvedValue(
      loanDoc({
        schedule: [
          { month: 1, year: 2026, amount: 1000, installmentNumber: 1 },
          { month: 2, year: 2026, amount: 1000, installmentNumber: 2 },
        ],
        repayments: [{ month: 1, year: 2026, amount: 1000 }],
      }),
    );

    await getLoanSchedule(req, res, next);

    const rows = res.json.mock.calls[0][0].schedule;
    expect(rows[0].paid).toBe(true);
    expect(rows[0].paidAmount).toBe(1000);
    expect(rows[1].paid).toBe(false);
  });
});

describe('previewLoanSchedule — writes nothing (#460)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      body: { principal: 12000, tenureMonths: 12, startMonth: 1, startYear: 2026 },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('returns a schedule without creating anything', async () => {
    await previewLoanSchedule(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].schedule).toHaveLength(12);
    expect(Loan.create).not.toHaveBeenCalled();
  });

  test('reports invalid terms', async () => {
    req.body = { principal: 0, tenureMonths: -1 };

    await previewLoanSchedule(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Loan.create).not.toHaveBeenCalled();
  });
});

describe('updateLoanStatus — transitions (#460)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { userId: OWNER, params: { id: LOAN_ID }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test('puts an active loan on hold', async () => {
    const loan = loanDoc();
    Loan.findOne.mockResolvedValue(loan);
    req.body = { status: LOAN_STATUS.ON_HOLD };

    await updateLoanStatus(req, res, next);

    expect(loan.status).toBe(LOAN_STATUS.ON_HOLD);
    expect(loan.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('refuses to reopen a completed loan', async () => {
    // Reopening a settled loan would let an employer resume collecting against
    // a balance of zero.
    const loan = loanDoc({ status: LOAN_STATUS.COMPLETED });
    Loan.findOne.mockResolvedValue(loan);
    req.body = { status: LOAN_STATUS.ACTIVE };

    await updateLoanStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(loan.save).not.toHaveBeenCalled();
  });

  test('refuses to reopen a cancelled loan', async () => {
    Loan.findOne.mockResolvedValue(loanDoc({ status: LOAN_STATUS.CANCELLED }));
    req.body = { status: LOAN_STATUS.ACTIVE };

    await updateLoanStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('rejects an unknown target status', async () => {
    Loan.findOne.mockResolvedValue(loanDoc());
    req.body = { status: 'defaulted' };

    await updateLoanStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('stamps cancelledAt when cancelling', async () => {
    const loan = loanDoc();
    Loan.findOne.mockResolvedValue(loan);
    req.body = { status: LOAN_STATUS.CANCELLED };

    await updateLoanStatus(req, res, next);

    expect(loan.cancelledAt).toBeInstanceOf(Date);
  });

  test('emits a status-change audit event', async () => {
    const emitSpy = jest.spyOn(eventBus, 'emit');
    Loan.findOne.mockResolvedValue(loanDoc());
    req.body = { status: LOAN_STATUS.ON_HOLD };

    await updateLoanStatus(req, res, next);

    const auditCall = emitSpy.mock.calls.find(
      ([, payload]) => payload && payload.action === 'LOAN_STATUS_CHANGE',
    );
    expect(auditCall[1].details.from).toBe(LOAN_STATUS.ACTIVE);
    expect(auditCall[1].details.to).toBe(LOAN_STATUS.ON_HOLD);
    emitSpy.mockRestore();
  });
});

describe('recordManualRepayment (#460)', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      userId: OWNER,
      params: { id: LOAN_ID },
      body: { amount: 3000, month: 3, year: 2026 },
    };
    res = makeRes();
    next = jest.fn();
  });

  test('records the repayment and reduces the balance', async () => {
    const loan = loanDoc();
    Loan.findOne.mockResolvedValue(loan);

    await recordManualRepayment(req, res, next);

    expect(loan.totalRepaid).toBe(3000);
    expect(loan.outstanding).toBe(9000);
    expect(loan.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('refuses to over-collect — the failure this feature exists to prevent', async () => {
    Loan.findOne.mockResolvedValue(loanDoc({ outstanding: 12000 }));
    req.body.amount = 20000;

    await recordManualRepayment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].outstanding).toBe(12000);
  });

  test('auto-completes a loan settled by a lump sum', async () => {
    const loan = loanDoc();
    Loan.findOne.mockResolvedValue(loan);
    req.body.amount = 12000;

    await recordManualRepayment(req, res, next);

    expect(loan.outstanding).toBe(0);
    expect(loan.status).toBe(LOAN_STATUS.COMPLETED);
    expect(loan.completedAt).toBeInstanceOf(Date);
  });

  test('rejects a non-positive amount', async () => {
    Loan.findOne.mockResolvedValue(loanDoc());

    for (const amount of [0, -100, NaN, 'x', null]) {
      jest.clearAllMocks();
      Loan.findOne.mockResolvedValue(loanDoc());
      req.body = { amount, month: 3, year: 2026 };
      await recordManualRepayment(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  test('rejects an invalid period', async () => {
    Loan.findOne.mockResolvedValue(loanDoc());
    req.body = { amount: 100, month: 13, year: 2026 };

    await recordManualRepayment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('refuses to collect against a cancelled or completed loan', async () => {
    for (const status of [LOAN_STATUS.CANCELLED, LOAN_STATUS.COMPLETED]) {
      jest.clearAllMocks();
      Loan.findOne.mockResolvedValue(loanDoc({ status }));
      req.body = { amount: 100, month: 3, year: 2026 };
      await recordManualRepayment(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    }
  });

  test("another company's loan cannot be repaid", async () => {
    Loan.findOne.mockResolvedValue(null);

    await recordManualRepayment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('getLoanSummary (#460)', () => {
  test('aggregates outstanding across live statuses only', async () => {
    Loan.aggregate.mockResolvedValue([
      { _id: LOAN_STATUS.ACTIVE, count: 2, outstanding: 15000, principal: 20000 },
      { _id: LOAN_STATUS.ON_HOLD, count: 1, outstanding: 5000, principal: 5000 },
      { _id: LOAN_STATUS.COMPLETED, count: 3, outstanding: 0, principal: 30000 },
    ]);

    const req = { userId: OWNER };
    const res = makeRes();

    await getLoanSummary(req, res, jest.fn());

    const payload = res.json.mock.calls[0][0];
    expect(payload.totalOutstanding).toBe(20000);
    expect(payload.totalCount).toBe(6);
    expect(payload.byStatus.completed.count).toBe(3);
  });

  test('scopes the aggregation to the caller', async () => {
    const res = makeRes();
    await getLoanSummary({ userId: OWNER }, res, jest.fn());

    const pipeline = Loan.aggregate.mock.calls[0][0];
    expect(String(pipeline[0].$match.createdBy)).toBe(OWNER);
  });
});
