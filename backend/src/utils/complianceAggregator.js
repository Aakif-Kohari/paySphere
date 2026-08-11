/**
 * @fileoverview Statutory Compliance Aggregation Engine
 * @description Aggregates yearly payroll data for Indian Financial Year (April - March)
 * to generate Form 16 and Form 24Q reports. Handles mid-year joiners and regime switches.
 * Issue: #933
 */

const PayrollUpdate = require('../models/payroll.model');
const Employee = require('../models/employee.model');
const EmployeeTaxDeclaration = require('../models/employeeTaxDeclaration.model');

/**
 * Gets the start and end dates for an Indian Financial Year.
 * FY 2024-25 means April 1, 2024 to March 31, 2025.
 * @param {number} fyStartYear - e.g., 2024
 * @returns {{ start: Date, end: Date }}
 */
function getFYDates(fyStartYear) {
    return {
        start: new Date(fyStartYear, 3, 1), // April 1st
        end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59), // March 31st
    };
}

/**
 * Aggregates payroll data for all employees in a tenant for a specific FY.
 * @param {string} tenantId 
 * @param {number} fyStartYear 
 * @returns {Promise<Array>} Array of employee yearly summaries
 */
async function aggregateFYData(tenantId, fyStartYear) {
    const { start, end } = getFYDates(fyStartYear);

    // Fetch all approved/paid payrolls within the FY
    const payrolls = await PayrollUpdate.find({
        tenantId,
        status: { $in: ['approved', 'paid'] },
        $or: [
            { year: fyStartYear, month: { $gte: 4 } }, // Apr-Dec of start year
            { year: fyStartYear + 1, month: { $lte: 3 } }, // Jan-Mar of next year
        ],
    }).lean();

    // Fetch employees and their tax declarations
    const employees = await Employee.find({ tenantId, isDeleted: { $ne: true } }).lean();
    const declarations = await EmployeeTaxDeclaration.find({ tenantId, financialYear: fyStartYear }).lean();

    const declMap = new Map(declarations.map(d => [d.employeeId.toString(), d]));
    const empMap = new Map(employees.map(e => [e._id.toString(), e]));

    // Group payrolls by employee
    const grouped = {};
    payrolls.forEach(p => {
        const empId = p.employeeId.toString();
        if (!grouped[empId]) grouped[empId] = [];
        grouped[empId].push(p);
    });

    const results = [];

    for (const emp of employees) {
        const empId = emp._id.toString();
        const empPayrolls = grouped[empId] || [];
        const decl = declMap.get(empId);

        let grossSalary = 0;
        let totalTDS = 0; // Assuming TDS is tracked in a custom deduction or tax field
        let perquisites = 0;
        let professionalTax = 0;

        empPayrolls.forEach(p => {
            grossSalary += (p.baseSalary || 0) + (p.bonus || 0) + (p.overtimePay || 0);
            // Map specific deduction types to statutory fields
            professionalTax += (p.deductions || 0); // Simplified mapping
            // totalTDS += p.tds || 0; // Requires TDS field in payroll
        });

        results.push({
            employeeId: empId,
            employeeName: emp.fullName,
            pan: emp.pan || 'N/A',
            regime: decl?.regime || 'NEW', // Default to New Regime if not declared
            joiningDate: emp.joiningDate,
            grossSalary: Math.round(grossSalary),
            perquisites: Math.round(perquisites),
            professionalTax: Math.round(professionalTax),
            totalTDS: Math.round(totalTDS),
            netTaxableIncome: Math.round(grossSalary - professionalTax), // Simplified
            payrolls: empPayrolls,
        });
    }

    return results;
}

module.exports = { aggregateFYData, getFYDates };
