/**
 * Every background job this product relies on is actually scheduled (#796).
 *
 * `jobs/leaveAccrual.job.js` was complete, tested at the arithmetic level, and
 * never called. Its own header says "Runs on the 1st of every month at 00:00
 * UTC"; there was no `cron.schedule` for it anywhere in the tree. Nothing
 * failed, no log line was missing — `LeaveBalance` was simply never written, so
 * every leave balance in the product read 0.
 *
 * That is the same shape as #614 (a router nobody mounted), #474 (a service
 * nobody subscribed), #664 (a listener nobody registered) and #667 (a cron
 * nobody started). Written down as an assertion this time: `startCronJobs` must
 * register a schedule for each job, and adding a job without scheduling it fails
 * here.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

// payroll.model does not parse on `main` (#792) and cron.jobs.js requires it.
// A factory keeps this suite about scheduling rather than about that.
jest.mock('../../models/payroll.model', () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../models/employee.model');
jest.mock('../../models/cronlock.model');
jest.mock('../../services/email.service', () => ({
  sendPayslipEmail: jest.fn(),
}));
jest.mock('../../utils/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../leaveAccrual.job', () => ({
  processMonthlyAccrual: jest.fn().mockResolvedValue({ ran: true }),
}));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  stream: { write: jest.fn() },
}));

const cron = require('node-cron');
const logger = require('../../utils/logger');
const { startCronJobs } = require('../cron.jobs');
const { processMonthlyAccrual } = require('../leaveAccrual.job');

/** The registered handler for a given cron expression. */
const handlerFor = (expression) => {
  const call = cron.schedule.mock.calls.find(([expr]) => expr === expression);
  return call ? call[1] : undefined;
};

beforeEach(() => {
  jest.clearAllMocks();
  startCronJobs();
});

describe('startCronJobs', () => {
  it('registers the payslip job', () => {
    expect(handlerFor('0 9 1 * *')).toBeInstanceOf(Function);
  });

  it('registers the daily greetings job', () => {
    expect(handlerFor('0 8 * * *')).toBeInstanceOf(Function);
  });

  it('registers the monthly leave accrual job', () => {
    // This is the assertion #646 needed and did not have.
    expect(handlerFor('30 0 1 * *')).toBeInstanceOf(Function);
  });

  it('registers one schedule per job and no more', () => {
    expect(cron.schedule).toHaveBeenCalledTimes(3);
  });

  it('runs on the 1st of the month, after midnight', () => {
    // Not *on* midnight: a run that starts a few seconds early computes the
    // period from the previous month and credits it a second time.
    const [expression] = cron.schedule.mock.calls.find(
      ([expr]) => expr.endsWith('1 * *') && expr !== '0 9 1 * *',
    );
    const [minute, hour, dayOfMonth] = expression.split(' ');

    expect(dayOfMonth).toBe('1');
    expect(Number(hour)).toBe(0);
    expect(Number(minute)).toBeGreaterThan(0);
  });
});

describe('the scheduled accrual handler', () => {
  it('calls the job', async () => {
    await handlerFor('30 0 1 * *')();

    expect(processMonthlyAccrual).toHaveBeenCalled();
  });

  it('logs a rejection rather than leaving it unhandled', async () => {
    // node-cron does not await the callback, so a rejection escaping it becomes
    // an unhandled rejection — which Node terminates the process for by
    // default. It has to be caught here and turned into a log line.
    processMonthlyAccrual.mockRejectedValueOnce(new Error('mongo is down'));

    expect(() => handlerFor('30 0 1 * *')()).not.toThrow();
    await new Promise(process.nextTick);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/leave accrual/i),
      expect.objectContaining({ error: 'mongo is down' }),
    );
  });
});
