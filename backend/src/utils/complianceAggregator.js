/**
 * Financial-year aggregation for Form 16 and Form 24Q (#933, repaired in #951).
 *
 * Rolls a tenant's approved and paid payroll rows up into one summary per
 * employee for an Indian financial year — April to March — which is the shape
 * both statutory reports are built from.
 *
 * The module could not be required at all until #951: it imported
 * `../models/employeeTaxDeclaration.model`, which was never committed. Three
 * of its figures were also placeholders that would have been filed as fact —
 * see the notes on TDS and professional tax below.
 */

const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const EmployeeTaxDeclaration = require('../models/employeeTaxDeclaration.model');

/** Deduction names that are income tax withheld, however they were entered. */
const TDS_LABELS = ['tds', 'income tax', 'incometax', 'tax deducted', 'it'];

/** Deduction names that are professional tax. */
const PROFESSIONAL_TAX_LABELS = ['professional tax', 'ptax', 'pt'];

/** The standard deduction available to a salaried employee. */
const STANDARD_DEDUCTION = 50000;

/**
 * Start and end of an Indian financial year.
 *
 * FY 2026-27 runs 1 April 2026 to 31 March 2027.
 *
 * @param {number} fyStartYear
 * @returns {{start: Date, end: Date}}
 */
function getFYDates(fyStartYear) {
  return {
    start: new Date(fyStartYear, 3, 1),
    end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59),
  };
}

/**
 * Sum the custom deduction lines on a payroll row whose name matches `labels`.
 *
 * `deductions` on the payroll row is the total of everything withheld — tax,
 * professional tax, and whatever else the run deducted. #933 assigned that
 * whole column to `professionalTax` and left TDS hardcoded to zero, so every
 * Form 16 it produced would have certified that no tax was deducted, which is
 * worse than issuing no certificate at all.
 *
 * @param {object} payroll
 * @param {string[]} labels
 * @returns {number}
 */
function sumDeductionsMatching(payroll, labels) {
  const lines = Array.isArray(payroll.customDeductions)
    ? payroll.customDeductions
    : [];

  return lines.reduce((total, line) => {
    const name = String(line?.name || '')
      .trim()
      .toLowerCase();
    if (!name) return total;

    const matches = labels.some(
      (label) => name === label || name.includes(label),
    );

    return matches ? total + (Number(line.amount) || 0) : total;
  }, 0);
}

/**
 * One summary per employee who was actually paid during the year.
 *
 * @param {string} tenantId
 * @param {number} fyStartYear
 * @returns {Promise<Array>}
 */
async function aggregateFYData(tenantId, fyStartYear) {
  // Refuse rather than aggregate across every tenant in the database. The
  // caller is a report that ends up as a file somebody downloads.
  if (!tenantId) return [];

  const payrolls = await PayrollUpdate.find({
    tenantId,
    status: { $in: ['approved', 'paid'] },
    $or: [
      { year: fyStartYear, month: { $gte: 4 } }, // April–December
      { year: fyStartYear + 1, month: { $lte: 3 } }, // January–March
    ],
  }).lean();

  const employees = await Employee.find({
    tenantId,
    isDeleted: { $ne: true },
  }).lean();

  const declarations = await EmployeeTaxDeclaration.find({
    tenantId,
    financialYear: fyStartYear,
  }).lean();

  const declMap = new Map(declarations.map((d) => [String(d.employeeId), d]));

  const grouped = new Map();
  for (const p of payrolls) {
    const empId = String(p.employeeId);
    if (!grouped.has(empId)) grouped.set(empId, []);
    grouped.get(empId).push(p);
  }

  const results = [];

  for (const emp of employees) {
    const empId = String(emp._id);
    const empPayrolls = grouped.get(empId) || [];

    // Somebody with no payroll in this year was not employed here during it,
    // or was not paid. #933 emitted a row of zeroes for them, so a 24Q export
    // listed people who had no tax deducted because they had no salary — and a
    // return that names an employee it never paid is a return that has to be
    // corrected.
    if (empPayrolls.length === 0) continue;

    const decl = declMap.get(empId);

    let grossSalary = 0;
    let totalTDS = 0;
    let professionalTax = 0;

    for (const p of empPayrolls) {
      grossSalary +=
        (Number(p.baseSalary) || 0) +
        (Number(p.bonus) || 0) +
        (Number(p.overtimePay) || 0) +
        (Number(p.arrearsPayout) || 0);

      totalTDS += sumDeductionsMatching(p, TDS_LABELS);
      professionalTax += sumDeductionsMatching(p, PROFESSIONAL_TAX_LABELS);
    }

    // Perquisites are not modelled anywhere in PaySphere yet, so this is zero
    // rather than a guess. Reported explicitly so the number on the certificate
    // is one the employer can see is unfilled rather than one they assume.
    const perquisites = 0;

    const netTaxableIncome = Math.max(
      0,
      Math.round(
        grossSalary + perquisites - professionalTax - STANDARD_DEDUCTION,
      ),
    );

    results.push({
      employeeId: empId,
      employeeName: emp.fullName,
      // From the declaration, not the employee record: `Employee` has no `pan`
      // path, so #933's `emp.pan` was `undefined` for everybody and every
      // certificate carried 'N/A' where a PAN is mandatory.
      pan: decl?.pan || '',
      regime: decl?.regime || 'new',
      joiningDate: emp.joiningDate,
      department: emp.department || '',
      monthsPaid: empPayrolls.length,
      grossSalary: Math.round(grossSalary),
      perquisites,
      professionalTax: Math.round(professionalTax),
      standardDeduction: STANDARD_DEDUCTION,
      totalTDS: Math.round(totalTDS),
      netTaxableIncome,
      payrolls: empPayrolls,
    });
  }

  return results.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

module.exports = {
  aggregateFYData,
  getFYDates,
  STANDARD_DEDUCTION,
  _internals: { sumDeductionsMatching, TDS_LABELS, PROFESSIONAL_TAX_LABELS },
};
