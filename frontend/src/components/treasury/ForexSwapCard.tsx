import React from 'react';
import { ArrowRightLeft, ShieldCheck, ArrowRight, Globe, Landmark } from 'lucide-react';

export interface ForexSwapContract {
  id: string;
  pairName: string;
  baseCurrency: string;
  quoteCurrency: string;
  spotRate: number;
  forwardPoints: number;
  notionalAmountBaseUSD: number;
  settlementDate: string;
  liquidityProvider: string;
  slippageTolerancePercent: number;
  status: 'EXECUTED' | 'ORDER_OPEN' | 'CANCELLED';
}

interface ForexSwapCardProps {
  swap: ForexSwapContract;
  onInspect: () => void;
}

export default function ForexSwapCard({ swap, onInspect }: ForexSwapCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-blue-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Pair & Status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-300 transition">
              {swap.pairName}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{swap.liquidityProvider}</p>
          </div>

          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {swap.status}
          </span>
        </div>

        {/* Notional Amount Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Notional Hedged Base Volume</div>
          <div className="text-2xl font-black text-white">
            ${swap.notionalAmountBaseUSD.toLocaleString()} USD
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            Spot Rate: {swap.spotRate} (Points: {swap.forwardPoints > 0 ? `+${swap.forwardPoints}` : swap.forwardPoints})
          </div>
        </div>

        {/* Metadata Specs */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Settlement Value Date:</span>
            <span className="text-white font-bold">{swap.settlementDate}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Max Slippage Limit:</span>
            <span className="text-cyan-400 font-bold">{swap.slippageTolerancePercent}%</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">ISDA Master Agreement</span>
        <button
          onClick={onInspect}
          className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-blue-500/30 transition flex items-center gap-1"
        >
          <span>Swap Specs</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
