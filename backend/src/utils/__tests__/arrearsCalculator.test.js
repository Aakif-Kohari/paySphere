/**
 * Retroactive arrears (#931, repaired in #950).
 *
 * The engine shipped with no tests at all, which is how a require of a module
 * path that does not exist survived a merge: nothing ever loaded the file
 * except a controller that caught and logged the failure.
 *
 * The first test here is therefore the load itself. Everything after it is
 * arithmetic that decides what somebody is paid.
 */

jest.mock('../../models/arrearsLedger.model');

const ArrearsLedger = require('../../models/arrearsLedger.model');
const {
  processRetroactiveArrears,
  bundleUnreleasedArrears,
  markArrearsReleased,
  _internals,
} = require('../arrearsCalculator');

const TENANT = '507f1f77bcf86cd799439099';
const EMPLOYEE = '607f1f77bcf86cd7994390a1';
const REVISION = '707f1f77bcf86cd7994390b1';
const PAYROLL = '807f1f77bcf86cd7994390c1';

/** A revision effective on `date`, raising gross to `grossMonthly`. */
const revisionOn = (date, grossMonthly = 60000) => ({
  _id: REVISION,
  employeeId: EMPLOYEE,
  effectiveFrom: date,
  grossMonthly,
});

/** The rows `insertMany` was asked to write. */
const insertedRows = () => ArrearsLedger.insertMany.mock.calls[0][0];

/** A chainable find() that resolves to `rows` at `.lean()`. */
const findMock = (rows) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(rows),
});

beforeEach(() => {
  jest.clearAllMocks();
  // 15 June 2026. Every relative date below is anchored to it.
  jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15));
  ArrearsLedger.insertMany = jest.fn().mockResolvedValue([]);
  ArrearsLedger.find = jest.fn(() => findMock([]));
  ArrearsLedger.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the module loads (#950)', () => {
  it('resolves every module it requires', () => {
    // The regression, in the only form it can be expressed: on `main` this
    // require threw `Cannot find module '../models/arrearsLedger'`, and every
    // payroll submission answered 500 because of it.
    expect(() => require('../arrearsCalculator')).not.toThrow();
    expect(typeof processRetroactiveArrears).toBe('function');
    expect(typeof bundleUnreleasedArrears).toBe('function');
    expect(typeof markArrearsReleased).toBe('function');
  });
});

describe('pro-rating a partial month', () => {
  const { calculateProRatedGross, getDaysInMonth } = _internals;

  it('counts the effective day itself', () => {
    // 15th of a 30-day month is 16 days, not 15. Somebody whose raise starts
    // on a Monday is paid the new rate for that Monday.
    expect(calculateProRatedGross(30000, 15, 30)).toBe(16000);
  });

  it('gives the whole month when effective on the 1st', () => {
    expect(calculateProRatedGross(30000, 1, 30)).toBe(30000);
  });

  it('gives one day when effective on the last day', () => {
    expect(calculateProRatedGross(31000, 31, 31)).toBe(1000);
  });

  it('knows February in a leap year', () => {
    expect(getDaysInMonth(2, 2024)).toBe(29);
    expect(getDaysInMonth(2, 2026)).toBe(28);
  });
});

describe('generating arrears for a backdated revision', () => {
  it('writes one row per whole month between the effective date and this one', async () => {
    // Effective 1 March, run on 15 June: March, April and May are owed. June
    // is not — the current run pays the new rate directly.
    const result = await processRetroactiveArrears(
      revisionOn(new Date(2026, 2, 1)),
      { grossMonthly: 50000 },
      TENANT,
    );

    const rows = insertedRows();

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => `${r.targetMonth}/${r.targetYear}`)).toEqual([
      '3/2026',
      '4/2026',
      '5/2026',
    ]);
    expect(rows.every((r) => r.grossDelta === 10000)).toBe(true);
    expect(rows.every((r) => r.isReleased === false)).toBe(true);
    expect(rows.every((r) => String(r.tenantId) === TENANT)).toBe(true);
    expect(result.months).toBe(3);
  });

  it('does not skip a month when the effective day is the 31st', async () => {
    // The regression. `iterDate.setMonth(getMonth() + 1)` on 31 January lands
    // on 2 or 3 March, because there is no 31 February to normalise onto — so
    // February was never generated and the employee was owed a month less than
    // they should have been.
    await processRetroactiveArrears(
      revisionOn(new Date(2026, 0, 31)),
      { grossMonthly: 50000 },
      TENANT,
    );

    const months = insertedRows().map((r) => r.targetMonth);

    expect(months).toEqual([1, 2, 3, 4, 5]);
  });

  it('pro-rates only the month the revision takes effect in', async () => {
    // Effective 15 April of a 30-day month: 16 of 30 days at the new rate.
    await processRetroactiveArrears(
      revisionOn(new Date(2026, 3, 15)),
      { grossMonthly: 50000 },
      TENANT,
    );

    const [april, may] = insertedRows();

    expect(april.proRatedDays).toBe(16);
    expect(april.grossDelta).toBe(
      Math.round((60000 - 50000) * (16 / 30) * 100) / 100,
    );
    expect(may.proRatedDays).toBeNull();
    expect(may.grossDelta).toBe(10000);
  });

  it('generates nothing for a revision effective this month or later', async () => {
    for (const date of [new Date(2026, 5, 1), new Date(2026, 8, 1)]) {
      const result = await processRetroactiveArrears(
        revisionOn(date),
        { grossMonthly: 50000 },
        TENANT,
      );
      expect(result.skipped).toBe('not backdated');
    }

    expect(ArrearsLedger.insertMany).not.toHaveBeenCalled();
  });

  it('generates nothing for a decrease', async () => {
    const result = await processRetroactiveArrears(
      revisionOn(new Date(2026, 2, 1), 40000),
      { grossMonthly: 50000 },
      TENANT,
    );

    // A decrease is a recovery, and clawing money back out of somebody's next
    // payslip is a decision for a human.
    expect(result.skipped).toBe('not an increase');
    expect(ArrearsLedger.insertMany).not.toHaveBeenCalled();
  });

  it('generates nothing when there is no previous revision', async () => {
    // The dangerous one. `oldGross` defaulted to 0, so an employee's first
    // recorded revision, backdated, owed them their entire salary again for
    // every month since — on top of the salary already paid.
    const result = await processRetroactiveArrears(
      revisionOn(new Date(2026, 0, 1)),
      null,
      TENANT,
    );

    expect(result.skipped).toBe('no previous revision');
    expect(ArrearsLedger.insertMany).not.toHaveBeenCalled();
  });

  it('treats a duplicate key as already done, not as a failure', async () => {
    // The unique index is what makes a retried request idempotent.
    const duplicate = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000,
      insertedDocs: [],
    });
    ArrearsLedger.insertMany.mockRejectedValue(duplicate);

    await expect(
      processRetroactiveArrears(
        revisionOn(new Date(2026, 2, 1)),
        { grossMonthly: 50000 },
        TENANT,
      ),
    ).resolves.toMatchObject({ created: 0 });
  });

  it('still surfaces a write failure that is not a duplicate', async () => {
    ArrearsLedger.insertMany.mockRejectedValue(
      new Error('collection unavailable'),
    );

    await expect(
      processRetroactiveArrears(
        revisionOn(new Date(2026, 2, 1)),
        { grossMonthly: 50000 },
        TENANT,
      ),
    ).rejects.toThrow('collection unavailable');
  });
});

describe('bundling unreleased arrears into a run', () => {
  it('sums the outstanding rows and itemises them', async () => {
    ArrearsLedger.find.mockReturnValue(
      findMock([
        {
          _id: 'l1',
          targetMonth: 3,
          targetYear: 2026,
          netArrearsPayout: 5333.33,
          proRatedDays: 16,
          totalDaysInMonth: 31,
        },
        {
          _id: 'l2',
          targetMonth: 4,
          targetYear: 2026,
          netArrearsPayout: 10000,
          proRatedDays: null,
          totalDaysInMonth: 30,
        },
      ]),
    );

    const bundle = await bundleUnreleasedArrears(EMPLOYEE, TENANT);

    expect(bundle.totalArrears).toBe(15333.33);
    expect(bundle.ledgerIds).toEqual(['l1', 'l2']);
    expect(bundle.arrearsBreakdown[0]).toMatchObject({
      month: 3,
      isProRated: true,
      days: 16,
    });
    expect(bundle.arrearsBreakdown[1]).toMatchObject({
      month: 4,
      isProRated: false,
      days: 30,
    });
  });

  it('reads only rows belonging to the caller tenant', async () => {
    await bundleUnreleasedArrears(EMPLOYEE, TENANT);

    expect(ArrearsLedger.find).toHaveBeenCalledWith({
      employeeId: EMPLOYEE,
      tenantId: TENANT,
      isReleased: false,
    });
  });

  it('refuses to read at all without a tenant', async () => {
    // An unscoped read here would bundle another company's arrears into this
    // company's payslip.
    await expect(bundleUnreleasedArrears(EMPLOYEE, null)).resolves.toEqual({
      totalArrears: 0,
      arrearsBreakdown: [],
      ledgerIds: [],
    });
    expect(ArrearsLedger.find).not.toHaveBeenCalled();
  });

  it('returns zero rather than nothing when there is nothing owed', async () => {
    const bundle = await bundleUnreleasedArrears(EMPLOYEE, TENANT);

    expect(bundle).toEqual({
      totalArrears: 0,
      arrearsBreakdown: [],
      ledgerIds: [],
    });
  });
});

describe('releasing arrears', () => {
  it('scopes the update by tenant and by not-already-released', async () => {
    await markArrearsReleased(['l1', 'l2'], PAYROLL, { tenantId: TENANT });

    expect(ArrearsLedger.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['l1', 'l2'] }, isReleased: false, tenantId: TENANT },
      { $set: { isReleased: true, releasedInPayrollId: PAYROLL } },
      {},
    );
  });

  it('joins the transaction it is given', async () => {
    // Released outside the payroll transaction, an abort leaves these rows
    // flagged paid against a payroll row that does not exist, and the money is
    // never paid to anybody.
    const session = { id: 'session' };

    await markArrearsReleased(['l1'], PAYROLL, { tenantId: TENANT, session });

    expect(ArrearsLedger.updateMany.mock.calls[0][2]).toEqual({ session });
  });

  it('does nothing without ids or without a payroll row', async () => {
    await markArrearsReleased([], PAYROLL, { tenantId: TENANT });
    await markArrearsReleased(['l1'], null, { tenantId: TENANT });

    expect(ArrearsLedger.updateMany).not.toHaveBeenCalled();
  });
});
