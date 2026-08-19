/**
 * @fileoverview ECR (Electronic Challan cum Return) Generator
 * @description Formats payroll data into the strict pipe-delimited (`|`) text format 
 * required by the Indian EPFO portal. Includes validation logic for UANs and wage ceilings.
 * Issue: #1169
 */
const logger = require('./logger');

// EPFO Wage Ceiling for mandatory PF deduction
const PF_WAGE_CEILING = 15000;
// Standard EPFO contribution rates (simplified for this engine)
const EMPLOYER_EPF_RATE = 0.0367; // 3.67% to EPF
const EMPLOYER_EPS_RATE = 0.0833; // 8.33% to EPS
const EMPLOYEE_PF_RATE = 0.12;    // 12% Employee share
const EDLI_RATE = 0.005;          // 0.5% EDLI
const ADMIN_RATE = 0.005;         // 0.5% Admin charges

/**
 * Validates an employee record for EPFO ECR compliance.
 * @param {Object} employee 
 * @param {Object} payroll 
 * @returns {Array<{errorType: string, message: string}>}
 */
function validateEmployeeForECR(employee, payroll) {
    const errors = [];

    if (!employee.uan || employee.uan.length !== 12) {
        errors.push({ errorType: 'Missing UAN', message: 'Valid 12-digit UAN is required for ECR generation.' });
    }

    if (!employee.pfNumber) {
        errors.push({ errorType: 'Missing PF Number', message: 'Member PF ID is missing.' });
    }

    // Check for wage ceiling logic anomalies (e.g., EPF wages > Gross wages)
    const pfWages = Math.min(payroll.basicSalary || 0, PF_WAGE_CEILING);
    if (pfWages > (payroll.grossSalary || 0)) {
        errors.push({ errorType: 'Wage Ceiling Breach', message: 'Calculated PF wages exceed gross salary.' });
    }

    return errors;
}

/**
 * Generates the pipe-delimited ECR text content for the EPFO portal.
 * Format: UAN|Name|Gross|EPF_Wages|EPF|EPS|EDLI|Admin|...
 * 
 * @param {Array} payrollData - Array of joined Employee + PayrollUpdate objects
 * @param {number} month 
 * @param {number} year 
 * @returns {{ ecrText: string, summary: Object, errors: Array }}
 */
function generateEPFOEcrText(payrollData, month, year) {
    const lines = [];
    const errors = [];
    let totalGross = 0, totalEPF = 0, totalEPS = 0, totalEDLI = 0, totalAdmin = 0;
    let validCount = 0;

    // Header line (Mocked format for demonstration)
    lines.push(`#EPFO_ECR_HEADER|${month}|${year}|${payrollData.length}`);

    for (const record of payrollData) {
        const { employee, payroll } = record;
        const validationErrors = validateEmployeeForECR(employee, payroll);

        if (validationErrors.length > 0) {
            errors.push({
                employeeId: employee._id,
                employeeName: employee.fullName,
                ...validationErrors[0]
            });
            continue; // Skip invalid employees from the ECR file
        }

        const gross = payroll.grossSalary || 0;
        const pfWages = Math.min(payroll.basicSalary || 0, PF_WAGE_CEILING);

        const epf = Math.round(pfWages * EMPLOYER_EPF_RATE);
        const eps = Math.round(pfWages * EMPLOYER_EPS_RATE);
        const edli = Math.round(pfWages * EDLI_RATE);
        const admin = Math.round(pfWages * ADMIN_RATE);
        const empPF = Math.round(pfWages * EMPLOYEE_PF_RATE);

        totalGross += gross;
        totalEPF += epf;
        totalEPS += eps;
        totalEDLI += edli;
        totalAdmin += admin;
        validCount++;

        // Standard EPFO pipe-delimited member row
        // UAN|Name|Gross|EPF_Wages|EPF|EPS|EDLI|Admin|Emp_PF|...
        const row = [
            employee.uan,
            employee.fullName.replace(/\|/g, ' '), // Escape pipes in names
            gross.toFixed(2),
            pfWages.toFixed(2),
            epf.toFixed(2),
            eps.toFixed(2),
            edli.toFixed(2),
            admin.toFixed(2),
            empPF.toFixed(2),
            '0.00', // Exempted PF (if any)
            'N'     // Is International Worker
        ].join('|');

        lines.push(row);
    }

    const summary = {
        totalEmployees: validCount,
        totalGrossWages: totalGross,
        totalEmployerContribution: totalEPF + totalEPS + totalEDLI + totalAdmin,
        totalEmployeeContribution: Math.round(totalEPF * (EMPLOYEE_PF_RATE / EMPLOYER_EPF_RATE)), // Rough calc for summary
        totalChallanAmount: totalEPF + totalEPS + totalEDLI + totalAdmin + Math.round(totalEPF * (EMPLOYEE_PF_RATE / EMPLOYER_EPF_RATE))
    };

    return { ecrText: lines.join('\n'), summary, errors };
}

module.exports = { generateEPFOEcrText, validateEmployeeForECR };
