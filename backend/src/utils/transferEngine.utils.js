/**
 * @fileoverview Seamless Transfer Engine
 * @description Atomically updates an employee's department, manager, and role 
 * upon internal hiring while preserving their original tenure and core record.
 * Issue: #1167
 */
const Employee = require('../models/employee.model');
const logger = require('./logger');

/**
 * Executes a seamless internal transfer.
 * 
 * @param {string} employeeId - The ID of the employee being transferred
 * @param {Object} job - The InternalJob document they were hired for
 * @param {string} tenantId 
 * @returns {Promise<Object>} The updated Employee document
 */
async function executeSeamlessTransfer(employeeId, job, tenantId) {
    const employee = await Employee.findOne({ _id: employeeId, tenantId });
    if (!employee) throw new Error('Employee not found for transfer.');

    // Store historical snapshot before mutation (Audit Trail)
    const transferHistory = {
        previousDepartment: employee.department,
        previousRole: employee.role,
        previousManagerId: employee.managerId,
        transferredToJob: job.title,
        transferredAt: new Date()
    };

    // Initialize transfer history array if it doesn't exist on the schema
    if (!employee.transferHistory) {
        employee.transferHistory = [];
    }
    employee.transferHistory.push(transferHistory);

    // Apply new job details
    employee.department = job.department;
    employee.role = job.title;
    employee.managerId = job.managerId || employee.managerId;

    // CRITICAL: Preserve the original joiningDate for tenure tracking
    // employee.joiningDate remains untouched

    // If the job requires a probation reset, flag the employee for a new onboarding plan
    if (job.resetProbation) {
        employee.onboardingStatus = 'In Progress';
        employee.probationEndDate = new Date();
        employee.probationEndDate.setMonth(employee.probationEndDate.getMonth() + 3); // 90 days
        logger.info(`[Transfer] Probation reset triggered for ${employee.fullName}. New 90-day plan initiated.`);
    }

    await employee.save();

    logger.info(`[Transfer] Employee ${employee.fullName} seamlessly transferred to ${job.department} - ${job.title}`);
    return employee;
}

module.exports = { executeSeamlessTransfer };
