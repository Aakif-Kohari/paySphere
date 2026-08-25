/**
 * @fileoverview Minimum Wages Act, 1948 (#1698).
 *
 * The controller's job is assembling the comparison, and the interesting half
 * of that is deciding what an employee was actually offered for a wage period.
 *
 * It is taken from the salary *structure* in force on the period rather than
 * from `payroll.baseSalary`, because the Act compares against components and
 * the payroll row has collapsed them into a single figure by the time it is
 * written. `salaryStructure.js` already resolves the revision in force on a
 * date and computes each component's amount; this reads the earnings out of
 * that and hands them to the engine, which decides which of them count.
 *
 * Days worked come from the payroll row's `leaveDays`, the same approximation
 * `statutoryBonus.controller.js` and `settlement.js` make where a tenant has no
 * attendance ledger, and for the same reason: it is the only record of absence
 * that exists for every tenant.
 *
 * Everything that decides a number is in `utils/minimumWages.js`.
 */

const mongoose = require('mongoose');

const {
  MinimumWageNotification,
  MinimumWageAssessment,
} = require('../models/minimumWage.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const SalaryStructure = require('../models/salaryStructure.model');
const { PAYROLL_STATUS } = require('../config/payrollStatus');
const { COMPONENT_TYPE } = require('../config/salaryComponents');
const {
  resolveStructureOnDate,
  computeComponentAmounts,
} = require('../utils/salaryStructure');
const {
  DEFAULT_EXCLUSION_PATTERNS,
  EXCLUDED_COMPONENT,
  SKILL_CATEGORY,
  AREA_CLASS,
  assessPeriod,
  retrospectiveArrears,
} = require('../utils/minimumWages');
const eventBus = require('../services/event.service');

/**
 * The wage period being assessed.
 *
 * Monthly, because that is the Act's wage period under section 4 and because
 * section 20 compensation accrues from the period the shortfall occurred in. A
 * yearly average would hide a shortfall in one month behind a surplus in
 * another and would not be a defence.
 *
 * @param {object} query
 * @returns {{month: number, year: number, periodStart: Date, periodEnd: Date}}
 */
function resolvePeriod(query) {
  const now = new Date();

  const year = Number(query.year) || now.getUTCFullYear();
  const month = Number(query.month) || now.getUTCMonth() + 1;

  return {
    month,
    year,
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    // Day 0 of the next month is the last day of this one, which avoids
    // hard-coding 28/30/31 and gets February right in a leap year.
    periodEnd: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

/**
 * A tenant's component mapping, or the default one.
 *
 * Stored as source strings because a RegExp does not survive BSON, and
 * compiled here. An unparseable pattern is dropped rather than thrown on: a
 * bad row in the tenant's configuration should cost that one rule, not the
 * whole assessment.
 *
 * @param {Array<{pattern: string, code: string}>} [configured]
 * @returns {{patterns: Array<[RegExp, string]>, serialised: Array<object>}}
 */
function resolveExclusionPatterns(configured) {
  if (!Array.isArray(configured) || configured.length === 0) {
    return {
      patterns: DEFAULT_EXCLUSION_PATTERNS,
      serialised: DEFAULT_EXCLUSION_PATTERNS.map(([pattern, code]) => ({
        pattern: pattern.source,
        code,
      })),
    };
  }

  const patterns = [];
  const serialised = [];

  for (const rule of configured) {
    if (!rule || !EXCLUDED_COMPONENT[rule.code]) continue;

    try {
      patterns.push([new RegExp(rule.pattern, 'i'), rule.code]);
      serialised.push({ pattern: rule.pattern, code: rule.code });
    } catch {
      // An invalid pattern is a configuration error the tenant can see in the
      // assessment's recorded mapping — the rule is simply absent from it.
      continue;
    }
  }

  if (!patterns.length) {
    return resolveExclusionPatterns(null);
  }

  return { patterns, serialised };
}

/**
 * The workforce for a wage period, in the shape the engine wants.
 *
 * Three collections read in full rather than per employee: this runs across the
 * whole headcount, and the per-employee version is the shape that quietly
 * becomes a thousand round trips on a five-hundred-person tenant. The same
 * reasoning `statutoryBonus.controller.js` gives for its aggregate.
 *
 * @param {string} tenantId
 * @param {{month: number, year: number, periodStart: Date, periodEnd: Date}} period
 * @returns {Promise<Array<object>>}
 */
async function assembleWorkforce(tenantId, period) {
  const employees = await Employee.find(
    { tenantId, isActive: true },
    'fullName role department monthlySalary statutoryClassification',
  ).lean();

  if (!employees.length) return [];

  const employeeIds = employees.map((e) => e._id);

  const [structures, payrollRows] = await Promise.all([
    SalaryStructure.find(
      { tenantId, employeeId: { $in: employeeIds } },
      'employeeId effectiveFrom grossMonthly components',
    ).lean(),
    PayrollUpdate.find(
      {
        tenantId,
        employeeId: { $in: employeeIds },
        month: period.month,
        year: period.year,
        status: { $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID] },
      },
      'employeeId leaveDays overtimeHours overtimePay baseSalary',
    ).lean(),
  ]);

  const structuresByEmployee = new Map();
  for (const structure of structures) {
    const id = String(structure.employeeId);
    if (!structuresByEmployee.has(id)) structuresByEmployee.set(id, []);
    structuresByEmployee.get(id).push(structure);
  }

  const payrollByEmployee = new Map(
    payrollRows.map((row) => [String(row.employeeId), row]),
  );

  const daysInPeriod = new Date(
    Date.UTC(period.year, period.month, 0),
  ).getUTCDate();

  return employees.map((employee) => {
    const id = String(employee._id);
    const classification = employee.statutoryClassification || {};
    const payroll = payrollByEmployee.get(id);

    const structure = resolveStructureOnDate(
      structuresByEmployee.get(id) || [],
      period.periodEnd,
    );

    // No structure on file means the tenant has not migrated this employee to
    // components yet. Falling back to the single figure is not a guess about
    // the split — it is the honest statement that the whole salary counts,
    // which is the position most favourable to the employer and therefore the
    // one an assessment should not silently improve on.
    const components = structure
      ? computeComponentAmounts(structure)
          .components.filter((c) => c.type === COMPONENT_TYPE.EARNING)
          .map((c) => ({ name: c.label || c.code, amount: c.amount }))
      : [
          {
            name: 'Monthly salary',
            amount: Number(employee.monthlySalary) || 0,
          },
        ];

    const leaveDays = payroll ? Number(payroll.leaveDays) || 0 : 0;

    return {
      employeeId: employee._id,
      name: employee.fullName || '',
      designation: employee.role || '',

      state: classification.state || '',
      scheduledEmployment: classification.scheduledEmployment || '',
      areaClass: classification.areaClass || '',
      skillCategory: classification.skillCategory || '',

      // Days worked is the period less the leave taken, floored at zero. An
      // employee with no approved payroll row for the month has no evidence of
      // absence, so the full period stands.
      daysWorked: Math.max(0, daysInPeriod - leaveDays),
      daysInPeriod,

      overtimeHours: payroll ? Number(payroll.overtimeHours) || 0 : 0,
      overtimePaid: payroll ? Number(payroll.overtimePay) || 0 : 0,

      components,
    };
  });
}

/**
 * Run an assessment without writing anything.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>}
 */
async function runAssessment(req) {
  const period = resolvePeriod({ ...req.query, ...req.body });

  const [employees, notifications] = await Promise.all([
    assembleWorkforce(req.tenantId, period),
    MinimumWageNotification.find({ tenantId: req.tenantId }).lean(),
  ]);

  const { patterns, serialised } = resolveExclusionPatterns(
    req.body ? req.body.exclusionPatterns : null,
  );

  const result = assessPeriod({
    employees,
    notifications,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    cpiPoints: Number(req.body && req.body.cpiPoints) || 0,
    exclusionPatterns: patterns,
  });

  return { period, result, exclusionPatterns: serialised };
}

/**
 * GET /api/minimum-wages/notifications
 *
 * Newest first, since the question is almost always "what is in force now".
 */
exports.listNotifications = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.state) filter.state = String(req.query.state).toUpperCase();

    const notifications = await MinimumWageNotification.find(filter)
      .sort({ effectiveFrom: -1, state: 1 })
      .limit(Math.min(Number(req.query.limit) || 200, 500))
      .lean();

    return res.json({
      notifications,
      skillCategories: Object.values(SKILL_CATEGORY),
      areaClasses: Object.values(AREA_CLASS),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/minimum-wages/notifications
 *
 * Creates rather than upserts. A notification is a gazette entry, and the
 * append-only collection is what lets an assessment of a closed period be
 * reproduced — see the header of `minimumWage.model.js`.
 */
exports.createNotification = async (req, res, next) => {
  try {
    const effectiveFrom = new Date(req.body.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      return res
        .status(400)
        .json({ message: 'effectiveFrom must be a valid date' });
    }

    const notification = await MinimumWageNotification.create({
      tenantId: req.tenantId,
      state: String(req.body.state || '').toUpperCase(),
      scheduledEmployment: req.body.scheduledEmployment,
      areaClass: req.body.areaClass,
      areaClassLabel: req.body.areaClassLabel || '',
      skillCategory: req.body.skillCategory,
      notificationRef: req.body.notificationRef || '',
      effectiveFrom,
      rateBasis: req.body.rateBasis,
      basicRate: Number(req.body.basicRate) || 0,
      vdaBaseCpiPoints: Number(req.body.vdaBaseCpiPoints) || 0,
      vdaRatePerPoint: Number(req.body.vdaRatePerPoint) || 0,
      vdaRounding: Number(req.body.vdaRounding) || 1,
      notes: req.body.notes || '',
      createdBy: req.userId,
    });

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MINIMUM_WAGE_NOTIFICATION_ADDED',
      resourceType: 'MinimumWageNotification',
      resourceIds: [notification._id],
      details: {
        state: notification.state,
        skillCategory: notification.skillCategory,
        effectiveFrom: notification.effectiveFrom,
        basicRate: notification.basicRate,
      },
      req,
    });

    return res.status(201).json({ notification });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
};

/**
 * POST /api/minimum-wages/preview
 *
 * Writes nothing. The CPI reading and the component mapping are both argued
 * over before they settle, and an assessment is run several times before one
 * is committed.
 */
exports.previewAssessment = async (req, res, next) => {
  try {
    const { period, result } = await runAssessment(req);

    return res.json({
      preview: true,
      month: period.month,
      year: period.year,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      result,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/minimum-wages/assessments
 *
 * Upserted on (tenant, period start) so re-running June corrects June rather
 * than producing a second June. Two Junes would be double-counted by the
 * arrears engine, which reads prior assessments to net off what has already
 * been recognised.
 */
exports.commitAssessment = async (req, res, next) => {
  try {
    const { period, result, exclusionPatterns } = await runAssessment(req);

    const assessment = await MinimumWageAssessment.findOneAndUpdate(
      { tenantId: req.tenantId, periodStart: period.periodStart },
      {
        $set: {
          tenantId: req.tenantId,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          cpiPoints: result.cpiPoints,
          cpiAsAt: req.body.cpiAsAt ? new Date(req.body.cpiAsAt) : null,

          assessedCount: result.assessedCount,
          excludedCount: result.excludedCount,
          shortfallCount: result.shortfallCount,

          wageShortfall: result.wageShortfall,
          overtimeShortfall: result.overtimeShortfall,
          totalShortfall: result.totalShortfall,
          compliant: result.compliant,

          lines: result.lines,
          exclusions: result.exclusions,
          byState: result.byState,
          exclusionPatterns,

          committedBy: req.userId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MINIMUM_WAGE_ASSESSMENT_COMMITTED',
      resourceType: 'MinimumWageAssessment',
      resourceIds: [assessment._id],
      details: {
        periodStart: assessment.periodStart,
        assessedCount: assessment.assessedCount,
        shortfallCount: assessment.shortfallCount,
        totalShortfall: assessment.totalShortfall,
      },
      req,
    });

    return res.status(201).json({ assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/minimum-wages/assessments
 *
 * The list view, without the per-employee lines. A year of assessments across
 * a five-hundred-person tenant is six thousand embedded documents, and the
 * history panel needs none of them.
 */
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await MinimumWageAssessment.find(
      { tenantId: req.tenantId },
      '-lines -exclusions -exclusionPatterns',
    )
      .sort({ periodStart: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 60))
      .lean();

    return res.json({ assessments });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/minimum-wages/assessments/:id
 */
exports.getAssessment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assessment id' });
    }

    const assessment = await MinimumWageAssessment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    return res.json({ assessment });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/minimum-wages/assessments/:id/register
 *
 * The shortfall register as CSV. A read, and a sensitive one — it is every
 * employee's wage against the notified rate in one file — so it stays with the
 * read permission rather than becoming a name of its own, on the same reasoning
 * `statutoryBonus.routes.js` gives for Form C.
 */
exports.exportRegister = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid assessment id' });
    }

    const assessment = await MinimumWageAssessment.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    const header = [
      'Employee',
      'Designation',
      'State',
      'Scheduled employment',
      'Area class',
      'Skill category',
      'Notification',
      'Notified monthly rate',
      'Days worked',
      'Entitlement',
      'Gross paid',
      'Comparable wage',
      'Wage shortfall',
      'Overtime hours',
      'Overtime entitlement',
      'Overtime paid',
      'Total shortfall',
    ];

    // Quoted and doubled: a designation containing a comma would otherwise
    // shift every column after it, which is the class of bug that makes a
    // register look fine in a spreadsheet and be wrong.
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const rows = assessment.lines.map((line) =>
      [
        line.name,
        line.designation,
        line.state,
        line.scheduledEmployment,
        line.areaClass,
        line.skillCategory,
        line.notificationRef,
        line.notifiedMonthlyRate,
        line.daysWorked,
        line.entitlement,
        line.grossPaid,
        line.comparableWage,
        line.shortfall,
        line.overtime ? line.overtime.hours : 0,
        line.overtime ? line.overtime.entitlement : 0,
        line.overtime ? line.overtime.paid : 0,
        line.totalShortfall,
      ]
        .map(escape)
        .join(','),
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'MINIMUM_WAGE_REGISTER_EXPORTED',
      resourceType: 'MinimumWageAssessment',
      resourceIds: [assessment._id],
      details: { periodStart: assessment.periodStart },
      req,
    });

    const period = new Date(assessment.periodStart).toISOString().slice(0, 7);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="minimum-wage-register-${period}.csv"`,
    );

    return res.send([header.map(escape).join(','), ...rows].join('\n'));
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/minimum-wages/notifications/:id/arrears
 *
 * What a retrospective revision costs for the periods already closed.
 *
 * Writes nothing, because the arrear is a payroll instruction rather than a
 * compliance record — it belongs in the next run's arrear component, and this
 * endpoint's job is to say how much and to whom.
 */
exports.previewArrears = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }

    const notification = await MinimumWageNotification.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const periods = await MinimumWageAssessment.find({
      tenantId: req.tenantId,
      periodEnd: { $gte: notification.effectiveFrom },
    })
      .sort({ periodStart: 1 })
      .lean();

    const arrears = retrospectiveArrears({
      periods,
      notification,
      cpiPoints:
        Number(req.body && req.body.cpiPoints) ||
        (periods.length ? periods[periods.length - 1].cpiPoints : 0),
    });

    return res.json({ arrears });
  } catch (error) {
    return next(error);
  }
};
