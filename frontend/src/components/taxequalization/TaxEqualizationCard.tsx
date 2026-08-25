import React from 'react';

export interface TaxEqualizationProfile {
  profileId: string;
  expatriateEmployeeId: string;
  expatriateFullName: string;
  homeCountryCode: string;
  hostCountryCode: string;
  hypotheticalTaxPercentage: number;
  actualHostTaxRatePercentage: number;
  annualBaseSalaryUsd: number;
  annualExpatAllowancesUsd: number;
  equalizationDifferentialBalanceUsd: number;
  taxTreatyExemptionStatus: string;
  profileStatus: string;
  settlements?: any[];
}

interface TaxEqualizationCardProps {
  profile: TaxEqualizationProfile;
  onProcessReconciliation: (profileId: string) => void;
}

/**
 * Glassmorphic Card Component displaying expatriate tax equalization profiles, hypo vs host rates, and differential balances.
 */
export const TaxEqualizationCard: React.FC<TaxEqualizationCardProps> = ({ profile, onProcessReconciliation }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE_ASSIGNMENT':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      case 'RECONCILIATION_PENDING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse';
      case 'ASSIGNMENT_COMPLETED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl hover:border-cyan-500/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          {profile.homeCountryCode} ➔ {profile.hostCountryCode} EXPAT
        </span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(profile.profileStatus)}`}>
          {profile.profileStatus.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 text-2xl font-black">
          🌐
        </div>
        <div>
          <h4 className="text-white font-extrabold text-lg">{profile.expatriateFullName}</h4>
          <p className="text-slate-400 text-xs">
            Profile ID: {profile.profileId} | Expat ID: {profile.expatriateEmployeeId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Home Hypo Tax</span>
          <span className="text-cyan-400 font-bold text-base">{profile.hypotheticalTaxPercentage}%</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Host Tax Rate</span>
          <span className="text-amber-400 font-bold text-base">{profile.actualHostTaxRatePercentage}%</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Equalization Diff</span>
          <span className="text-emerald-400 font-bold text-base">${profile.equalizationDifferentialBalanceUsd.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-slate-400 text-xs">
          Treaty: <strong className="text-white">{profile.taxTreatyExemptionStatus}</strong>
        </span>
        <button
          onClick={() => onProcessReconciliation(profile.profileId)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-cyan-600/20"
        >
          Process Settlement 🌐
        </button>
      </div>
    </div>
  );
};
