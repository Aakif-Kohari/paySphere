const fs = require('fs');
const path = require('path');

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../models/reportSchedule.model', () => ({ find: jest.fn() }));
jest.mock('../../models/cronlock.model', () => ({
  create: jest.fn(),
  deleteOne: jest.fn(),
}));
jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../reportBuilders', () => ({
  buildReport: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const cron = require('node-cron');
const ReportSchedule = require('../../models/reportSchedule.model');
const CronLock = require('../../models/cronlock.model');
const { sendEmail } = require('../../utils/email');
const { buildReport } = require('../reportBuilders');
const logger = require('../../utils/logger');
const {
  startReportCron,
  runScheduledReports,
  runSchedule,
  isDue,
  periodKey,
} = require('../reportCron');

const INDEX_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../index.js'),
  'utf8',
);
const CRON_SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../reportCron.js'),
  'utf8',
);

const NOW = new Date('2026-08-06T00:30:00');

const buildSchedule = (overrides = {}) => ({
  _id: 'schedule-1',
  reportType: 'payroll',
  frequency: 'daily',
  recipients: ['hr@acme.com'],
  tenantId: 'tenant-1',
  isActive: true,
  lastRunAt: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  CronLock.create.mockResolvedValue({});
  CronLock.deleteOne.mockResolvedValue({});
  ReportSchedule.find.mockResolvedValue([]);
  sendEmail.mockResolvedValue({ success: true });
  buildReport.mockResolvedValue({
    filename: 'payroll-2026-08-05.csv',
    content: 'Employee Name,Net Salary\nAlice,50000',
    rows: 1,
    window: {
      start: new Date('2026-08-05T00:00:00Z'),
      end: new Date('2026-08-05T23:59:59Z'),
      label: '2026-08-05',
    },
  });
});

describe('reportCron — no side effect on require (#667)', () => {
  test('requiring the module does not schedule anything', () => {
    // `cron.schedule(...)` used to sit at the bottom of the module, so any
    // import started a live timer — including a Jest run that only wanted one
    // function out of it.
    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('the schedule call lives inside the exported starter', () => {
    startReportCron();

    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule.mock.calls[0][0]).toBe('30 0 * * *');
  });

  test('index.js calls the starter instead of importing for the side effect', () => {
    expect(INDEX_SOURCE).toMatch(/startReportCron\(\)/);
    expect(INDEX_SOURCE).not.toMatch(
      /^\s*require\(["']\.\/jobs\/reportCron["']\);/m,
    );
  });
});

describe('periodKey / isDue — calendar periods, not elapsed days (#667)', () => {
  test('a daily schedule run just after midnight yesterday is due tonight', () => {
    // The reported drift. lastRunAt is stamped when the previous run finished,
    // a few hundred ms after 00:00, so `(now - lastRunAt) / 86400000` came out
    // at 0.99999… — not >= 1 — and the schedule silently skipped a day.
    const schedule = buildSchedule({
      frequency: 'daily',
      lastRunAt: new Date('2026-08-05T00:30:00.400'),
    });

    const elapsedDays = (NOW - schedule.lastRunAt) / 86400000;
    expect(elapsedDays).toBeLessThan(1);

    expect(isDue(schedule, NOW)).toBe(true);
  });

  test('a daily schedule already run today is not due again', () => {
    expect(
      isDue(
        buildSchedule({
          frequency: 'daily',
          lastRunAt: new Date('2026-08-06T00:30:00'),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  test('a schedule that has never run is due', () => {
    expect(isDue(buildSchedule({ lastRunAt: null }), NOW)).toBe(true);
  });

  test('a monthly schedule run last month is due, and one run this month is not', () => {
    expect(
      isDue(
        buildSchedule({
          frequency: 'monthly',
          lastRunAt: new Date('2026-07-01T00:30:00'),
        }),
        NOW,
      ),
    ).toBe(true);

    expect(
      isDue(
        buildSchedule({
          frequency: 'monthly',
          lastRunAt: new Date('2026-08-01T00:30:00'),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  test('a monthly schedule fires once in February, not twice', () => {
    // `diffDays >= 30` fires on 1 March and again on 31 March.
    const feb = new Date('2026-02-15T00:30:00');
    const ranInFeb = buildSchedule({
      frequency: 'monthly',
      lastRunAt: new Date('2026-02-01T00:30:00'),
    });

    expect(isDue(ranInFeb, feb)).toBe(false);
    expect(isDue(ranInFeb, new Date('2026-03-03T00:30:00'))).toBe(true);
  });

  test('a weekly schedule keys off the Monday of the week', () => {
    // 2026-08-03 is a Monday; 06 and 09 are the Thursday and Sunday after it.
    expect(periodKey('weekly', new Date('2026-08-03T12:00:00'))).toBe(
      periodKey('weekly', new Date('2026-08-06T12:00:00')),
    );
    expect(periodKey('weekly', new Date('2026-08-09T12:00:00'))).not.toBe(
      periodKey('weekly', new Date('2026-08-10T12:00:00')),
    );
  });
});

describe('runSchedule — real generation and delivery (#667)', () => {
  test('mails the generated report as an attachment', () => {
    // The whole bug: the old body was four comments and a "Simulated sending"
    // log line, and nothing was ever produced or delivered.
    const code = CRON_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(
      /^\s*\/\/.*$/gm,
      '',
    );

    expect(code).not.toMatch(/Simulated/);
    expect(code).toMatch(/sendEmail\(/);
  });

  test('the attachment is the built report', async () => {
    const schedule = buildSchedule();

    const result = await runSchedule(schedule, NOW);

    expect(buildReport).toHaveBeenCalledWith(schedule, NOW);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hr@acme.com',
        attachments: [
          {
            filename: 'payroll-2026-08-05.csv',
            content: 'Employee Name,Net Salary\nAlice,50000',
          },
        ],
      }),
    );
    expect(result).toEqual({ delivered: true, rows: 1 });
  });

  test('stamps lastRunAt on a delivery that actually happened', async () => {
    const schedule = buildSchedule();

    await runSchedule(schedule, NOW);

    expect(schedule.lastRunAt).toBe(NOW);
    expect(schedule.save).toHaveBeenCalled();
  });

  test('does NOT stamp lastRunAt when delivery failed', async () => {
    // sendEmail resolves with { success: false } when SMTP is unconfigured; the
    // old code would have stamped anyway and the schedule would look healthy.
    sendEmail.mockResolvedValue({ success: false, error: 'SMTP configuration missing' });
    const schedule = buildSchedule();

    const result = await runSchedule(schedule, NOW);

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('SMTP configuration missing');
    expect(schedule.lastRunAt).toBeNull();
    expect(schedule.save).not.toHaveBeenCalled();
  });

  test('addresses all the recipients in one message', async () => {
    await runSchedule(
      buildSchedule({ recipients: ['hr@acme.com', 'finance@acme.com'] }),
      NOW,
    );

    expect(sendEmail.mock.calls[0][0].to).toBe('hr@acme.com, finance@acme.com');
  });
});

describe('runScheduledReports — locking and isolation (#667)', () => {
  test('takes a lock before doing any work', async () => {
    await runScheduledReports({ now: NOW });

    expect(CronLock.create).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.stringContaining('report_schedules_') }),
    );
  });

  test('does nothing when another instance holds the lock', async () => {
    CronLock.create.mockRejectedValue({ code: 11000 });

    const result = await runScheduledReports({ now: NOW });

    expect(result).toMatchObject({ ran: false, reason: 'held', delivered: 0 });
    expect(ReportSchedule.find).not.toHaveBeenCalled();
  });

  test('releases the lock even when the run fails', async () => {
    ReportSchedule.find.mockRejectedValue(new Error('mongo is down'));

    const result = await runScheduledReports({ now: NOW });

    expect(result.ran).toBe(false);
    expect(CronLock.deleteOne).toHaveBeenCalled();
  });

  test('only looks at active schedules', async () => {
    await runScheduledReports({ now: NOW });

    expect(ReportSchedule.find).toHaveBeenCalledWith({ isActive: true });
  });

  test('skips schedules that are not due', async () => {
    ReportSchedule.find.mockResolvedValue([
      buildSchedule({ lastRunAt: new Date('2026-08-06T00:30:00') }),
    ]);

    const result = await runScheduledReports({ now: NOW });

    expect(result).toMatchObject({ ran: true, due: 0, delivered: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('one failing schedule does not abort the rest of the batch', async () => {
    // The `try` used to wrap the whole loop, so a single bad schedule stopped
    // every schedule after it — and they never got their lastRunAt stamped, so
    // they queued behind it indefinitely.
    const broken = buildSchedule({ _id: 'broken' });
    const healthy = buildSchedule({ _id: 'healthy' });

    ReportSchedule.find.mockResolvedValue([broken, healthy]);
    buildReport
      .mockRejectedValueOnce(new Error('tenant is gone'))
      .mockResolvedValueOnce({
        filename: 'payroll.csv',
        content: 'x',
        rows: 0,
        window: {
          start: new Date('2026-08-05T00:00:00Z'),
          end: new Date('2026-08-05T23:59:59Z'),
          label: '2026-08-05',
        },
      });

    const result = await runScheduledReports({ now: NOW });

    expect(result).toMatchObject({ ran: true, due: 2, delivered: 1, failed: 1 });
    expect(healthy.save).toHaveBeenCalled();
    expect(broken.save).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Scheduled report failed',
      expect.objectContaining({ error: 'tenant is gone' }),
    );
  });

  test('counts a delivery failure without stopping', async () => {
    ReportSchedule.find.mockResolvedValue([buildSchedule()]);
    sendEmail.mockResolvedValue({ success: false, error: 'mailbox full' });

    const result = await runScheduledReports({ now: NOW });

    expect(result).toMatchObject({ ran: true, due: 1, delivered: 0, failed: 1 });
  });
});
