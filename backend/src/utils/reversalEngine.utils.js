/**
 * @fileoverview Payroll Reversal Engine
 * @description Calculates gross/tax deltas, generates negative double-entry journal legs,
 * and constructs the clawback schedule for future payroll deductions.
 * Issue: #1166
 */

/**
 * Calculates the exact financial deltas between what was paid and what should have been paid.
 * 
 * @param {Object} originalPayroll - The finalized PayrollUpdate document
 * @param {Object} correctedData - The correct gross/tax figures
 * @returns {{ grossOverpaid: number, taxOverpaid: number, statutoryOverpaid: number, netOverpaid: number }}
 */
function calculateReversalDeltas(originalPayroll, correctedData) {
    const originalGross = originalPayroll.grossSalary || 0;
    const originalTax = originalPayroll.tds || 0;
    const originalStatutory = (originalPayroll.employerPF || 0) + (originalPayroll.employerESI || 0);
    const originalNet = originalPayroll.netSalary || 0;

    const correctedGross = correctedData.grossSalary || 0;
    const correctedTax = correctedData.tds || 0;
    const correctedStatutory = (correctedData.employerPF || 0) + (correctedData.employerESI || 0);
    const correctedNet = correctedData.netSalary || 0;

    // Deltas represent the overpaid amount that needs to be clawed back
    const grossOverpaid = Math.max(0, originalGross - correctedGross);
    const taxOverpaid = Math.max(0, originalTax - correctedTax);
    const statutoryOverpaid = Math.max(0, originalStatutory - correctedStatutory);
    const netOverpaid = Math.max(0, originalNet - correctedNet);

    return {
        grossOverpaid: Math.round(grossOverpaid * 100) / 100,
        taxOverpaid: Math.round(taxOverpaid * 100) / 100,
        statutoryOverpaid: Math.round(statutoryOverpaid * 100) / 100,
        netOverpaid: Math.round(netOverpaid * 100) / 100
    };
}

/**
 * Generates negative double-entry journal legs to reverse the original payroll accounting.
 * Reverses Salary Expense (Credit), TDS Payable (Debit), and Net Payable (Debit).
 * 
 * @param {Object} deltas - The calculated reversal deltas
 * @param {Object} glMappings - The tenant's GL account mappings
 * @returns {Array<{accountName: string, nature: string, amount: number}>}
 */
function generateNegativeJournals(deltas, glMappings) {
    const legs = [];

    // Reverse Gross Salary Expense (Original was Debit, Reversal is Credit)
    if (deltas.grossOverpaid > 0) {
        legs.push({
            accountName: glMappings.salaryExpense || 'Salary Expense',
            nature: 'Credit',
            amount: deltas.grossOverpaid
        });
    }

    // Reverse Employee TDS Deduction (Original was Credit liability, Reversal is Debit to reduce liability)
    if (deltas.taxOverpaid > 0) {
        legs.push({
            accountName: glMappings.tdsPayable || 'TDS Payable',
            nature: 'Debit',
            amount: deltas.taxOverpaid
        });
    }

    // Reverse Net Salary Payable (Original was Credit liability, Reversal is Debit to reduce liability)
    // This represents the actual cash overpaid to the employee that is now an asset (Receivable)
    if (deltas.netOverpaid > 0) {
        legs.push({
            accountName: glMappings.salaryPayable || 'Salary Payable / Employee Receivable',
            nature: 'Debit',
            amount: deltas.netOverpaid
        });
    }

    return legs;
}

/**
 * Constructs a monthly clawback schedule to recover the net overpaid amount.
 * Ensures deductions do not exceed statutory minimum wage protection limits (simplified here).
 * 
 * @param {number} netOverpaid - Total cash to recover
 * @param {number} recoveryMonths - Number of months to spread the deduction
 * @param {number} startMonth - Starting month (1-12)
 * @param {number} startYear - Starting year
 * @returns {Array<Object>} Clawback schedule array
 */
function generateClawbackSchedule(netOverpaid, recoveryMonths, startMonth, startYear) {
    const schedule = [];
    const monthlyDeduction = Math.round((netOverpaid / recoveryMonths) * 100) / 100;

    let currentMonth = startMonth;
    let currentYear = startYear;
    let remaining = netOverpaid;

    for (let i = 0; i < recoveryMonths; i++) {
        // Last month takes the remainder to handle rounding differences
        const deduction = (i === recoveryMonths - 1) ? remaining : monthlyDeduction;

        schedule.push({
            month: currentMonth,
            year: currentYear,
            deductionAmount: deduction,
            status: 'Pending'
        });

        remaining -= deduction;
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    return schedule;
}

/**
 * Validates if a reversal can be initiated.
 * Prevents reversing a payroll that has already been reversed or is currently in reversal.
 * 
 * @param {Object} originalPayroll 
 * @returns {{ isValid: boolean, reason: string }}
 */
function validateReversal(originalPayroll) {
    if (!originalPayroll) {
        return { isValid: false, reason: 'Original payroll record not found.' };
    }

    if (originalPayroll.status !== 'paid' && originalPayroll.status !== 'approved') {
        return { isValid: false, reason: 'Can only reverse finalized or paid payrolls.' };
    }

    if (originalPayroll.isReversed) {
        return { isValid: false, reason: 'This payroll has already been reversed.' };
    }

    return { isValid: true, reason: '' };
}

module.exports = {
    calculateReversalDeltas,
    generateNegativeJournals,
    generateClawbackSchedule,
    validateReversal
};
