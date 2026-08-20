/**
 * @fileoverview Statutory bonus under the Payment of Bonus Act, 1965 (#1346).
 *
 * The controller's real job is assembling the workforce input, and it is less
 * trivial than it looks. The Act computes on *wages earned month by month*, not
 * on the current salary annualised — that is what makes joiners, leavers and
 * mid-year revisions come out right without a separate pro-rating rule. So the
 * months come out of the payroll rows that were actually approved, and an
 * employee with no approved payroll in the year genuinely has no qualifying
 * wages.
 *
 * Everything that decides a number is in `utils/statutoryBonus.js`.
 */

const mongoose = require('mongoose');

const { StatutoryBonus } = require('../models/statutoryBonus.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');
const { PAYROLL_STATUS } = require('../config/payrollStatus');
const {
  computeBonusRegister,
  paymentDueDate,
} = require('../utils/statutoryBonus');
const eventBus = require('../services/event.service');

/**
 * A working month is 26 days, which is the same divisor the gratuity formula
 * and every wage calculation in the product already use.
 *
 * The Act's section 8 test is on *working* days, and the payroll row records
 * leave rather than attendance, so days worked is the month less the leave
 * taken. It is an approximation where a tenant has no attendance ledger, and it
 * is the same approximation `settlement.js` makes for the same reason.
 */
const WORKING_DAYS_PER_MONTH = 26;

/**
 * The accounting year's start and end.
 *
 * Indian accounting years run 1 April to 31 March, and the year is named for
 * the calendar year it ends in — so accountingYear 2026 is 1 April 2025 to
 * 31 March 2026. A tenant on a different year-end can send explicit dates.
 *
 * @param {object} body
 * @returns {{accountingYear: number, start: Date, end: Date}}
 */
function resolveAccountingYear(body) {
  const year =
    Number(body.accountingYear) ||
    (new Date().getUTCMonth() >= 3
      ? new Date().getUTCFullYear() + 1
      : new Date().getUTCFullYear());

  const start = body.accountingYearStart
    ? new Date(body.accountingYearStart)
    : new Date(Date.UTC(year - 1, 3, 1));

  const end = body.accountingYearEnd
    ? new Date(body.accountingYearEnd)
    : new Date(Date.UTC(year, 2, 31));

  return { accountingYear: year, start, end };
}

/**
 * The workforce, with wages month by month, in the shape the engine wants.
 *
 * One aggregate over the payroll rows rather than a query per employee: this
 * runs across the whole headcount for twelve months, and the per-employee
 * version is the shape that quietly becomes a thousand round trips on a
 * five-hundred-person tenant.
 *
 * @param {string} tenantId
 * @param {Date} start
 * @param {Date} end
 * @returns {Promise<Array<object>>}
 */
async function assembleWorkforce(tenantId, start, end) {
  const employees = await Employee.find(
    { tenantId },
    'fullName role department monthlySalary',
  ).lean();

  const startKey = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const endKey = end.getUTCFullYear() * 12 + end.getUTCMonth();

  const rows = await PayrollUpdate.find(
    {
      tenantId,
      status: { $in: [PAYROLL_STATUS.APPROVED, PAYROLL_STATUS.PAID] },
    },
    'employeeId month year baseSalary leaveDays',
  ).lean();

  const byEmployee = new Map();

  for (const row of rows) {
    // `month` is 1-12 on the payroll row, so it is shifted to a 0-based index
    // before being folded into the comparable key.
    const key = Number(row.year) * 12 + (Number(row.month) - 1);
    if (key < startKey || key > endKey) continue;

    const id = String(row.employeeId);
    if (!byEmployee.has(id)) byEmployee.set(id, []);

    byEmployee.get(id).push({
      month: Number(row.month),
      wage: Number(row.baseSalary) || 0,
      daysWorked: Math.max(
        0,
        WORKING_DAYS_PER_MONTH - (Number(row.leaveDays) || 0),
      ),
    });
  }

  return employees.map((employee) => ({
    employeeId: employee._id,
    name: employee.fullName,
    designation: employee.role || employee.department || '',
    monthlyWage: employee.monthlySalary,
    months: byEmployee.get(String(employee._id)) || [],
  }));
}

/**
 * The most recent committed computation strictly before a year.
 *
 * Strictly before, for the same reason the gratuity roll-forward is: re-running
 * 2026 must draw on the ledger left by 2025 and not on the one it is about to
 * replace. Reading its own row would consume this year's set-on a second time
 * on every re-run.
 *
 * @param {string} tenantId
 * @param {number} accountingYear
 * @returns {Promise<object|null>}
 */
async function previousComputation(tenantId, accountingYear) {
  return StatutoryBonus.findOne({
    tenantId,
    accountingYear: { $lt: accountingYear },
  })
    .sort({ accountingYear: -1 })
    .lean();
}

/**
 * Run the computation for a year.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>}
 */
async function runComputation(req) {
  const { accountingYear, start, end } = resolveAccountingYear(req.body);

  const employees = await assembleWorkforce(req.tenantId, start, end);
  const previous = await previousComputation(req.tenantId, accountingYear);

  const result = computeBonusRegister({
    employees,
    accountingYear,
    accountingYearEnd: end,
    grossProfit: Number(req.body.grossProfit) || 0,
    depreciation: Number(req.body.depreciation) || 0,
    developmentRebate: Number(req.body.developmentRebate) || 0,
    directTax: Number(req.body.directTax) || 0,
    otherPriorCharges: Number(req.body.otherPriorCharges) || 0,
    employerType: req.body.employerType === 'OTHER' ? 'OTHER' : 'COMPANY',
    minimumWage: Number(req.body.minimumWage) || 0,
    ledger: previous ? previous.ledgerAfter : [],
    // Once the Act has applied it keeps applying (section 1(5)), so coverage is
    // sticky across years rather than re-derived from this year's headcount.
    previouslyCovered: Boolean(
      previous ? previous.applicable : req.body.previouslyCovered,
    ),
  });

  return { accountingYear, start, end, result, previous };
}

/**
 * POST /api/statutory-bonus/preview
 *
 * Writes nothing. The gross profit and prior charges come out of the audited
 * accounts and are argued over before they settle, so the computation is run
 * several times — and a preview that consumed carried set-on would make the
 * second run of the same year disagree with the first.
 */
exports.previewComputation = async (req, res, next) => {
  try {
    const { accountingYear, start, end, result, previous } =
      await runComputation(req);

    return res.json({
      preview: true,
      accountingYear,
      accountingYearStart: start,
      accountingYearEnd: end,
      previousAccountingYear: previous ? previous.accountingYear : null,
      result,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/statutory-bonus/computations
 *
 * Commits the year. Upserted on (tenant, accounting year) so re-running 2026
 * corrects 2026 rather than producing a second 2026 — which, with the ledger
 * derived from the latest committed year, would also be two different opening
 * balances for 2027.
 */
exports.commitComputation = async (req, res, next) => {
  try {
    const { accountingYear, start, end, result } = await runComputation(req);

    if (!result.applicable) {
      return res.status(422).json({
        message: `The Payment of Bonus Act does not apply to this establishment for ${accountingYear} — ${result.coverage.reason}`,
        coverage: result.coverage,
      });
    }

    const computation = await StatutoryBonus.findOneAndUpdate(
      { tenantId: req.tenantId, accountingYear },
      {
        $set: {
          tenantId: req.tenantId,
          accountingYear,
          accountingYearStart: start,
          accountingYearEnd: end,
          paymentDueBy: paymentDueDate(end),

          applicable: result.applicable,
          coverageReason: result.coverage.reason,
          previouslyCovered: result.coverage.covered,

          grossProfit: result.surplus.grossProfit,
          priorCharges: result.surplus.priorCharges,
          availableSurplus: result.surplus.availableSurplus,
          allocableSurplusShare: result.allocable.share,
          allocableSurplus: result.allocable.allocableSurplus,
          employerType: req.body.employerType === 'OTHER' ? 'OTHER' : 'COMPANY',
          minimumWage: Number(req.body.minimumWage) || 0,

          totalQualifyingWages: result.totalQualifyingWages,
          minimumBonus: result.allocation.minimumBonus,
          maximumBonus: result.allocation.maximumBonus,
          payableBonus: result.allocation.payableBonus,
          bonusRate: result.allocation.bonusRate,
          bonusPercent: result.allocation.bonusPercent,
          setOn: result.allocation.setOn,
          setOff: result.allocation.setOff,
          drawnFromSetOn: result.allocation.drawnFromSetOn,
          allocationBasis: result.allocation.basis,
          ledgerAfter: result.ledgerAfter,

          eligibleCount: result.eligibleCount,
          excludedCount: result.excludedCount,
          register: result.register,
          excluded: result.excluded,

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
      action: 'STATUTORY_BONUS_COMMITTED',
      resourceType: 'StatutoryBonus',
      resourceIds: [computation._id],
      details: {
        accountingYear,
        payableBonus: computation.payableBonus,
        bonusPercent: computation.bonusPercent,
        eligibleCount: computation.eligibleCount,
      },
      req,
    });

    return res
      .status(201)
      .json({
        message: `Statutory bonus committed for ${accountingYear}`,
        computation,
      });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/statutory-bonus/computations
 *
 * The registers are excluded — they are one row per employee and the history
 * page shows a handful of headline figures per year.
 */
exports.listComputations = async (req, res, next) => {
  try {
    const computations = await StatutoryBonus.find({ tenantId: req.tenantId })
      .select('-register -excluded')
      .sort({ accountingYear: -1 })
      .limit(Math.min(Number(req.query.limit) || 20, 50))
      .lean();

    return res.json({ count: computations.length, computations });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/statutory-bonus/computations/:id
 */
exports.getComputation = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid computation id' });
    }

    const computation = await StatutoryBonus.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!computation) {
      return res.status(404).json({ message: 'Computation not found' });
    }

    return res.json({ computation });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/statutory-bonus/ledger
 *
 * The live set-on / set-off position, which is the `ledgerAfter` of the most
 * recently committed year. Derived rather than stored separately — see the
 * note at the top of `statutoryBonus.model.js`.
 */
exports.getLedger = async (req, res, next) => {
  try {
    const latest = await StatutoryBonus.findOne({ tenantId: req.tenantId })
      .select('accountingYear ledgerAfter')
      .sort({ accountingYear: -1 })
      .lean();

    const entries = latest ? latest.ledgerAfter : [];

    const setOn = entries
      .filter((entry) => entry.type === 'set_on')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const setOff = entries
      .filter((entry) => entry.type === 'set_off')
      .reduce((sum, entry) => sum + entry.amount, 0);

    return res.json({
      asAtAccountingYear: latest ? latest.accountingYear : null,
      entries,
      totalSetOn: Math.round(setOn * 100) / 100,
      totalSetOff: Math.round(setOff * 100) / 100,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * The Form C column order, which is fixed by Rule 5 and is not a display
 * choice. Kept as a constant so the CSV and any future PDF cannot drift.
 */
const FORM_C_COLUMNS = [
  ['Sl. No.', (row, index) => index + 1],
  ['Name of the employee', (row) => row.name],
  ['Designation', (row) => row.designation],
  ['Days worked in the year', (row) => row.daysWorked],
  ['Monthly wage', (row) => row.monthlyWage],
  ['Total wages under section 12', (row) => row.qualifyingWages],
  ['Bonus payable', (row) => row.bonusPayable],
];

/**
 * Escape one CSV field.
 *
 * Names carry commas ("Rao, K.") and the occasional quote, and a register that
 * shifts a column when somebody's name has a comma in it is worse than no
 * register at all.
 *
 * @param {*} value
 * @returns {string}
 */
function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * GET /api/statutory-bonus/computations/:id/form-c
 *
 * Rule 5 requires the register to be maintained, and an inspection asks for it
 * in the statutory column order rather than in whatever order a JSON response
 * happens to use.
 */
exports.exportFormC = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid computation id' });
    }

    const computation = await StatutoryBonus.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!computation) {
      return res.status(404).json({ message: 'Computation not found' });
    }

    const lines = [
      FORM_C_COLUMNS.map(([header]) => csvField(header)).join(','),
    ];

    computation.register.forEach((row, index) => {
      lines.push(
        FORM_C_COLUMNS.map(([, read]) => csvField(read(row, index))).join(','),
      );
    });

    lines.push('');
    lines.push(
      [
        csvField('Total'),
        '',
        '',
        '',
        '',
        csvField(computation.totalQualifyingWages),
        csvField(computation.payableBonus),
      ].join(','),
    );

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'STATUTORY_BONUS_FORM_C_EXPORTED',
      resourceType: 'StatutoryBonus',
      resourceIds: [computation._id],
      details: { accountingYear: computation.accountingYear },
      req,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="form-c-${computation.accountingYear}.csv"`,
    );

    return res.send(lines.join('\n'));
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/statutory-bonus/computations/:id/paid
 *
 * Records that the bonus was actually paid, which is what section 19's eight
 * month window is measured against.
 */
exports.markPaid = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid computation id' });
    }

    const paidOn = req.body.paidOn ? new Date(req.body.paidOn) : new Date();

    if (Number.isNaN(paidOn.getTime())) {
      return res.status(400).json({ message: 'Invalid payment date' });
    }

    const computation = await StatutoryBonus.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        $set: {
          paidOn,
          paymentReference: req.body.paymentReference || '',
        },
      },
      { new: true },
    ).select('-register -excluded');

    if (!computation) {
      return res.status(404).json({ message: 'Computation not found' });
    }

    const late = computation.paymentDueBy && paidOn > computation.paymentDueBy;

    eventBus.emit('AUDIT_LOG', {
      userId: req.userId,
      action: 'STATUTORY_BONUS_PAID',
      resourceType: 'StatutoryBonus',
      resourceIds: [computation._id],
      details: { paidOn, late },
      req,
    });

    return res.json({
      message: late
        ? 'Recorded, and outside the section 19 eight-month window'
        : 'Payment recorded',
      late,
      computation,
    });
  } catch (error) {
    return next(error);
  }
};
