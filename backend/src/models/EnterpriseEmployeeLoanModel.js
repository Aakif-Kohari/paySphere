/**
 * Mongoose domain model for Enterprise Payroll Employee Loans & Amortization Engine.
 * Tracks employer salary advances, emergency loans, low-interest mortgage assistance,
 * monthly pay-period amortization schedules, principal vs interest splits, and tax fringe benefit imputations.
 */

const mongoose = require('mongoose');

const AmortizationScheduleItemSchema = new mongoose.Schema({
  installmentPeriodNumber: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  principalPaymentUsd: { type: Number, required: true },
  interestPaymentUsd: { type: Number, required: true },
  totalInstallmentUsd: { type: Number, required: true },
  remainingPrincipalBalanceUsd: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['PAID', 'SCHEDULED_PAYROLL_DEDUCTION', 'DEFERRED', 'DEFAULTED'],
    default: 'SCHEDULED_PAYROLL_DEDUCTION',
  },
});

const EnterpriseEmployeeLoanSchema = new mongoose.Schema(
  {
    loanId: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeFullName: { type: String, required: true },
    loanCategory: {
      type: String,
      enum: ['SALARY_ADVANCE', 'EMERGENCY_MEDICAL_LOAN', 'HOUSING_MORTGAGE_SUBSIDY', 'EDUCATION_TUITION_LOAN'],
      required: true,
    },
    principalDisbursedUsd: { type: Number, required: true },
    annualInterestRatePercentage: { type: Number, default: 3.5 }, // Below AFR rate triggers imputed tax
    loanTenureMonths: { type: Number, required: true },
    monthlyDeductionUsd: { type: Number, required: true },
    outstandingPrincipalBalanceUsd: { type: Number, required: true },
    imputedFringeBenefitTaxRate: { type: Number, default: 0.0 },
    amortizationSchedule: [AmortizationScheduleItemSchema],
    loanStatus: {
      type: String,
      enum: ['DISBURSED_ACTIVE', 'FULLY_REPAID', 'LOAN_DEFAULTED', 'PAUSED_UNPAID_LEAVE'],
      default: 'DISBURSED_ACTIVE',
    },
    approvedByManagerId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EnterpriseEmployeeLoan', EnterpriseEmployeeLoanSchema);
