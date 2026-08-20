/**
 * @fileoverview Pay equity analytics (#1347).
 *
 * Two things this controller does that are worth reading before the handlers:
 *
 *   1. It projects the employee query down to the fields the analysis needs.
 *      That is a performance choice for every other report in the product and a
 *      *disclosure* choice here — the query returns declared gender, and the
 *      fewer places that data travels through, the better.
 *
 *   2. It never returns a per-employee demographic row. The cohort tables carry
 *      counts and medians, and the compa-ratio outlier list carries pay with no
 *      protected characteristic attached. An endpoint that returned "everyone's
 *      gender and salary" would be a far more dangerous thing than the report
 *      it was built to support, and would be reachable by anyone holding the
 *      read permission.
 */

const mongoose = require('mongoose');

const { PayEquityReport, PayBand } = require('../models/payEquityReport.model');
const Employee = require('../models/employee.model');
const {
  DEFAULTS,
  buildPayEquityReport,
  normaliseOptions,
} = require('../utils/payEquity');
const eventBus = require('../services/event.service');

/**
 * @param {string|undefined} raw
 * @returns {Date}
 */
function resolveAsOf(raw) {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * The salary bands, keyed by the job level they apply to.
 *
 * Compa-ratio is meaningless without them, and a tenant that has not set any
 * should get the demographic analysis and an empty compa section rather than an
 * error — which is why a missing band produces `null` in the engine instead of
 * an exception.
 *
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
async function loadBands(tenantId) {
  const rows = await PayBand.find({ tenantId })
    .select('jobLevel minSalary maxSalary midpoint')
    .lean();

  const bands = {};

  for (const row of rows) {
    const min = Number(row.minSalary);
    const max = Number(row.maxSalary);

    if (!row.jobLevel || !Number.isFinite(min) || !Number.isFinite(max))
      continue;

    bands[row.jobLevel] = {
      min,
      max,
      midpoint: Number.isFinite(Number(row.midpoint))
        ? Number(row.midpoint)
        : (min + max) / 2,
    };
  }

  return bands;
}

/**
 * The workforce, projected to what the analysis reads and nothing else.
 *
 * @param {string} tenantId
 * @returns {Promise<Array<object>>}
 */
async function loadWorkforce(tenantId) {
  const rows = await Employee.find(
    { tenantId, isActive: true },
    'fullName department jobLevel gender monthlySalary contractedMonthlyHours joiningDate',
  ).lean();

  return rows.map((row) => ({
    employeeId: row._id,
    name: row.fullName,
    department: row.department,
    jobLevel: row.jobLevel,
    gender: row.gender,
    monthlySalary: row.monthlySalary,
    contractedMonthlyHours: row.contractedMonthlyHours,
    joiningDate: row.joiningDate,
  }));
}

/**
 * Run the report.
 *
 * @param {import('express').Request} req
 * @param {object} source query or body
 * @returns {Promise<object>}
 */
async function run(req, source) {
  const asOf = resolveAsOf(source.asOf);

  const [workforce, bands] = await Promise.all([
    loadWorkforce(req.tenantId),
    loadBands(req.tenantId),
  ]);

  const options = normaliseOptions({
    asOf,
    bands,
    minimumCohortSize:
      source.minimumCohortSize === undefined
        ? DEFAULTS.minimumCohortSize
        : Number(source.minimumCohortSize),
    materialGapThreshold:
      source.materialGapThreshold === undefined
        ? DEFAULTS.materialGapThreshold
        : Number(source.materialGapThreshold),
    referenceGroup: source.referenceGroup || DEFAULTS.referenceGroup,
  });

  return buildPayEquityReport(workforce, options);
}

/**
 * Shape the engine's output for storage.
 *
 * The engine returns `headline` as an object keyed by group, which is the
 * convenient shape for a caller and a bad one for Mongoose — a schema cannot
 * validate arbitrary keys, and a tenant's group names are its own. Stored as an
 * array with the group as a field.
 *
 * @param {object} report
 * @returns {Array<object>}
 */
function headlineAsArray(report) {
  return Object.entries(report.headline).map(([group, gap]) => ({
    group,
    ...gap,
  }));
}

/**
 * GET /api/pay-equity/preview
 *
 * Writes nothing. The suppression floor and the reference group are both worth
 * varying before a report is committed, and a committed report is a published
 * figure.
 */
exports.previewReport = async (req, res, next) => {
  try {
    let report;

    try {
      report = await run(req, req.query);
    } catch (error) {
      if (error instanceof RangeError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    return res.json({ preview: true, report });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/pay-equity/reports
 *
 * Commits a report as at a snapshot date. Upserted on (tenant, asOf) for the
 * same reason the gratuity valuation is: re-running a date corrects it rather
 * than producing a second answer to "what did we publish".
 */
exports.commitReport = async (req, res, next) => {
  try {
    let report;

    try {
      report = await run(req, req.body);
    } catch (error) {
      if (error instanceof RangeError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }

    const asOf = resolveAsOf(req.body.asOf);

    const saved = await PayEquityReport.findOneAndUpdate(
      { tenantId: req.tenantId, asOf },
      {
        $set: {
          tenantId: req.tenantId,
          asOf,
          periodLabel: req.body.periodLabel || '',
          options: {
            minimumCohortSize: report.options.minimumCohortSize,
            materialGapThreshold: report.options.materialGapThreshold,
            referenceGroup: report.options.referenceGroup,
            quartileCount: report.options.quartileCount,
          },
          headcount: report.headcount,
          excludedCount: report.excluded.length,
          groupCounts: report.groupCounts,
          demographics: report.demographics,
          headline: headlineAsArray(report),
          quartiles: report.quartiles,
          cohorts: report.cohorts,
          materialCohorts: report.materialCohorts,
          suppressedCohorts: report.suppressedCohorts,
          compaSummary: report.compaSummary,
          remediation: report.remediation,
          createdBy: req.userId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAY_EQUITY_REPORT_COMMITTED',
      resourceType: 'PayEquityReport',
      resourceIds: [saved._id],
      details: {
        asOf,
        headcount: saved.headcount,
        materialCohorts: saved.materialCohorts,
      },
      req,
    });

    return res.status(201).json({ message: 'Report committed', report: saved });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/pay-equity/reports
 *
 * The cohort tables are excluded — the list is a trend, and the trend is four
 * numbers a year.
 */
exports.listReports = async (req, res, next) => {
  try {
    const reports = await PayEquityReport.find({ tenantId: req.tenantId })
      .select('-cohorts -quartiles')
      .sort({ asOf: -1 })
      .limit(Math.min(Number(req.query.limit) || 20, 50))
      .lean();

    return res.json({ count: reports.length, reports });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/pay-equity/reports/:id
 */
exports.getReport = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid report id' });
    }

    const report = await PayEquityReport.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.json({ report });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/pay-equity/compa-ratio
 *
 * The half of the feature that needs no protected characteristic at all.
 *
 * Split out deliberately: "which of my people are below 0.8 of their band
 * midpoint" is the most actionable pay query most companies have, it works for
 * every tenant regardless of what demographic data they hold, and it should not
 * be behind the permission that guards sensitive personal data.
 */
exports.getCompaRatios = async (req, res, next) => {
  try {
    const [workforce, bands] = await Promise.all([
      loadWorkforce(req.tenantId),
      loadBands(req.tenantId),
    ]);

    // Demographics stripped before the engine sees them. The compa-ratio
    // analysis has no use for gender, and not passing it is a cheaper guarantee
    // than remembering not to return it.
    const anonymised = workforce.map((employee) => ({
      ...employee,
      gender: undefined,
    }));

    const report = buildPayEquityReport(anonymised, {
      asOf: resolveAsOf(req.query.asOf),
      bands,
    });

    return res.json({
      asOf: report.asOf,
      headcount: report.headcount,
      summary: report.compaSummary,
      outliers: report.compaOutliers,
      bandsConfigured: Object.keys(bands).length,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/pay-equity/bands
 */
exports.listBands = async (req, res, next) => {
  try {
    const bands = await PayBand.find({ tenantId: req.tenantId })
      .sort({ jobLevel: 1 })
      .lean();

    return res.json({ count: bands.length, bands });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/pay-equity/bands/:jobLevel
 *
 * Upsert rather than create: there is exactly one band per job level, so a
 * second PUT is an edit and answering 409 would leave no way to widen a range.
 */
exports.upsertBand = async (req, res, next) => {
  try {
    const jobLevel = String(req.params.jobLevel || '').trim();

    if (!jobLevel) {
      return res.status(400).json({ message: 'A job level is required' });
    }

    const minSalary = Number(req.body.minSalary);
    const maxSalary = Number(req.body.maxSalary);

    if (!Number.isFinite(minSalary) || !Number.isFinite(maxSalary)) {
      return res
        .status(400)
        .json({ message: 'minSalary and maxSalary are both required' });
    }

    if (maxSalary < minSalary) {
      return res.status(400).json({
        message: 'maxSalary must be greater than or equal to minSalary',
      });
    }

    const midpoint = Number(req.body.midpoint);

    const band = await PayBand.findOneAndUpdate(
      { tenantId: req.tenantId, jobLevel },
      {
        $set: {
          tenantId: req.tenantId,
          jobLevel,
          label: req.body.label || '',
          minSalary,
          maxSalary,
          midpoint: Number.isFinite(midpoint) ? midpoint : null,
          currency: req.body.currency || 'INR',
          updatedBy: req.userId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'PAY_BAND_UPDATED',
      resourceType: 'PayBand',
      resourceIds: [band._id],
      details: { jobLevel, minSalary, maxSalary },
      req,
    });

    return res.json({ message: 'Band saved', band });
  } catch (error) {
    return next(error);
  }
};
