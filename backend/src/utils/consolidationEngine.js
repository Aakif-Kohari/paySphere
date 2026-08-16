/**
 * @fileoverview Corporate Consolidation Engine
 * @description Aggregates payroll, headcount, and financial metrics across all child tenants
 * for the Parent company's consolidated dashboard.
 * Issue: #999
 */
const CorporateEntity = require('../models/corporateEntity.model');
const Employee = require('../models/employee.model');
const PayrollUpdate = require('../models/payroll.model');

/**
 * Recursively fetches all child tenant IDs for a given parent entity.
 * @param {string} parentTenantId 
 * @returns {Promise<string[]>} Array of tenant ObjectIds
 */
async function getAllChildTenants(parentTenantId) {
    const children = await CorporateEntity.find({ parentId: parentTenantId, isConsolidated: true });
    let allTenants = children.map(c => c.tenantId);

    for (const child of children) {
        const grandchildren = await getAllChildTenants(child.tenantId);
        allTenants = allTenants.concat(grandchildren);
    }

    return allTenants;
}

/**
 * Generates a consolidated headcount and payroll summary for the parent entity.
 * @param {string} parentTenantId 
 * @param {number} month 
 * @param {number} year 
 * @returns {Promise<Object>} Consolidated metrics
 */
async function generateConsolidatedReport(parentTenantId, month, year) {
    // Include parent tenant itself in the aggregation
    const allTenants = [parentTenantId, ...(await getAllChildTenants(parentTenantId))];

    const entities = await CorporateEntity.find({ tenantId: { $in: allTenants } });
    const entityMap = new Map(entities.map(e => [e.tenantId.toString(), e]));

    // Fetch active employees across all entities
    const employees = await Employee.find({
        tenantId: { $in: allTenants },
        isActive: true,
        isDeleted: { $ne: true }
    }).select('tenantId department monthlySalary');

    // Fetch approved/paid payrolls for the specific month
    const payrolls = await PayrollUpdate.find({
        tenantId: { $in: allTenants },
        month,
        year,
        status: { $in: ['approved', 'paid'] }
    }).select('tenantId netSalary');

    // Aggregate by Entity
    const entityBreakdown = allTenants.map(tId => {
        const tIdStr = tId.toString();
        const entity = entityMap.get(tIdStr);
        const entityEmployees = employees.filter(e => e.tenantId.toString() === tIdStr);
        const entityPayrolls = payrolls.filter(p => p.tenantId.toString() === tIdStr);

        const totalPayroll = entityPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

        return {
            entityId: tId,
            entityName: entity?.entityName || 'Unknown',
            entityCode: entity?.entityCode || 'UNK',
            headcount: entityEmployees.length,
            totalPayrollCost: totalPayroll
        };
    });

    const totalConsolidatedHeadcount = employees.length;
    const totalConsolidatedPayroll = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

    return {
        parentTenantId,
        month,
        year,
        totalConsolidatedHeadcount,
        totalConsolidatedPayroll,
        entityBreakdown
    };
}

module.exports = { getAllChildTenants, generateConsolidatedReport };
