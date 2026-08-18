import React from 'react';
import { RefreshCw, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';

interface ForexSettlementItem {
  id: string;
  txHash: string;
  fromCurrency: string;
  toCurrency: string;
  amountSource: number;
  amountConvertedUSD: number;
  executedRate: number;
  provider: string;
  timestamp: string;
}

const SETTLEMENT_STREAM: ForexSettlementItem[] = [
  {
    id: 'fx-1',
    txHash: '0x3a9f...1092',
    fromCurrency: 'EUR',
    toCurrency: 'USD',
    amountSource: 500000,
    amountConvertedUSD: 542500,
    executedRate: 1.085,
    provider: 'Barclays Global FX Gateway',
    timestamp: '15 mins ago',
  },
  {
    id: 'fx-2',
    txHash: '0x7e21...8841',
    fromCurrency: 'GBP',
    toCurrency: 'USD',
    amountSource: 350000,
    amountConvertedUSD: 445200,
    executedRate: 1.272,
    provider: 'HSBC Treasury Liquidity Desk',
    timestamp: '1 hour ago',
  },
  {
    id: 'fx-3',
    txHash: '0x9d00...44f2',
    fromCurrency: 'SGD',
    toCurrency: 'USD',
    amountSource: 800000,
    amountConvertedUSD: 596000,
    executedRate: 0.745,
    provider: 'DBS Institutional Clearing',
    timestamp: '3 hours ago',
  },
];

export default function ForexSettlementTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-400" /> Automated Forex Liquidity Settlements
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live Institutional Clearing Provider telemetry and rate locks.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-blue-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-blue-400" /> Institutional Rate Locked
        </div>
      </div>

      <div className="space-y-4">
        {SETTLEMENT_STREAM.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-blue-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-500/10 text-blue-400 text-[11px] font-mono px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                  {item.fromCurrency} ➔ {item.toCurrency}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.timestamp}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">
                {item.amountSource.toLocaleString()} {item.fromCurrency} Converted
              </h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Provider: <span className="text-slate-200">{item.provider}</span> • Rate: <span className="text-blue-400">@{item.executedRate}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${item.amountConvertedUSD.toLocaleString()} USD
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Cleared
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
