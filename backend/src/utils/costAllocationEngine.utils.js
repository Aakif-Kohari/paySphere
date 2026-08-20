/**
 * @fileoverview Cost Allocation Engine
 * @description Intercepts payroll data and splits gross costs across multiple 
 * cost centers based on defined matrix allocations or timesheet hours.
 * Issue: #1292
 */
const { MatrixAllocation } = require('../models/matrixOrg.model');
const TimesheetEntry = require('../models/timesheet.model').TimesheetEntry; // Assuming exists from Issue #1000
const logger = require('./logger');

/**
 * Fetches dynamic allocation percentages based on timesheet hours for the month.
 * @param {string} employeeId 
 * @param {Date} monthStart 
 * @param {Date} monthEnd 
 * @returns {Promise<Array<{project: string, percentage: number}>>}
 */
async function getTimesheetAllocation(employeeId, monthStart, monthEnd) {
    // Mocking project aggregation from timesheets
    // In a real app, this would aggregate TimesheetEntry.durationMinutes grouped by projectId
    const entries = await TimesheetEntry.find({
        contractorId: employeeId, // Or mapped employee field
        startTime: { $gte: monthStart, $lte: monthEnd },
        status: 'Approved'
    }).populate('projectId', 'name code');

    if (!entries || entries.length === 0) return [];

    const projectHours = {};
    let totalMinutes = 0;

    entries.forEach(e => {
        const projName = e.projectId?.name || 'Unassigned';
        const projCode = e.projectId?.code || 'UNASSIGNED';
        const key = `${projCode}|${projName}`;

        if (!projectHours[key]) projectHours[key] = { code: projCode, name: projName, minutes: 0 };
        projectHours[key].minutes += e.durationMinutes;
        totalMinutes += e.durationMinutes;
    });

    if (totalMinutes === 0) return [];

    return Object.values(projectHours).map(p => ({
        costCenterCode: p.code,
        costCenterName: p.name,
        percentageWeight: (p.minutes / totalMinutes) * 100
    }));
}

/**
 * Generates split journal entries for a specific employee's payroll.
 * 
 * @param {Object} payrollEntry - The finalized PayrollUpdate document
 * @returns {Promise<Array<Object>>} Array of journal entries to be inserted
 */
async function generateSplitJournals(payrollEntry) {
    const allocation = await MatrixAllocation.findOne({
        employeeId: payrollEntry.employeeId,
        tenantId: payrollEntry.tenantId,
        isActive: true
    });

    if (!allocation) {
        // Default: 100% to employee's primary department
        return [{
            tenantId: payrollEntry.tenantId,
            payrollRunId: payrollEntry._id,
            employeeId: payrollEntry.employeeId,
            costCenterCode: payrollEntry.department || 'GENERAL',
            costCenterName: payrollEntry.department || 'General Admin',
            grossAmountAllocated: payrollEntry.grossSalary,
            percentageApplied: 100
        }];
    }

    let splits = allocation.splits;

    // Override with Timesheet data if configured
    if (allocation.useTimesheetAllocation) {
        const monthStart = new Date(payrollEntry.month, payrollEntry.year - 1, 1); // Mock date logic
        const monthEnd = new Date(payrollEntry.month, payrollEntry.year, 0);
        const dynamicSplits = await getTimesheetAllocation(payrollEntry.employeeId, monthStart, monthEnd);

        if (dynamicSplits.length > 0) {
            splits = dynamicSplits;
        } else {
            logger.warn(`[CostAlloc] No timesheet data for ${payrollEntry.employeeId}. Falling back to static splits.`);
        }
    }

    // Generate journals
    const journals = [];
    let totalAllocated = 0;

    for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        // Ensure last split takes the remainder to avoid rounding penny errors
        const amount = (i === splits.length - 1)
            ? payrollEntry.grossSalary - totalAllocated
            : Math.round((payrollEntry.grossSalary * (split.percentageWeight / 100)) * 100) / 100;

        journals.push({
            tenantId: payrollEntry.tenantId,
            payrollRunId: payrollEntry._id,
            employeeId: payrollEntry.employeeId,
            costCenterCode: split.costCenterCode,
            costCenterName: split.costCenterName,
            grossAmountAllocated: amount,
            percentageApplied: split.percentageWeight
        });

        totalAllocated += amount;
    }

    return journals;
}

module.exports = { generateSplitJournals, getTimesheetAllocation };
