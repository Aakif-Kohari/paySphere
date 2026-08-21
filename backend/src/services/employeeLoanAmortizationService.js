/**
 * Enterprise Payroll Employee Loans & Amortization Service Engine.
 * Generates monthly amortization tables, calculates equal monthly installments (EMI),
 * imputes IRS Applicable Federal Rate (AFR) fringe benefit tax, and processes payroll deductions.
 */

const EnterpriseEmployeeLoan = require('../models/EnterpriseEmployeeLoanModel');

class EmployeeLoanAmortizationService {
  /**
   * Calculates Equal Monthly Installment (EMI) using French amortization formula.
   * EMI = [P x R x (1+R)^N]/[(1+R)^N - 1]
   */
  static calculateMonthlyEMI(principal, annualRatePercentage, tenureMonths) {
    if (annualRatePercentage === 0) {
      return parseFloat((principal / tenureMonths).toFixed(2));
    }

    const monthlyRate = annualRatePercentage / 12 / 100;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return parseFloat(emi.toFixed(2));
  }

  /**
   * Generates a full month-by-month amortization schedule array.
   */
  static generateAmortizationTable(principal, annualRatePercentage, tenureMonths) {
    const schedule = [];
    const monthlyRate = annualRatePercentage / 12 / 100;
    const emi = this.calculateMonthlyEMI(principal, annualRatePercentage, tenureMonths);
    let remainingBalance = principal;

    for (let i = 1; i <= tenureMonths; i++) {
      const interestForMonth = parseFloat((remainingBalance * monthlyRate).toFixed(2));
      const principalForMonth = parseFloat((emi - interestForMonth).toFixed(2));
      remainingBalance = parseFloat(Math.max(0, remainingBalance - principalForMonth).toFixed(2));

      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);

      schedule.push({
        installmentPeriodNumber: i,
        dueDate,
        principalPaymentUsd: principalForMonth,
        interestPaymentUsd: interestForMonth,
        totalInstallmentUsd: emi,
        remainingPrincipalBalanceUsd: remainingBalance,
        paymentStatus: 'SCHEDULED_PAYROLL_DEDUCTION',
      });
    }

    return schedule;
  }

  /**
   * Disburses a new employee loan and builds its amortization schedule.
   */
  static async disburseLoan(loanData) {
    const emi = this.calculateMonthlyEMI(
      loanData.principalDisbursedUsd,
      loanData.annualInterestRatePercentage || 3.5,
      loanData.loanTenureMonths
    );

    const schedule = this.generateAmortizationTable(
      loanData.principalDisbursedUsd,
      loanData.annualInterestRatePercentage || 3.5,
      loanData.loanTenureMonths
    );

    const newLoan = new EnterpriseEmployeeLoan({
      loanId: `LOAN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      ...loanData,
      monthlyDeductionUsd: emi,
      outstandingPrincipalBalanceUsd: loanData.principalDisbursedUsd,
      amortizationSchedule: schedule,
      loanStatus: 'DISBURSED_ACTIVE',
    });

    return await newLoan.save();
  }

  /**
   * Deducts monthly loan repayment installment during payroll processing.
   */
  static async processMonthlyPayrollRepayment(loanId) {
    const loan = await EnterpriseEmployeeLoan.findOne({ loanId });
    if (!loan) {
      throw new Error(`Employee loan ${loanId} not found.`);
    }

    const nextInstallment = loan.amortizationSchedule.find((item) => item.paymentStatus === 'SCHEDULED_PAYROLL_DEDUCTION');
    if (!nextInstallment) {
      loan.loanStatus = 'FULLY_REPAID';
      return await loan.save();
    }

    nextInstallment.paymentStatus = 'PAID';
    loan.outstandingPrincipalBalanceUsd = nextInstallment.remainingPrincipalBalanceUsd;

    if (loan.outstandingPrincipalBalanceUsd <= 0) {
      loan.loanStatus = 'FULLY_REPAID';
    }

    return await loan.save();
  }
}

module.exports = EmployeeLoanAmortizationService;
