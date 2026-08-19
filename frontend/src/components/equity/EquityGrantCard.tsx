import React from 'react';
import { Award, TrendingUp, ArrowRight, ShieldCheck, PieChart } from 'lucide-react';

export interface EquityGrant {
  id: string;
  granteeName: string;
  roleTitle: string;
  grantType: 'ISO Stock Options' | 'NSO Stock Options' | 'Restricted Stock Units (RSUs)';
  sharesGranted: number;
  strikePriceUSD: number;
  currentFairMarketValueUSD: number;
  totalVestedShares: number;
  vestingStartDate: string;
  vestingSchedule: string;
  vestingProgressPercent: number;
  status: 'ACTIVE_VESTING' | 'FULLY_VESTED' | 'EXERCISED';
}

interface EquityGrantCardProps {
  grant: EquityGrant;
  onInspect: () => void;
}

export default function EquityGrantCard({ grant, onInspect }: EquityGrantCardProps) {
  const currentValuation = grant.sharesGranted * grant.currentFairMarketValueUSD;

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-amber-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Grantee & Type */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition">
              {grant.granteeName}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{grant.roleTitle}</p>
          </div>

          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {grant.grantType}
          </span>
        </div>

        {/* Valuation Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Grant Valuation (409A FMV)</div>
          <div className="text-2xl font-black text-white">
            ${currentValuation.toLocaleString()} USD
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            {grant.sharesGranted.toLocaleString()} Shares @ ${grant.currentFairMarketValueUSD.toFixed(2)} / Share
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4 font-mono">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Vesting Progress</span>
            <span className="text-amber-400 font-bold">{grant.vestingProgressPercent}% Vested</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
              style={{ width: `${grant.vestingProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">Strike Price: ${grant.strikePriceUSD.toFixed(2)}</span>
        <button
          onClick={onInspect}
          className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/30 transition flex items-center gap-1"
        >
          <span>Grant Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
