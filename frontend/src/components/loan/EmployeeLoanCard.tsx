import React from 'react';

export interface EmployeeLoan {
  loanId: string;
  employeeId: string;
  employeeFullName: string;
  loanCategory: string;
  principalDisbursedUsd: number;
  annualInterestRatePercentage: number;
  loanTenureMonths: number;
  monthlyDeductionUsd: number;
  outstandingPrincipalBalanceUsd: number;
  loanStatus: string;
  amortizationSchedule?: any[];
}

interface EmployeeLoanCardProps {
  loan: EmployeeLoan;
  onDeductRepayment: (loanId: string) => void;
}

/**
 * Glassmorphic Card Component displaying employee loan details, interest rate, EMI, and remaining principal.
 */
export const EmployeeLoanCard: React.FC<EmployeeLoanCardProps> = ({ loan, onDeductRepayment }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DISBURSED_ACTIVE':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'FULLY_REPAID':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'LOAN_DEFAULTED':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl hover:border-emerald-500/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          {loan.loanCategory.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(loan.loanStatus)}`}>
          {loan.loanStatus.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-2xl font-black">
          💸
        </div>
        <div>
          <h4 className="text-white font-extrabold text-lg">{loan.employeeFullName}</h4>
          <p className="text-slate-400 text-xs">
            Loan ID: {loan.loanId} | Employee ID: {loan.employeeId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Outstanding Principal</span>
          <span className="text-emerald-400 font-bold text-base">${loan.outstandingPrincipalBalanceUsd.toLocaleString()}</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Monthly EMI</span>
          <span className="text-white font-bold text-base">${loan.monthlyDeductionUsd.toLocaleString()}</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Rate / Tenure</span>
          <span className="text-cyan-400 font-bold text-base">{loan.annualInterestRatePercentage}% / {loan.loanTenureMonths}m</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-slate-400 text-xs">
          Original Principal: <strong className="text-white">${loan.principalDisbursedUsd.toLocaleString()}</strong>
        </span>
        <button
          onClick={() => onDeductRepayment(loan.loanId)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
        >
          Deduct Payroll EMI 💸
        </button>
      </div>
    </div>
  );
};
