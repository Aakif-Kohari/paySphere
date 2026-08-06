const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const { generatePayrollCSV } = require('../utils/csvExport');
const { payableStatusFilter } = require('../config/payrollStatus');

/**
 * Turning a due `ReportSchedule` into an actual attachment (#667).
 *
 * `reportCron.js` used to log four comment lines where this belongs:
 *
 *     // 1. Determine date range
 *     // 2. Query database or invoke the relevant controller logic
 *     // 3. Generate PDF/CSV buffer
 *     // 4. Send email to schedule.recipients
 *     logger.info(`Cron: Simulated sending email to ...`);
 *
 * and then stamped `lastRunAt` as though it had done all four. The schedule list
 * showed a recent run for a report that was never produced and never delivered.
 *
 * Everything here is scoped by `schedule.tenantId`. A report is one company's
 * data, and `{ tenantId: undefined }` is a filter mongoose deletes rather than
 * one that matches nothing — see utils/tenantScope.js.
 */

/** Escape one CSV cell, neutralising spreadsheet formula injection. */
function escapeCsvField(value) {
  if (value === undefined || value === null) return '';

  let str = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;

  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/** Assemble a CSV document from a header row and an array of rows. */
function toCsv(header, rows) {
  return [
    header.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');
}

/**
 * The calendar window a schedule of this frequency covers, ending at `now`.
 *
 * A daily report covers yesterday, a weekly one the previous seven days, a
 * monthly one the month that just ended. Anchored to the 1st before stepping
 * back a month, because `setMonth(getMonth() - 1)` on the 31st lands on the
 * wrong month whenever the previous one is shorter — the same trap
 * `cron.jobs.js#previousPeriod` documents.
 *
 * @param {string} frequency
 * @param {Date} now
 * @returns {{start: Date, end: Date, label: string}}
 */
function reportWindow(frequency, now) {
  const endOfYesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    -1,
  );

  if (frequency === 'monthly') {
    const anchor = new Date(now.getFullYear(), now.getMonth(), 1);
    anchor.setMonth(anchor.getMonth() - 1);

    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    return {
      start,
      end,
      label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    };
  }

  if (frequency === 'weekly') {
    const start = new Date(endOfYesterday);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    return {
      start,
      end: endOfYesterday,
      label: `${start.toISOString().slice(0, 10)}_to_${endOfYesterday
        .toISOString()
        .slice(0, 10)}`,
    };
  }

  const start = new Date(endOfYesterday);
  start.setHours(0, 0, 0, 0);

  return {
    start,
    end: endOfYesterday,
    label: start.toISOString().slice(0, 10),
  };
}

/**
 * A `{ year, month }` filter covering a calendar window.
 *
 * Payroll rows carry `month` (1-12) and `year` rather than one timestamp, so a
 * date range has to be mapped onto the pair. Same shape as
 * reports.controller.js#periodRangeFilter.
 *
 * @param {Date} start
 * @param {Date} end
 * @returns {object}
 */
function periodFilter(start, end) {
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  if (startYear === endYear) {
    return { year: startYear, month: { $gte: startMonth, $lte: endMonth } };
  }

  return {
    $or: [
      { year: { $gt: startYear, $lt: endYear } },
      { year: startYear, month: { $gte: startMonth } },
      { year: endYear, month: { $lte: endMonth } },
    ],
  };
}

/** The approved payroll register for the window. */
async function buildPayrollReport(schedule, window) {
  const payrolls = await PayrollUpdate.find({
    tenantId: schedule.tenantId,
    ...periodFilter(window.start, window.end),
    // A payroll register is a financial record: it holds what was approved for
    // payment, not a mixture of drafts and rejected rows (#458).
    ...payableStatusFilter(),
  })
    .sort({ year: 1, month: 1, employeeName: 1 })
    .lean();

  return {
    rows: payrolls.length,
    csv: generatePayrollCSV(
      payrolls,
      window.start.getMonth() + 1,
      window.start.getFullYear(),
    ),
  };
}

/** Headcount and payout totals per month across the window. */
async function buildAnalyticsReport(schedule, window) {
  const [headcount, byMonth] = await Promise.all([
    Employee.countDocuments({
      tenantId: schedule.tenantId,
      deletedAt: null,
    }),
    PayrollUpdate.aggregate([
      {
        $match: {
          tenantId: schedule.tenantId,
          ...periodFilter(window.start, window.end),
        },
      },
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          employees: { $sum: 1 },
          totalNet: { $sum: '$netSalary' },
          totalBonus: { $sum: '$bonus' },
          totalDeductions: { $sum: '$deductions' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const round2 = (n) => Math.round((n || 0) * 100) / 100;

  const rows = byMonth.map((entry) => [
    entry._id.year,
    entry._id.month,
    entry.employees,
    round2(entry.totalNet),
    round2(entry.totalBonus),
    round2(entry.totalDeductions),
  ]);

  // The current headcount is context for the figures above it, not a row of
  // its own — it goes in the filename-adjacent summary line.
  rows.push([]);
  rows.push(['Current headcount', headcount]);

  return {
    rows: byMonth.length,
    csv: toCsv(
      [
        'Year',
        'Month',
        'Employees Paid',
        'Total Net',
        'Total Bonus',
        'Total Deductions',
      ],
      rows,
    ),
  };
}

/** Everyone who left during the window. */
async function buildTurnoverReport(schedule, window) {
  const leavers = await Employee.find({
    tenantId: schedule.tenantId,
    'exitDetails.exitDate': { $gte: window.start, $lte: window.end },
  })
    .select('fullName department role joiningDate exitDetails')
    .sort({ 'exitDetails.exitDate': 1 })
    .lean();

  const rows = leavers.map((employee) => [
    employee.fullName,
    employee.department,
    employee.role,
    employee.joiningDate
      ? new Date(employee.joiningDate).toISOString().slice(0, 10)
      : '',
    employee.exitDetails?.exitDate
      ? new Date(employee.exitDetails.exitDate).toISOString().slice(0, 10)
      : '',
    employee.exitDetails?.exitType,
    employee.exitDetails?.reason,
  ]);

  return {
    rows: rows.length,
    csv: toCsv(
      [
        'Employee',
        'Department',
        'Role',
        'Joined',
        'Exited',
        'Exit Type',
        'Reason',
      ],
      rows,
    ),
  };
}

/** The columns a custom report may select, per dataset. */
const CUSTOM_COLUMNS = {
  employees: [
    'fullName',
    'email',
    'department',
    'role',
    'monthlySalary',
    'joiningDate',
    'employmentStatus',
  ],
  payroll: [
    'employeeName',
    'month',
    'year',
    'baseSalary',
    'bonus',
    'deductions',
    'netSalary',
    'status',
  ],
};

/**
 * A user-configured column selection over one dataset.
 *
 * Columns are intersected with an allow-list rather than passed through, so a
 * stored `config.columns` cannot project a field the report was never meant to
 * carry — bank details, password hashes — if one is added to a schema later.
 */
async function buildCustomReport(schedule, window) {
  const dataset = schedule.config?.dataset || 'employees';
  const allowed = CUSTOM_COLUMNS[dataset];

  if (!allowed) {
    throw new Error(`Unsupported custom report dataset: ${dataset}`);
  }

  const requested = (schedule.config?.columns || []).filter((column) =>
    allowed.includes(column),
  );
  const columns = requested.length > 0 ? requested : allowed;

  const documents =
    dataset === 'employees'
      ? await Employee.find({ tenantId: schedule.tenantId, deletedAt: null })
          .select(columns.join(' '))
          .sort({ fullName: 1 })
          .lean()
      : await PayrollUpdate.find({
          tenantId: schedule.tenantId,
          ...periodFilter(window.start, window.end),
        })
          .select(columns.join(' '))
          .sort({ year: 1, month: 1, employeeName: 1 })
          .lean();

  return {
    rows: documents.length,
    csv: toCsv(
      columns,
      documents.map((doc) => columns.map((column) => doc[column])),
    ),
  };
}

const BUILDERS = {
  payroll: buildPayrollReport,
  analytics: buildAnalyticsReport,
  turnover: buildTurnoverReport,
  custom: buildCustomReport,
};

/**
 * Build the attachment for one schedule.
 *
 * @param {object} schedule a ReportSchedule document
 * @param {Date} now
 * @returns {Promise<{filename: string, content: string, rows: number, window: object}>}
 */
async function buildReport(schedule, now = new Date()) {
  const builder = BUILDERS[schedule.reportType];

  if (!builder) {
    throw new Error(`Unsupported report type: ${schedule.reportType}`);
  }

  const window = reportWindow(schedule.frequency, now);
  const { csv, rows } = await builder(schedule, window);

  return {
    filename: `${schedule.reportType}-${window.label}.csv`,
    content: csv,
    rows,
    window,
  };
}

module.exports = {
  buildReport,
  reportWindow,
  periodFilter,
  toCsv,
  escapeCsvField,
  CUSTOM_COLUMNS,
  BUILDERS,
};
