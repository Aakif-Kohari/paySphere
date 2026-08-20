const { buildSettlement } = require('../utils/settlement');
const ExitClearance = require('../models/exitClearance.model');

/**
 * Calculates exit clearance and F&F calculations for an employee.
 * 
 * @param {object} params
 * @param {object} params.employee - The Mongoose Employee document
 * @param {object} params.policy - The merged settlement policy snapshot
 * @param {object} params.body - Request parameters containing overrides
 * @returns {Promise<object>} The computed settlement data structure
 */
async function calculateSettlement({ employee, policy, body }) {
  // 1. Fetch training clawback amount from ExitClearance if it exists
  const clearance = await ExitClearance.findOne({ employeeId: employee._id, tenantId: employee.tenantId });
  const trainingClawback = (clearance && clearance.hasTrainingAgreement) 
    ? (clearance.trainingClawbackAmount || 0)
    : 0;

  // 2. Perform base proration, leave encashment, and notice calculations using existing engine
  const baseSettlement = await buildSettlement({
    monthlySalary: employee.monthlySalary,
    joiningDate: employee.joiningDate,
    lastWorkingDay: body.lastWorkingDay,
    unusedLeaveDays: body.unusedLeaveDays,
    noticePeriodDays: body.noticePeriodDays,
    noticeServedDays: body.noticeServedDays,
    bonus: body.bonus || 0,
    otherEarnings: body.otherEarnings || 0,
    advanceRecovery: body.advanceRecovery || 0,
    assetRecovery: body.assetRecovery || 0,
    otherDeductions: body.otherDeductions || 0,
    policy,
  });

  // 3. Inject explicit trainingClawback tracking and update totals
  baseSettlement.deductions.trainingClawback = trainingClawback;
  baseSettlement.totalDeductions = Math.round((baseSettlement.totalDeductions + trainingClawback) * 100) / 100;
  baseSettlement.netSettlement = Math.round((baseSettlement.grossEarnings - baseSettlement.totalDeductions) * 100) / 100;
  
  if (trainingClawback > 0) {
    baseSettlement.explanations.trainingClawback = `Deducted training agreement clawback of ${trainingClawback}`;
  }

  return baseSettlement;
}

module.exports = {
  calculateSettlement,
};
