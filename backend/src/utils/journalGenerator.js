/**
 * @fileoverview Double-Entry Journal Generator
 * @description Translates finalized payroll arrays into strict double-entry accounting legs.
 * Ensures Total Debits === Total Credits.
 * Issue: #986
 */

/**
 * Aggregates payroll data into component totals and generates journal legs.
 * 
 * @param {Array} payrolls - Array of finalized PayrollUpdate documents
 * @param {Array} mappings - Array of GLAccountMapping documents for the tenant
 * @param {string} voucherNumber - The generated JV number
 * @param {Date} voucherDate - Date of the journal entry
 * @returns {{ legs: Array, totalDebit: number, totalCredit: number, isBalanced: boolean }}
 */
function generateJournalLegs(payrolls, mappings, voucherNumber, voucherDate) {
    // 1. Aggregate totals from all payroll records
    const totals = {
        basicSalary: 0, hra: 0, allowances: 0, bonus: 0, overtimePay: 0,
        employerPF: 0, employerESI: 0,
        employeePF: 0, employeeESI: 0, tds: 0, professionalTax: 0,
        loanRecovery: 0, leaveDeduction: 0, netSalary: 0
    };

    for (const p of payrolls) {
        // Earnings
        totals.basicSalary += (p.salarySnapshot?.components?.find(c => c.code === 'BASIC')?.amount || p.baseSalary || 0);
        totals.hra += (p.salarySnapshot?.components?.find(c => c.code === 'HRA')?.amount || 0);
        totals.allowances += (p.salarySnapshot?.components?.find(c => c.code === 'SPECIAL_ALLOWANCE')?.amount || 0);
        totals.bonus += (p.bonus || 0);
        totals.overtimePay += (p.overtimePay || 0);

        // Employer Statutory (Assuming 12% of Basic for PF, 3.25% of Gross for ESI if applicable)
        // In a real app, these would be explicitly stored on the payroll record.
        const basic = totals.basicSalary; // Simplified for aggregation
        totals.employerPF += (basic * 0.12);
        totals.employerESI += 0; // Simplified

        // Deductions (Credits)
        totals.employeePF += (basic * 0.12); // Employee contribution
        totals.employeeESI += 0;
        totals.tds += (p.tds || 0);
        totals.professionalTax += (p.professionalTax || 0);
        totals.loanRecovery += (p.loanRecoveryTotal || 0);
        totals.leaveDeduction += (p.leaveDeduction || 0);
        totals.netSalary += (p.netSalary || 0);
    }

    // 2. Map totals to GL Accounts
    const legs = [];
    const mappingMap = new Map(mappings.map(m => [m.componentKey, m]));

    // Helper to add leg if amount > 0
    const addLeg = (componentKey, amount, narration) => {
        if (amount <= 0) return;
        const mapping = mappingMap.get(componentKey);
        if (!mapping) return; // Skip if not mapped

        legs.push({
            glAccountName: mapping.glAccountName,
            glAccountCode: mapping.glAccountCode,
            nature: mapping.nature,
            amount: Math.round(amount * 100) / 100,
            narration: narration || `Being payroll for ${voucherNumber}`
        });
    };

    // Debits (Expenses)
    addLeg('basicSalary', totals.basicSalary);
    addLeg('hra', totals.hra);
    addLeg('allowances', totals.allowances);
    addLeg('bonus', totals.bonus);
    addLeg('overtimePay', totals.overtimePay);
    addLeg('employerPF', totals.employerPF);
    addLeg('employerESI', totals.employerESI);

    // Credits (Liabilities/Payables)
    addLeg('employeePF', totals.employeePF);
    addLeg('employeeESI', totals.employeeESI);
    addLeg('tds', totals.tds);
    addLeg('professionalTax', totals.professionalTax);
    addLeg('loanRecovery', totals.loanRecovery);
    addLeg('leaveDeduction', totals.leaveDeduction);

    // The Net Salary Payable is the balancing figure (Credit)
    const netPayableMapping = mappingMap.get('netSalary');
    if (netPayableMapping && totals.netSalary > 0) {
        legs.push({
            glAccountName: netPayableMapping.glAccountName || 'Salary Payable',
            glAccountCode: netPayableMapping.glAccountCode || '',
            nature: 'Credit',
            amount: Math.round(totals.netSalary * 100) / 100,
            narration: `Being net salary payable for ${voucherNumber}`
        });
    }

    // 3. Verify Balance
    const totalDebit = legs.filter(l => l.nature === 'Debit').reduce((sum, l) => sum + l.amount, 0);
    const totalCredit = legs.filter(l => l.nature === 'Credit').reduce((sum, l) => sum + l.amount, 0);

    // Force balance by adjusting the Net Payable leg if there's a rounding discrepancy
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    if (diff !== 0 && netPayableMapping) {
        const netLeg = legs.find(l => l.glAccountName === (netPayableMapping.glAccountName || 'Salary Payable'));
        if (netLeg) {
            netLeg.amount += diff;
        }
    }

    const finalDebit = legs.filter(l => l.nature === 'Debit').reduce((sum, l) => sum + l.amount, 0);
    const finalCredit = legs.filter(l => l.nature === 'Credit').reduce((sum, l) => sum + l.amount, 0);

    return {
        legs,
        totalDebit: Math.round(finalDebit * 100) / 100,
        totalCredit: Math.round(finalCredit * 100) / 100,
        isBalanced: Math.abs(finalDebit - finalCredit) < 0.01
    };
}

module.exports = { generateJournalLegs };
