/**
 * @fileoverview Payroll Reversal & Statutory TDS Adjustment Engine
 * @description Calculates financial deltas, generates double-entry corrective JVs,
 * computes Form 24Q TDS tax adjustments, and constructs clawback recovery schedules.
 */

'use strict';

/**
 * Calculates the exact financial deltas between what was paid and what should have been paid.
 *
 * @param {object} originalPayroll - The finalized PayrollUpdate document
 * @param {object} correctedData - The correct gross/tax figures
 * @returns {{ grossOverpaid: number, taxOverpaid: number, statutoryOverpaid: number, netOverpaid: number }}
 */
function calculateReversalDeltas(originalPayroll = {}, correctedData = {}) {
  const originalGross = Number(originalPayroll.grossSalary || 0);
  const originalTax = Number(originalPayroll.tds || 0);
  const originalStatutory = Number(originalPayroll.employerPF || 0) + Number(originalPayroll.employerESI || 0);
  const originalNet = Number(originalPayroll.netSalary || 0);

  const correctedGross = Number(correctedData.grossSalary || 0);
  const correctedTax = Number(correctedData.tds || 0);
  const correctedStatutory = Number(correctedData.employerPF || 0) + Number(correctedData.employerESI || 0);
  const correctedNet = Number(correctedData.netSalary || 0);

  const grossOverpaid = Math.max(0, originalGross - correctedGross);
  const taxOverpaid = Math.max(0, originalTax - correctedTax);
  const statutoryOverpaid = Math.max(0, originalStatutory - correctedStatutory);
  const netOverpaid = Math.max(0, originalNet - correctedNet);

  return {
    grossOverpaid: Math.round(grossOverpaid * 100) / 100,
    taxOverpaid: Math.round(taxOverpaid * 100) / 100,
    statutoryOverpaid: Math.round(statutoryOverpaid * 100) / 100,
    netOverpaid: Math.round(netOverpaid * 100) / 100,
  };
}

/**
 * Generates negative double-entry journal legs to reverse original payroll accounting.
 *
 * @param {object} deltas - The calculated reversal deltas
 * @param {object} [glMappings={}] - The tenant's GL account mappings
 * @returns {Array<{accountName: string, nature: string, amount: number}>}
 */
function generateNegativeJournals(deltas = {}, glMappings = {}) {
  const legs = [];

  // Reverse Gross Salary Expense (Credit)
  if (deltas.grossOverpaid > 0) {
    legs.push({
      accountName: glMappings.salaryExpense || 'Salary Expense',
      nature: 'Credit',
      amount: deltas.grossOverpaid,
    });
  }

  // Reverse Employee TDS Deduction (Debit to reduce liability)
  if (deltas.taxOverpaid > 0) {
    legs.push({
      accountName: glMappings.tdsPayable || 'TDS Payable',
      nature: 'Debit',
      amount: deltas.taxOverpaid,
    });
  }

  // Reverse Net Salary Payable (Debit - Employee Receivable asset)
  if (deltas.netOverpaid > 0) {
    legs.push({
      accountName: glMappings.salaryPayable || 'Salary Payable / Employee Receivable',
      nature: 'Debit',
      amount: deltas.netOverpaid,
    });
  }

  return legs;
}

/**
 * Verifies that debit and credit amounts in journal entries are perfectly balanced.
 *
 * @param {Array<{nature: string, amount: number}>} journalEntries
 * @returns {{ isBalanced: boolean, totalDebits: number, totalCredits: number }}
 */
function verifyDoubleEntryBalancing(journalEntries = []) {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of journalEntries) {
    const amt = Number(entry.amount || 0);
    if (entry.nature === 'Debit') totalDebits += amt;
    else if (entry.nature === 'Credit') totalCredits += amt;
  }

  totalDebits = Math.round(totalDebits * 100) / 100;
  totalCredits = Math.round(totalCredits * 100) / 100;

  return {
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    totalDebits,
    totalCredits,
  };
}

/**
 * Computes Form 24Q quarterly statutory TDS credit note adjustments.
 *
 * @param {object} deltas
 * @param {string|number} [quarter='Q1']
 * @param {string} [financialYear='2026-2027']
 * @returns {object}
 */
function computeForm24QTdsAdjustments(deltas = {}, quarter = 'Q1', financialYear = '2026-2027') {
  const taxOverpaid = Number(deltas.taxOverpaid || 0);

  return {
    quarter: String(quarter),
    financialYear: String(financialYear),
    section: '192',
    tdsCreditAdjustment: Math.round(taxOverpaid * 100) / 100,
    requiresCorrectionReturn: taxOverpaid > 0,
    adjustmentStatus: taxOverpaid > 0 ? 'Pending Filing' : 'Not Required',
  };
}

/**
 * Constructs a monthly clawback schedule to recover the net overpaid amount.
 */
function generateClawbackSchedule(netOverpaid, recoveryMonths, startMonth, startYear) {
  const schedule = [];
  const months = Math.max(1, Number(recoveryMonths || 1));
  const monthlyDeduction = Math.round((netOverpaid / months) * 100) / 100;

  let currentMonth = Number(startMonth) || new Date().getMonth() + 1;
  let currentYear = Number(startYear) || new Date().getFullYear();
  let remaining = netOverpaid;

  for (let i = 0; i < months; i++) {
    const deduction = i === months - 1 ? Math.round(remaining * 100) / 100 : monthlyDeduction;

    schedule.push({
      month: currentMonth,
      year: currentYear,
      deductionAmount: deduction,
      status: 'Pending',
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
  verifyDoubleEntryBalancing,
  computeForm24QTdsAdjustments,
  generateClawbackSchedule,
  validateReversal,
};
