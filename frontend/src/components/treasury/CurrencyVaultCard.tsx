import React from 'react';
import { Globe, ShieldCheck, ArrowUpRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export interface CurrencyVault {
  id: string;
  currencyCode: string;
  currencyName: string;
  flagEmoji: string;
  totalBalance: number;
  hedgedPercentage: number;
  fxRateToUSD: number;
  dailyChangePercentage: number;
  status: 'ACTIVE' | 'PAUSED' | 'REBALANCING';
}

interface CurrencyVaultCardProps {
  vault: CurrencyVault;
  onInspect: () => void;
}

export default function CurrencyVaultCard({ vault, onInspect }: CurrencyVaultCardProps) {
  const usdValue = vault.totalBalance * vault.fxRateToUSD;

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-blue-500/10 flex flex-col justify-between group">
      <div>
        {/* Flag, Currency & Status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{vault.flagEmoji}</span>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-300 transition">
                {vault.currencyCode}
              </h3>
              <p className="text-xs text-slate-400 font-medium">{vault.currencyName}</p>
            </div>
          </div>

          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {vault.status}
          </span>
        </div>

        {/* Balance Display */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Local Reserve Balance</div>
          <div className="text-2xl font-black text-white">
            {vault.totalBalance.toLocaleString()} {vault.currencyCode}
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            ≈ ${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
          </div>
        </div>

        {/* FX Rate & Hedging Stack */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Spot FX Rate (vs USD):</span>
            <span className="text-slate-200 font-bold">${vault.fxRateToUSD}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Hedge Ratio Shield:</span>
            <span className="text-amber-400 font-bold">{vault.hedgedPercentage}% Covered</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>24h FX Shift:</span>
            <span className={vault.dailyChangePercentage >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {vault.dailyChangePercentage >= 0 ? `+${vault.dailyChangePercentage}%` : `${vault.dailyChangePercentage}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">SOC-2 Treasury Validated</span>
        <button
          onClick={onInspect}
          className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-blue-500/30 transition flex items-center gap-1"
        >
          <span>Vault Audit</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
