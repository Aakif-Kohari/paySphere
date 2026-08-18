'use strict';

const { generateJournalLegs, computeTrialBalance } = require('../journalGenerator');

describe('Double-Entry Journal & Trial Balance Generator', () => {
  describe('generateJournalLegs', () => {
    it('generates balanced journal legs from payroll data', () => {
      const payrolls = [
        {
          baseSalary: 50000,
          bonus: 5000,
          overtimePay: 2000,
          tds: 5000,
          professionalTax: 200,
          loanRecoveryTotal: 1000,
          leaveDeduction: 500,
          netSalary: 44300,
        },
      ];

      const mappings = [
        { componentKey: 'basicSalary', glAccountName: 'Salaries & Wages', glAccountCode: '5001', nature: 'Debit' },
        { componentKey: 'bonus', glAccountName: 'Bonus Expense', glAccountCode: '5002', nature: 'Debit' },
        { componentKey: 'overtimePay', glAccountName: 'Overtime Expense', glAccountCode: '5003', nature: 'Debit' },
        { componentKey: 'employerPF', glAccountName: 'Employer PF Exp', glAccountCode: '5004', nature: 'Debit' },
        { componentKey: 'employeePF', glAccountName: 'PF Payable', glAccountCode: '2001', nature: 'Credit' },
        { componentKey: 'tds', glAccountName: 'TDS Payable', glAccountCode: '2002', nature: 'Credit' },
        { componentKey: 'professionalTax', glAccountName: 'PT Payable', glAccountCode: '2003', nature: 'Credit' },
        { componentKey: 'loanRecovery', glAccountName: 'Staff Loan Asset', glAccountCode: '1005', nature: 'Credit' },
        { componentKey: 'leaveDeduction', glAccountName: 'Leave Recovery', glAccountCode: '5005', nature: 'Credit' },
        { componentKey: 'netSalary', glAccountName: 'Salary Payable', glAccountCode: '2000', nature: 'Credit' },
      ];

      const result = generateJournalLegs(payrolls, mappings, 'JV-001');
      expect(result.legs.length).toBeGreaterThan(0);
      expect(result.isBalanced).toBe(true);
      expect(result.totalDebit).toBe(result.totalCredit);
    });
  });

  describe('computeTrialBalance', () => {
    it('accurately compiles trial balance across multiple journal vouchers', () => {
      const vouchers = [
        {
          legs: [
            { glAccountCode: '5001', glAccountName: 'Salaries Expense', nature: 'Debit', amount: 50000 },
            { glAccountCode: '2000', glAccountName: 'Salary Payable', nature: 'Credit', amount: 50000 },
          ],
        },
        {
          legs: [
            { glAccountCode: '2000', glAccountName: 'Salary Payable', nature: 'Debit', amount: 50000 },
            { glAccountCode: '1001', glAccountName: 'Bank Account', nature: 'Credit', amount: 50000 },
          ],
        },
      ];

      const trialBalance = computeTrialBalance(vouchers);
      expect(trialBalance.totalDebit).toBe(100000);
      expect(trialBalance.totalCredit).toBe(100000);
      expect(trialBalance.difference).toBe(0);
      expect(trialBalance.isBalanced).toBe(true);
      expect(trialBalance.accounts.length).toBe(3);

      const salaryPayable = trialBalance.accounts.find((a) => a.glAccountCode === '2000');
      expect(salaryPayable.debitTotal).toBe(50000);
      expect(salaryPayable.creditTotal).toBe(50000);
      expect(salaryPayable.netBalance).toBe(0);
    });

    it('detects unbalanced vouchers properly', () => {
      const vouchers = [
        {
          legs: [
            { glAccountCode: '5001', glAccountName: 'Salaries Expense', nature: 'Debit', amount: 50000 },
            { glAccountCode: '2000', glAccountName: 'Salary Payable', nature: 'Credit', amount: 48000 },
          ],
        },
      ];

      const trialBalance = computeTrialBalance(vouchers);
      expect(trialBalance.isBalanced).toBe(false);
      expect(trialBalance.difference).toBe(2000);
    });
  });
});
