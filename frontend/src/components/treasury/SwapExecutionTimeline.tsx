import React from 'react';
import { CheckCircle2, ShieldCheck, Activity, ArrowRightLeft } from 'lucide-react';

interface SwapExecutionItem {
  id: string;
  pair: string;
  amountUSD: number;
  rate: number;
  liquidityDesk: string;
  settlementAgo: string;
}

const RECENT_SWAP_EXECUTIONS: SwapExecutionItem[] = [
  {
    id: 'exec-1',
    pair: 'USD / EUR',
    amountUSD: 2500000,
    rate: 0.9215,
    liquidityDesk: 'JPMorgan Forex Desk',
    settlementAgo: '45 mins ago',
  },
  {
    id: 'exec-2',
    pair: 'USD / GBP',
    amountUSD: 1800000,
    rate: 0.7680,
    liquidityDesk: 'Barclays Institutional',
    settlementAgo: '3 hours ago',
  },
  {
    id: 'exec-3',
    pair: 'USD / JPY',
    amountUSD: 3100000,
    rate: 149.35,
    liquidityDesk: 'MUFG Financial',
    settlementAgo: '6 hours ago',
  },
];

export default function SwapExecutionTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" /> Automated FX Swap Execution Telemetry
          </h3>
          <p className="text-slate-400 text-xs mt-1">Real-time SWIFT / CLS multi-currency settlement stream and prime broker execution logs.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-blue-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> CLS Bank Settlement Guaranteed
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_SWAP_EXECUTIONS.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-blue-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-500/10 text-blue-400 text-[11px] font-mono px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                  {item.pair}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.settlementAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">${item.amountUSD.toLocaleString()} USD Hedged</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Desk: <span className="text-slate-200">{item.liquidityDesk}</span> • Spot Rate: <span className="text-cyan-300 font-bold">{item.rate}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-xs bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                0.07 bps Slippage
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Settled
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
