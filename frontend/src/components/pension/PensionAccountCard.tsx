import React from 'react';

export interface PensionAccount {
  pensionAccountId: string;
  retireeEmployeeId: string;
  retireeFullName: string;
  pensionPlanType: string;
  accumulatedCorpusAmount: number;
  monthlyAnnuityPayout: number;
  vestingStatus: string;
  taxWithholdingRatePercentage: number;
  accountStatus: string;
  disbursements?: any[];
}

interface PensionAccountCardProps {
  account: PensionAccount;
  onExecuteDisbursement: (accountId: string) => void;
}

/**
 * Glassmorphic Card Component displaying retiree pension account details, annuity payouts, and tax withholdings.
 */
export const PensionAccountCard: React.FC<PensionAccountCardProps> = ({ account, onExecuteDisbursement }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE_DISBURSEMENT':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'SUSPENDED_AUDIT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse';
      case 'SURVIVOR_BENEFIT_ACTIVE':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl hover:border-emerald-500/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          {account.pensionPlanType.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(account.accountStatus)}`}>
          {account.accountStatus.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 text-2xl font-black">
          🏦
        </div>
        <div>
          <h4 className="text-white font-extrabold text-lg">{account.retireeFullName}</h4>
          <p className="text-slate-400 text-xs">
            ID: {account.pensionAccountId} | Employee Ref: {account.retireeEmployeeId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Monthly Annuity</span>
          <span className="text-emerald-400 font-bold text-lg">${account.monthlyAnnuityPayout.toLocaleString()}</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Total Corpus</span>
          <span className="text-cyan-400 font-bold text-lg">${(account.accumulatedCorpusAmount / 1000).toFixed(1)}k</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Tax Withholding</span>
          <span className="text-amber-400 font-bold text-lg">{account.taxWithholdingRatePercentage}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-slate-400 text-xs">
          Vesting: <strong className="text-white">{account.vestingStatus}</strong>
        </span>
        <button
          onClick={() => onExecuteDisbursement(account.pensionAccountId)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
        >
          Execute Disbursement 💸
        </button>
      </div>
    </div>
  );
};
