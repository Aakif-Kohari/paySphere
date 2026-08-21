import React from 'react';

export interface EquityGrant {
  grantId: string;
  employeeId: string;
  employeeFullName: string;
  grantType: string;
  totalOptionsGranted: number;
  vestedOptionsCount: number;
  exercisedOptionsCount: number;
  strikePriceUsd: number;
  currentFmvUsd: number;
  grantStatus: string;
  exerciseHistory?: any[];
}

interface EquityGrantCardProps {
  grant: EquityGrant;
  onExerciseOptions: (grantId: string) => void;
}

/**
 * Glassmorphic Card Component displaying employee ESOP equity grant details, FMV spread, and exercise controls.
 */
export const EquityGrantCard: React.FC<EquityGrantCardProps> = ({ grant, onExerciseOptions }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE_VESTING':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'FULLY_VESTED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'EXERCISED_OUT':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const unrealizedGainPerShare = Math.max(0, grant.currentFmvUsd - grant.strikePriceUsd);
  const totalUnrealizedValue = (grant.vestedOptionsCount - grant.exercisedOptionsCount) * unrealizedGainPerShare;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl hover:border-purple-500/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-purple-500/15 border border-purple-500/40 text-purple-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          {grant.grantType.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(grant.grantStatus)}`}>
          {grant.grantStatus.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/50 flex items-center justify-center text-purple-400 text-2xl font-black">
          📈
        </div>
        <div>
          <h4 className="text-white font-extrabold text-lg">{grant.employeeFullName}</h4>
          <p className="text-slate-400 text-xs">
            Grant ID: {grant.grantId} | Emp ID: {grant.employeeId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Granted / Vested</span>
          <span className="text-white font-bold text-sm">
            {grant.totalOptionsGranted} / <span className="text-purple-400">{grant.vestedOptionsCount}</span>
          </span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Strike vs FMV</span>
          <span className="text-emerald-400 font-bold text-sm">${grant.strikePriceUsd} / ${grant.currentFmvUsd}</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Unrealized Value</span>
          <span className="text-cyan-400 font-bold text-sm">${totalUnrealizedValue.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-slate-400 text-xs">
          Exercised: <strong className="text-white">{grant.exercisedOptionsCount} shares</strong>
        </span>
        <button
          onClick={() => onExerciseOptions(grant.grantId)}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-600/20"
        >
          Exercise Options ⚡
        </button>
      </div>
    </div>
  );
};
