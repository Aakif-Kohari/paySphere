/**
 * @fileoverview Double-Entry Journal & Trial Balance Generator
 * @description Translates finalized payroll arrays into strict double-entry accounting legs
 * and compiles comprehensive Trial Balance reports across General Ledger (GL) accounts.
 */

'use strict';

/**
 * Aggregates payroll data into component totals and generates journal legs.
 * 
 * @param {Array} payrolls - Array of finalized PayrollUpdate documents
 * @param {Array} mappings - Array of GLAccountMapping documents for the tenant
 * @param {string} voucherNumber - The generated JV number
 * @param {Date} [voucherDate] - Date of the journal entry
 * @returns {{ legs: Array, totalDebit: number, totalCredit: number, isBalanced: boolean }}
 */
function generateJournalLegs(payrolls, mappings, voucherNumber, voucherDate) {
  const totals = {
    basicSalary: 0,
    hra: 0,
    allowances: 0,
    bonus: 0,
    overtimePay: 0,
    employerPF: 0,
    employerESI: 0,
    employeePF: 0,
    employeeESI: 0,
    tds: 0,
    professionalTax: 0,
    loanRecovery: 0,
    leaveDeduction: 0,
    netSalary: 0,
  };

  for (const p of payrolls) {
    totals.basicSalary += (p.salarySnapshot?.components?.find((c) => c.code === 'BASIC')?.amount || p.baseSalary || 0);
    totals.hra += (p.salarySnapshot?.components?.find((c) => c.code === 'HRA')?.amount || 0);
    totals.allowances += (p.salarySnapshot?.components?.find((c) => c.code === 'SPECIAL_ALLOWANCE')?.amount || 0);
    totals.bonus += (p.bonus || 0);
    totals.overtimePay += (p.overtimePay || 0);

    const basic = totals.basicSalary;
    totals.employerPF += (basic * 0.12);
    totals.employerESI += 0;

    totals.employeePF += (basic * 0.12);
    totals.employeeESI += 0;
    totals.tds += (p.tds || 0);
    totals.professionalTax += (p.professionalTax || 0);
    totals.loanRecovery += (p.loanRecoveryTotal || 0);
    totals.leaveDeduction += (p.leaveDeduction || 0);
    totals.netSalary += (p.netSalary || 0);
  }

  const legs = [];
  const mappingMap = new Map(mappings.map((m) => [m.componentKey, m]));

  const addLeg = (componentKey, amount, narration) => {
    if (amount <= 0) return;
    const mapping = mappingMap.get(componentKey);
    if (!mapping) return;

    legs.push({
      glAccountName: mapping.glAccountName,
      glAccountCode: mapping.glAccountCode,
      nature: mapping.nature,
      amount: Math.round(amount * 100) / 100,
      narration: narration || `Being payroll for ${voucherNumber}`,
    });
  };

  addLeg('basicSalary', totals.basicSalary);
  addLeg('hra', totals.hra);
  addLeg('allowances', totals.allowances);
  addLeg('bonus', totals.bonus);
  addLeg('overtimePay', totals.overtimePay);
  addLeg('employerPF', totals.employerPF);
  addLeg('employerESI', totals.employerESI);

  addLeg('employeePF', totals.employeePF);
  addLeg('employeeESI', totals.employeeESI);
  addLeg('tds', totals.tds);
  addLeg('professionalTax', totals.professionalTax);
  addLeg('loanRecovery', totals.loanRecovery);
  addLeg('leaveDeduction', totals.leaveDeduction);

  const netPayableMapping = mappingMap.get('netSalary');
  if (netPayableMapping && totals.netSalary > 0) {
    legs.push({
      glAccountName: netPayableMapping.glAccountName || 'Salary Payable',
      glAccountCode: netPayableMapping.glAccountCode || '',
      nature: 'Credit',
      amount: Math.round(totals.netSalary * 100) / 100,
      narration: `Being net salary payable for ${voucherNumber}`,
    });
  }

  const totalDebit = legs.filter((l) => l.nature === 'Debit').reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = legs.filter((l) => l.nature === 'Credit').reduce((sum, l) => sum + l.amount, 0);

  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  if (diff !== 0 && netPayableMapping) {
    const netLeg = legs.find((l) => l.glAccountName === (netPayableMapping.glAccountName || 'Salary Payable'));
    if (netLeg) {
      netLeg.amount += diff;
    }
  }

  const finalDebit = legs.filter((l) => l.nature === 'Debit').reduce((sum, l) => sum + l.amount, 0);
  const finalCredit = legs.filter((l) => l.nature === 'Credit').reduce((sum, l) => sum + l.amount, 0);

  return {
    legs,
    totalDebit: Math.round(finalDebit * 100) / 100,
    totalCredit: Math.round(finalCredit * 100) / 100,
    isBalanced: Math.abs(finalDebit - finalCredit) < 0.01,
  };
}

/**
 * Computes a standardized Trial Balance from an array of Journal Vouchers.
 *
 * @param {Array<object>} journalVouchers
 * @param {Array<object>} [glMappings=[]]
 * @returns {object}
 */
function computeTrialBalance(journalVouchers = [], glMappings = []) {
  const accountMap = new Map();

  for (const jv of journalVouchers) {
    const legs = Array.isArray(jv.legs) ? jv.legs : [];
    for (const leg of legs) {
      const key = leg.glAccountCode || leg.glAccountName || 'UNKNOWN';
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          glAccountCode: leg.glAccountCode || '',
          glAccountName: leg.glAccountName || key,
          debitTotal: 0,
          creditTotal: 0,
        });
      }

      const acc = accountMap.get(key);
      const amount = Number(leg.amount) || 0;
      if (leg.nature === 'Debit') {
        acc.debitTotal += amount;
      } else {
        acc.creditTotal += amount;
      }
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const accounts = [];

  for (const acc of accountMap.values()) {
    const d = Math.round(acc.debitTotal * 100) / 100;
    const c = Math.round(acc.creditTotal * 100) / 100;
    totalDebit += d;
    totalCredit += c;

    accounts.push({
      glAccountCode: acc.glAccountCode,
      glAccountName: acc.glAccountName,
      debitTotal: d,
      creditTotal: c,
      netBalance: Math.round((d - c) * 100) / 100,
      balanceType: d >= c ? 'Debit' : 'Credit',
    });
  }

  const finalDebit = Math.round(totalDebit * 100) / 100;
  const finalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round((finalDebit - finalCredit) * 100) / 100;

  return {
    totalVouchers: journalVouchers.length,
    totalDebit: finalDebit,
    totalCredit: finalCredit,
    difference,
    isBalanced: Math.abs(difference) < 0.01,
    accounts,
  };
}

module.exports = { generateJournalLegs, computeTrialBalance };
