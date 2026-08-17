jest.mock('../../models/employee.model', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../../models/payroll.model', () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
}));

const Employee = require('../../models/employee.model');
const PayrollUpdate = require('../../models/payroll.model');
const {
  buildReport,
  reportWindow,
  periodFilter,
  toCsv,
  escapeCsvField,
  CUSTOM_COLUMNS,
} = require('../reportBuilders');

const TENANT_ID = 'tenant-1';
const NOW = new Date('2026-08-06T00:30:00');

/** find(...).sort(...).lean() */
const findResult = (rows) => {
  const chain = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return chain;
};

const schedule = (overrides = {}) => ({
  _id: 's1',
  tenantId: TENANT_ID,
  reportType: 'payroll',
  frequency: 'monthly',
  recipients: ['hr@acme.com'],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  Employee.find.mockReturnValue(findResult([]));
  Employee.countDocuments.mockResolvedValue(0);
  PayrollUpdate.find.mockReturnValue(findResult([]));
  PayrollUpdate.aggregate.mockResolvedValue([]);
});

describe('reportWindow (#667)', () => {
  test('a monthly report covers the month that just ended', () => {
    const window = reportWindow('monthly', NOW);

    expect(window.start.getFullYear()).toBe(2026);
    expect(window.start.getMonth()).toBe(6); // July
    expect(window.start.getDate()).toBe(1);
    expect(window.end.getMonth()).toBe(6);
    expect(window.end.getDate()).toBe(31);
    expect(window.label).toBe('2026-07');
  });

  test('stepping back a month from the 31st does not skip one', () => {
    // `setMonth(getMonth() - 1)` on 31 March lands in March again, because
    // February has no 31st — the trap cron.jobs.js#previousPeriod documents.
    const window = reportWindow('monthly', new Date('2026-03-31T00:30:00'));

    expect(window.start.getMonth()).toBe(1); // February
    expect(window.label).toBe('2026-02');
  });

  test('a daily report covers yesterday', () => {
    const window = reportWindow('daily', NOW);

    expect(window.start.getDate()).toBe(5);
    expect(window.end.getDate()).toBe(5);
    expect(window.label).toBe(
      new Date(2026, 7, 5).toISOString().slice(0, 10),
    );
  });

  test('a weekly report covers the seven days ending yesterday', () => {
    const window = reportWindow('weekly', NOW);

    expect(window.start.getDate()).toBe(30); // 30 July
    expect(window.start.getMonth()).toBe(6);
    expect(window.end.getDate()).toBe(5);
  });
});

describe('periodFilter (#667)', () => {
  test('a range inside one year is a month range', () => {
    expect(
      periodFilter(new Date(2026, 0, 1), new Date(2026, 5, 30)),
    ).toEqual({ year: 2026, month: { $gte: 1, $lte: 6 } });
  });

  test('a range spanning a year boundary is an $or', () => {
    const filter = periodFilter(new Date(2025, 10, 1), new Date(2026, 1, 28));

    expect(filter.$or).toHaveLength(3);
  });
});

describe('escapeCsvField / toCsv (#667)', () => {
  test('neutralises a formula-injection payload', () => {
    expect(escapeCsvField('=cmd|calc')).toBe("'=cmd|calc");
    expect(escapeCsvField('+1')).toBe("'+1");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  test('quotes a field containing a comma, newline or quote', () => {
    expect(escapeCsvField('Acme, Inc')).toBe('"Acme, Inc"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  test('renders null and undefined as empty', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  test('assembles a header and rows', () => {
    expect(toCsv(['A', 'B'], [[1, 2], [3, 4]])).toBe('A,B\n1,2\n3,4');
  });
});

describe('buildReport — scoping and dispatch (#667)', () => {
  test('rejects an unknown report type rather than mailing nothing', async () => {
    await expect(
      buildReport(schedule({ reportType: 'astrology' }), NOW),
    ).rejects.toThrow(/Unsupported report type/);
  });

  test('a payroll report is scoped to the schedule tenant', async () => {
    await buildReport(schedule({ reportType: 'payroll' }), NOW);

    expect(PayrollUpdate.find.mock.calls[0][0].tenantId).toBe(TENANT_ID);
  });

  test('a payroll report contains only payable rows', async () => {
    // A register is a financial record: what was approved for payment, not a
    // mixture of drafts and rejected rows (#458).
    await buildReport(schedule({ reportType: 'payroll' }), NOW);

    expect(PayrollUpdate.find.mock.calls[0][0]).toHaveProperty('status');
  });

  test('an analytics report is scoped on both halves', async () => {
    await buildReport(schedule({ reportType: 'analytics' }), NOW);

    expect(Employee.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
    expect(PayrollUpdate.aggregate.mock.calls[0][0][0].$match.tenantId).toBe(
      TENANT_ID,
    );
  });

  test('a turnover report lists the leavers in the window', async () => {
    Employee.find.mockReturnValue(
      findResult([
        {
          fullName: 'Alice',
          department: 'Engineering',
          role: 'Engineer',
          joiningDate: new Date('2024-01-01'),
          exitDetails: {
            exitDate: new Date('2026-07-15'),
            exitType: 'resignation',
            reason: 'Relocating',
          },
        },
      ]),
    );

    const report = await buildReport(schedule({ reportType: 'turnover' }), NOW);

    expect(Employee.find.mock.calls[0][0].tenantId).toBe(TENANT_ID);
    expect(report.rows).toBe(1);
    expect(report.content).toContain('Alice');
    expect(report.content).toContain('resignation');
  });

  test('a custom report only projects allow-listed columns', async () => {
    // Passing config.columns straight into select() would let a stored
    // configuration project a field the report was never meant to carry.
    Employee.find.mockReturnValue(findResult([]));

    await buildReport(
      schedule({
        reportType: 'custom',
        config: { dataset: 'employees', columns: ['fullName', 'password', 'bankDetails'] },
      }),
      NOW,
    );

    const projected = Employee.find.mock.results[0].value.select.mock.calls[0][0];
    expect(projected).toBe('fullName');
    expect(projected).not.toContain('password');
    expect(projected).not.toContain('bankDetails');
  });

  test('a custom report with no columns falls back to the full allow-list', async () => {
    await buildReport(
      schedule({ reportType: 'custom', config: { dataset: 'payroll' } }),
      NOW,
    );

    expect(
      PayrollUpdate.find.mock.results[0].value.select.mock.calls[0][0],
    ).toBe(CUSTOM_COLUMNS.payroll.join(' '));
  });

  test('rejects an unknown custom dataset', async () => {
    await expect(
      buildReport(
        schedule({ reportType: 'custom', config: { dataset: 'secrets' } }),
        NOW,
      ),
    ).rejects.toThrow(/Unsupported custom report dataset/);
  });

  test('names the attachment after the type and the period', async () => {
    const report = await buildReport(schedule({ reportType: 'payroll' }), NOW);

    expect(report.filename).toBe('payroll-2026-07.csv');
  });
});
