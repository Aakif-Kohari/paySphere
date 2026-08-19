/**
 * @fileoverview Handover Engine Utilities
 * @description Calculates clearance scores, generates access revocation checklists,
 * and determines if the F&F settlement should be blocked.
 * Issue: #1205
 */

/**
 * Generates a default IT Access Revocation checklist based on the employee's department and role.
 * @param {string} department 
 * @param {string} role 
 * @returns {Array<{systemName: string, accessLevel: string}>}
 */
function generateAccessRevocationChecklist(department, role) {
    // Base systems everyone gets
    const checklist = [
        { systemName: 'Corporate Email (Google Workspace/O365)', accessLevel: 'Standard' },
        { systemName: 'Slack / Teams', accessLevel: 'Standard' },
        { systemName: 'HRMS Portal (PaySphere)', accessLevel: 'Employee' },
        { systemName: 'Building Access / ID Card', accessLevel: 'Physical' }
    ];

    // Department-specific systems
    if (department === 'Engineering' || department === 'IT') {
        checklist.push(
            { systemName: 'GitHub / GitLab', accessLevel: 'Developer' },
            { systemName: 'AWS / Cloud Console', accessLevel: 'Admin' },
            { systemName: 'Jira / Confluence', accessLevel: 'Admin' },
            { systemName: 'Production Database', accessLevel: 'Read/Write' }
        );
    } else if (department === 'Sales' || department === 'Marketing') {
        checklist.push(
            { systemName: 'Salesforce / CRM', accessLevel: 'Standard' },
            { systemName: 'LinkedIn Sales Navigator', accessLevel: 'Standard' },
            { systemName: 'Marketing Automation (HubSpot)', accessLevel: 'Standard' }
        );
    } else if (department === 'Finance' || department === 'HR') {
        checklist.push(
            { systemName: 'Accounting Software (Tally/QuickBooks)', accessLevel: 'Admin' },
            { systemName: 'Bank Portal (Maker/Checker)', accessLevel: 'Restricted' },
            { systemName: 'Payroll Admin Panel', accessLevel: 'Admin' }
        );
    }

    // Role-specific overrides
    if (role && role.toLowerCase().includes('manager')) {
        checklist.push({ systemName: 'Team Performance Dashboards', accessLevel: 'Manager' });
    }

    return checklist;
}

/**
 * Calculates the overall clearance score (0-100) based on completed handover tasks.
 * Weights: Knowledge Transfer (40%), Asset Recovery (40%), Access Revocation (20%).
 * 
 * @param {Object} plan - The HandoverPlan document
 * @returns {number} Clearance score
 */
function calculateClearanceScore(plan) {
    let ktScore = 0;
    let assetScore = 0;
    let accessScore = 0;

    // Knowledge Transfer (40 points max)
    const mandatoryKT = plan.knowledgeTransfers.filter(kt => kt.isMandatory);
    if (mandatoryKT.length > 0) {
        const completedKT = mandatoryKT.filter(kt => kt.isCompleted).length;
        ktScore = (completedKT / mandatoryKT.length) * 40;
    } else {
        ktScore = 40; // No mandatory KTs means full score
    }

    // Asset Recovery (40 points max)
    if (plan.assetRecoveries.length > 0) {
        const resolvedAssets = plan.assetRecoveries.filter(a => a.condition !== 'Pending Return').length;
        assetScore = (resolvedAssets / plan.assetRecoveries.length) * 40;
    } else {
        assetScore = 40;
    }

    // Access Revocation (20 points max)
    if (plan.accessRevocations.length > 0) {
        const revokedAccess = plan.accessRevocations.filter(a => a.isRevoked).length;
        accessScore = (revokedAccess / plan.accessRevocations.length) * 20;
    } else {
        accessScore = 20;
    }

    return Math.round(ktScore + assetScore + accessScore);
}

/**
 * Determines if the Full & Final (F&F) settlement should be blocked.
 * F&F is blocked if clearance score is < 100% OR if any asset is marked 'Lost' without a deduction.
 * 
 * @param {Object} plan - The HandoverPlan document
 * @param {number} score - The calculated clearance score
 * @returns {{ isBlocked: boolean, reason: string }}
 */
function checkFnFBlock(plan, score) {
    if (score < 100) {
        return { isBlocked: true, reason: 'Clearance score is below 100%. Complete all mandatory handover tasks.' };
    }

    const lostWithoutDeduction = plan.assetRecoveries.find(a =>
        a.condition === 'Lost' && (a.payrollDeduction || 0) <= 0
    );

    if (lostWithoutDeduction) {
        return {
            isBlocked: true,
            reason: `Asset '${lostWithoutDeduction.assetName}' is marked Lost but no payroll deduction has been assigned.`
        };
    }

    if (!plan.managerSignOff || !plan.itSignOff) {
        return { isBlocked: true, reason: 'Pending Manager or IT sign-off.' };
    }

    return { isBlocked: false, reason: 'Cleared for F&F processing.' };
}

module.exports = { generateAccessRevocationChecklist, calculateClearanceScore, checkFnFBlock };
