/**
 * The monthly leave accrual job (#646, #796).
 *
 * The property this suite exists for: running the job twice for the same period
 * must credit everybody exactly once. #646 had a guard for that and it could not
 * fire — it wrote `status` to a CronLock schema with no `status` field, so
 * mongoose dropped it and the comparison was always against `undefined`. A
 * restart, a redeploy or a second instance accrued everyone twice, and a leave
 * balance that says three days when it should say one and a half gets spent.
 */

jest.mock('../../models/employee.model');
jest.mock('../../models/leavePolicy.model');
jest.mock('../../models/leaveBalance.model');
jest.mock('../../models/cronlock.model');

const Employee = require('../../models/employee.model');
const LeavePolicy = require('../../models/leavePolicy.model');
const LeaveBalance = require('../../models/leaveBalance.model');
const CronLock = require('../../models/cronlock.model');
const {
  processMonthlyAccrual,
  acquireAccrualLock,
  LOCK_TTL_MS,
} = require('../leaveAccrual.job');

const LOCK_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const TENANT = 'tenant-1';
const NOW = new Date(2026, 7, 1, 0, 30); // 1 August 2026
const LOCK_KEY = 'leave-accrual-2026-8';

const duplicateKey = () => Object.assign(new Error('dup'), { code: 11000 });

const policy = (overrides = {}) => ({
  _id: 'policy-1',
  tenantId: TENANT,
  leaveType: 'earned',
  accrualRate: 1.5,
  isActive: true,
  ...overrides,
});

const employee = (overrides = {}) => ({
  _id: 'emp-1',
  joiningDate: new Date(2020, 0, 1),
  ...overrides,
});

/** `Model.find(...).select(...).lean()` and `Model.find(...).lean()` */
const leanChain = (rows) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(rows),
});

beforeEach(() => {
  jest.clearAllMocks();

  CronLock.LOCK_STATUS = LOCK_STATUS;
  CronLock.create = jest.fn().mockResolvedValue({});
  CronLock.findById = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(null),
  });
  CronLock.updateOne = jest.fn().mockResolvedValue({});
  CronLock.deleteOne = jest.fn().mockResolvedValue({});

  LeavePolicy.find = jest.fn().mockReturnValue(leanChain([policy()]));
  Employee.find = jest.fn().mockReturnValue(leanChain([employee()]));
  LeaveBalance.findOneAndUpdate = jest.fn().mockResolvedValue({});
});

describe('the lock (#796)', () => {
  it('writes a status and an expiry the TTL index can see', async () => {
    // The upsert #646 used omitted `expiresAt` — `required` is not enforced on
    // an update without `runValidators` — and the TTL index skips documents
    // that lack the field, so its locks accumulated one per month, for ever.
    await processMonthlyAccrual({ now: NOW });

    const [doc] = CronLock.create.mock.calls[0];

    expect(doc._id).toBe(LOCK_KEY);
    expect(doc.status).toBe(LOCK_STATUS.PROCESSING);
    expect(doc.expiresAt).toBeInstanceOf(Date);
    expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(doc.expiresAt.getTime() - doc.lockedAt.getTime()).toBe(LOCK_TTL_MS);
  });

  it('marks the period completed when the run finishes', async () => {
    await processMonthlyAccrual({ now: NOW });

    expect(CronLock.updateOne).toHaveBeenCalledWith(
      { _id: LOCK_KEY },
      expect.objectContaining({
        $set: expect.objectContaining({ status: LOCK_STATUS.COMPLETED }),
      }),
    );
  });

  it('skips a period another run has already credited', async () => {
    // The regression, stated directly. Second run, same month.
    CronLock.create.mockRejectedValue(duplicateKey());
    CronLock.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: LOCK_KEY,
        status: LOCK_STATUS.COMPLETED,
      }),
    });

    const result = await processMonthlyAccrual({ now: NOW });

    expect(result).toMatchObject({ ran: false, reason: 'completed' });
    expect(LeaveBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not credit anybody twice across two runs in the same month', async () => {
    // First run wins the insert; the second loses on the unique index and finds
    // a completed lock.
    await processMonthlyAccrual({ now: NOW });
    expect(LeaveBalance.findOneAndUpdate).toHaveBeenCalledTimes(1);

    CronLock.create.mockRejectedValue(duplicateKey());
    CronLock.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ status: LOCK_STATUS.COMPLETED }),
    });

    await processMonthlyAccrual({ now: NOW });

    expect(LeaveBalance.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('stands aside for a run that is still in progress', async () => {
    CronLock.create.mockRejectedValue(duplicateKey());
    CronLock.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ status: LOCK_STATUS.PROCESSING }),
    });

    const result = await processMonthlyAccrual({ now: NOW });

    expect(result).toMatchObject({ ran: false, reason: 'held' });
    expect(LeaveBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('distinguishes the winner of a race from the loser', async () => {
    // `findOneAndUpdate(upsert)` cannot: both callers get a document back and
    // both proceed. The insert decides, and only one insert can succeed.
    expect(await acquireAccrualLock('k')).toEqual({ acquired: true });

    CronLock.create.mockRejectedValue(duplicateKey());
    expect(await acquireAccrualLock('k')).toMatchObject({ acquired: false });
  });

  it('releases the lock when the run throws, so it can be retried', async () => {
    // A lock left behind blocks every retry for the rest of its TTL, and a run
    // that failed has to be fixable the same day.
    LeavePolicy.find.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('mongo is down')),
    });

    await expect(processMonthlyAccrual({ now: NOW })).rejects.toThrow(
      'mongo is down',
    );
    expect(CronLock.deleteOne).toHaveBeenCalledWith({ _id: LOCK_KEY });
  });

  it('keys the lock by the period, so a new month is not blocked', async () => {
    await processMonthlyAccrual({ now: NOW });
    await processMonthlyAccrual({ now: new Date(2026, 8, 1, 0, 30) });

    expect(CronLock.create.mock.calls.map(([doc]) => doc._id)).toEqual([
      'leave-accrual-2026-8',
      'leave-accrual-2026-9',
    ]);
  });
});

describe('who accrues (#796)', () => {
  it('credits an active employee for a full month', async () => {
    await processMonthlyAccrual({ now: NOW });

    const [filter, update] = LeaveBalance.findOneAndUpdate.mock.calls[0];

    expect(filter).toMatchObject({
      tenantId: TENANT,
      employeeId: 'emp-1',
      policyId: 'policy-1',
      year: 2026,
    });
    expect(update.$inc).toEqual({ currentBalance: 1.5 });
  });

  it('skips somebody who had not joined by the end of the month', async () => {
    Employee.find.mockReturnValue(
      leanChain([employee({ joiningDate: new Date(2026, 10, 1) })]),
    );

    await processMonthlyAccrual({ now: NOW });

    expect(LeaveBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('pro-rates somebody who joined mid-month', async () => {
    // 17 August onwards is 15 of August's 31 days.
    Employee.find.mockReturnValue(
      leanChain([employee({ joiningDate: new Date(2026, 7, 17) })]),
    );

    await processMonthlyAccrual({ now: NOW });

    const [, update] = LeaveBalance.findOneAndUpdate.mock.calls[0];
    expect(update.$inc.currentBalance).toBeCloseTo(0.73, 2);
  });

  it('pro-rates somebody who left mid-month', async () => {
    // `exitDetails` was selected by #646 and then never read, so a leaver
    // accrued the full month regardless of when they went.
    Employee.find.mockReturnValue(
      leanChain([
        employee({ exitDetails: { exitDate: new Date(2026, 7, 15) } }),
      ]),
    );

    await processMonthlyAccrual({ now: NOW });

    const [, update] = LeaveBalance.findOneAndUpdate.mock.calls[0];
    expect(update.$inc.currentBalance).toBeLessThan(1.5);
    expect(update.$inc.currentBalance).toBeGreaterThan(0);
  });

  it('skips somebody who left before the month began', async () => {
    Employee.find.mockReturnValue(
      leanChain([
        employee({ exitDetails: { exitDate: new Date(2026, 5, 15) } }),
      ]),
    );

    await processMonthlyAccrual({ now: NOW });

    expect(LeaveBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not pass isDeleted, which would switch the soft-delete plugin off', async () => {
    // The plugin adds `{ isDeleted: { $ne: true } }` itself and bails out when
    // the caller has already mentioned the field, so spelling it out turned the
    // filter off rather than reinforcing it.
    await processMonthlyAccrual({ now: NOW });

    expect(Employee.find.mock.calls[0][0]).not.toHaveProperty('isDeleted');
    expect(Employee.find.mock.calls[0][0]).toMatchObject({
      tenantId: TENANT,
      isActive: true,
      employmentStatus: { $ne: 'exited' },
    });
  });

  it('carries on past one employee that fails', async () => {
    Employee.find.mockReturnValue(
      leanChain([employee({ _id: 'emp-1' }), employee({ _id: 'emp-2' })]),
    );
    LeaveBalance.findOneAndUpdate
      .mockRejectedValueOnce(new Error('write conflict'))
      .mockResolvedValue({});

    const result = await processMonthlyAccrual({ now: NOW });

    expect(result).toMatchObject({ ran: true, accrued: 1, failed: 1 });
  });

  it('completes cleanly when no policy is active', async () => {
    LeavePolicy.find.mockReturnValue(leanChain([]));

    const result = await processMonthlyAccrual({ now: NOW });

    expect(result.ran).toBe(true);
    expect(LeaveBalance.findOneAndUpdate).not.toHaveBeenCalled();
    // Still marked completed: "nothing to do" is a finished period, not one to
    // retry every time the process restarts.
    expect(CronLock.updateOne).toHaveBeenCalledWith(
      { _id: LOCK_KEY },
      expect.objectContaining({
        $set: expect.objectContaining({ status: LOCK_STATUS.COMPLETED }),
      }),
    );
  });

  it('processes each tenant against its own policies', async () => {
    LeavePolicy.find.mockReturnValue(
      leanChain([
        policy({ _id: 'p-a', tenantId: 'tenant-a' }),
        policy({ _id: 'p-b', tenantId: 'tenant-b' }),
      ]),
    );

    const result = await processMonthlyAccrual({ now: NOW });

    expect(result.tenants).toBe(2);
    expect(Employee.find.mock.calls.map(([f]) => f.tenantId)).toEqual([
      'tenant-a',
      'tenant-b',
    ]);
  });
});
