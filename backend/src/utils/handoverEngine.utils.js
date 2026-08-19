/**
 * @fileoverview Handover & Exit Clearance Engine
 * @description Calculates multi-factor clearance scores, generates IT access checklists,
 * aggregates asset recovery damage deductions, and produces digital clearance certificates.
 */

'use strict';

/**
 * Generates a default IT Access Revocation checklist based on department and role.
 *
 * @param {string} department
 * @param {string} role
 * @returns {Array<{systemName: string, accessLevel: string}>}
 */
function generateAccessRevocationChecklist(department = '', role = '') {
  const checklist = [
    { systemName: 'Corporate Email (Google Workspace/O365)', accessLevel: 'Standard' },
    { systemName: 'Slack / Teams', accessLevel: 'Standard' },
    { systemName: 'HRMS Portal (PaySphere)', accessLevel: 'Employee' },
    { systemName: 'Building Access / ID Card', accessLevel: 'Physical' },
  ];

  if (department === 'Engineering' || department === 'IT') {
    checklist.push(
      { systemName: 'GitHub / GitLab', accessLevel: 'Developer' },
      { systemName: 'AWS / Cloud Console', accessLevel: 'Admin' },
      { systemName: 'Jira / Confluence', accessLevel: 'Admin' },
      { systemName: 'Production Database', accessLevel: 'Read/Write' },
    );
  } else if (department === 'Sales' || department === 'Marketing') {
    checklist.push(
      { systemName: 'Salesforce / CRM', accessLevel: 'Standard' },
      { systemName: 'LinkedIn Sales Navigator', accessLevel: 'Standard' },
      { systemName: 'Marketing Automation (HubSpot)', accessLevel: 'Standard' },
    );
  } else if (department === 'Finance' || department === 'HR') {
    checklist.push(
      { systemName: 'Accounting Software (Tally/QuickBooks)', accessLevel: 'Admin' },
      { systemName: 'Bank Portal (Maker/Checker)', accessLevel: 'Restricted' },
      { systemName: 'Payroll Admin Panel', accessLevel: 'Admin' },
    );
  }

  if (role && role.toLowerCase().includes('manager')) {
    checklist.push({ systemName: 'Team Performance Dashboards', accessLevel: 'Manager' });
  }

  return checklist;
}

/**
 * Calculates overall clearance score (0-100) based on weighted categories:
 * - Knowledge Transfer: 40%
 * - Asset Recovery: 40%
 * - Access Revocation: 20%
 *
 * @param {object} plan - The HandoverPlan document
 * @returns {number}
 */
function calculateClearanceScore(plan = {}) {
  let ktScore = 0;
  let assetScore = 0;
  let accessScore = 0;

  const kts = Array.isArray(plan.knowledgeTransfers) ? plan.knowledgeTransfers : [];
  const mandatoryKT = kts.filter((kt) => kt.isMandatory !== false);
  if (mandatoryKT.length > 0) {
    const completedKT = mandatoryKT.filter((kt) => kt.isCompleted).length;
    ktScore = (completedKT / mandatoryKT.length) * 40;
  } else {
    ktScore = 40;
  }

  const assets = Array.isArray(plan.assetRecoveries) ? plan.assetRecoveries : [];
  if (assets.length > 0) {
    const resolvedAssets = assets.filter((a) => a.condition && a.condition !== 'Pending Return').length;
    assetScore = (resolvedAssets / assets.length) * 40;
  } else {
    assetScore = 40;
  }

  const accesses = Array.isArray(plan.accessRevocations) ? plan.accessRevocations : [];
  if (accesses.length > 0) {
    const revokedAccess = accesses.filter((a) => a.isRevoked).length;
    accessScore = (revokedAccess / accesses.length) * 20;
  } else {
    accessScore = 20;
  }

  return Math.min(100, Math.round(ktScore + assetScore + accessScore));
}

/**
 * Aggregates all asset damage / loss payroll deductions for FnF settlement.
 *
 * @param {Array<object>} assetRecoveries
 * @returns {{ totalDeductions: number, deductionsBreakdown: Array<object> }}
 */
function calculateAssetRecoveryDeductions(assetRecoveries = []) {
  let totalDeductions = 0;
  const deductionsBreakdown = [];

  for (const asset of assetRecoveries) {
    const deduction = Number(asset.payrollDeduction || 0);
    if (deduction > 0 || asset.condition === 'Lost' || asset.condition === 'Returned Damaged') {
      totalDeductions += deduction;
      deductionsBreakdown.push({
        assetName: asset.assetName,
        assetTag: asset.assetTag || '',
        condition: asset.condition,
        deductionAmount: Math.round(deduction * 100) / 100,
        recoveryNotes: asset.recoveryNotes || '',
      });
    }
  }

  return {
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    deductionsBreakdown,
  };
}

/**
 * Determines if the Full & Final (F&F) settlement should be blocked.
 *
 * @param {object} plan
 * @param {number} score
 * @returns {{ isBlocked: boolean, reason: string }}
 */
function checkFnFBlock(plan = {}, score = 0) {
  if (score < 100) {
    return { isBlocked: true, reason: 'Clearance score is below 100%. Complete all mandatory handover tasks.' };
  }

  const assets = Array.isArray(plan.assetRecoveries) ? plan.assetRecoveries : [];
  const lostWithoutDeduction = assets.find(
    (a) => a.condition === 'Lost' && (a.payrollDeduction || 0) <= 0,
  );

  if (lostWithoutDeduction) {
    return {
      isBlocked: true,
      reason: `Asset '${lostWithoutDeduction.assetName}' is marked Lost but no payroll deduction has been assigned.`,
    };
  }

  if (!plan.managerSignOff || !plan.itSignOff) {
    return { isBlocked: true, reason: 'Pending Manager or IT sign-off.' };
  }

  return { isBlocked: false, reason: 'Cleared for F&F processing.' };
}

/**
 * Builds a digital clearance certificate when handover is 100% complete and sign-offs are in place.
 *
 * @param {object} plan
 * @param {object} [employee={}]
 * @returns {object}
 */
function buildClearanceCertificate(plan = {}, employee = {}) {
  const score = calculateClearanceScore(plan);
  const blockCheck = checkFnFBlock(plan, score);

  if (blockCheck.isBlocked) {
    throw new Error(`Cannot issue clearance certificate: ${blockCheck.reason}`);
  }

  const deductionSummary = calculateAssetRecoveryDeductions(plan.assetRecoveries || []);
  const certId = `CERT-EXIT-${String(plan._id || Date.now()).slice(-8).toUpperCase()}`;

  return {
    certificateNumber: certId,
    employeeId: employee._id || plan.employeeId,
    employeeName: employee.fullName || 'Exiting Employee',
    department: employee.department || 'General',
    exitDate: plan.exitDate,
    clearanceScore: score,
    clearedAt: new Date(),
    managerSignOffDate: plan.managerSignOffDate,
    itSignOffDate: plan.itSignOffDate,
    totalAssetDeductions: deductionSummary.totalDeductions,
    status: 'CLEARED_FOR_FNF',
  };
}

module.exports = {
  generateAccessRevocationChecklist,
  calculateClearanceScore,
  calculateAssetRecoveryDeductions,
  checkFnFBlock,
  buildClearanceCertificate,
};
