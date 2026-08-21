const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');

/**
 * Calculates retroactive pay adjustments by comparing historical base salaries against updated rates.
 * 
 * @param {string} employeeId - Employee ID
 * @param {string} tenantId - Tenant ID
 * @param {number} effectiveMonth - Start month of retro increase (1-12)
 * @param {number} effectiveYear - Start year of retro increase
 * @param {number} newSalaryRate - New monthly base salary rate
 * @returns {Promise<{totalDelta: number, breakdown: Array<object>}>}
 */
async function calculateRetroactivePay(employeeId, tenantId, effectiveMonth, effectiveYear, newSalaryRate) {
  // 1. Fetch employee to find current/old rate if needed
  const employee = await Employee.findOne({ _id: employeeId, tenantId });
  if (!employee) {
    throw new Error('Employee not found');
  }

  // 2. Query historical approved payroll updates that fall within the retroactive period
  // We want to fetch runs from the effective date up to (but not including) the current in-progress month.
  const historicalRuns = await PayrollUpdate.find({
    tenantId,
    employeeId,
    status: 'APPROVED',
    $or: [
      { year: { $gt: effectiveYear } },
      { year: effectiveYear, month: { $gte: effectiveMonth } }
    ]
  }).sort({ year: 1, month: 1 });

  let totalDelta = 0;
  const breakdown = [];

  for (const run of historicalRuns) {
    const oldRate = run.baseSalary || 0;
    const delta = newSalaryRate - oldRate;

    if (delta > 0) {
      totalDelta += delta;
      breakdown.push({
        month: run.month,
        year: run.year,
        paid: oldRate,
        expected: newSalaryRate,
        delta
      });
    }
  }

  return {
    totalDelta,
    breakdown
  };
}

module.exports = {
  calculateRetroactivePay
};
