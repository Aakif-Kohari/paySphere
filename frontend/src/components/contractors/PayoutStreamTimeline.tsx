import React from 'react';
import { CheckCircle2, ShieldCheck, DollarSign, Activity } from 'lucide-react';

interface PayoutTransaction {
  id: string;
  contractorName: string;
  countryFlag: string;
  amountUSD: number;
  gateway: string;
  txReference: string;
  timestamp: string;
}

const RECENT_PAYOUTS: PayoutTransaction[] = [
  {
    id: 'tx-801',
    contractorName: 'Mateo Rossi',
    countryFlag: '🇮🇹',
    amountUSD: 23200,
    gateway: 'SWIFT International Wire',
    txReference: 'SWIFT-IT-2026-9901',
    timestamp: '20 mins ago',
  },
  {
    id: 'tx-802',
    contractorName: 'Aarav Sharma',
    countryFlag: '🇮🇳',
    amountUSD: 16340,
    gateway: 'Wise Business ACH',
    txReference: 'WISE-IN-8812-B',
    timestamp: '1 hour ago',
  },
  {
    id: 'tx-803',
    contractorName: 'Camila Fernandez',
    countryFlag: '🇦🇷',
    amountUSD: 12750,
    gateway: 'Solana USDC Treasury Vault',
    txReference: 'SOL-USDC-3341-XX',
    timestamp: '3 hours ago',
  },
];

export default function PayoutStreamTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-400" /> Automated Contractor Settlement Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Real-time payment gateway settlement codes and W-8BEN compliance tracking.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-teal-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-teal-400" /> Multi-Currency Gateway Active
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_PAYOUTS.map((tx) => (
          <div
            key={tx.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-teal-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-teal-500/10 text-teal-400 text-[11px] font-mono px-2 py-0.5 rounded border border-teal-500/20 font-bold flex items-center gap-1">
                  <span>{tx.countryFlag}</span> {tx.contractorName}
                </span>
                <span className="text-slate-500 text-xs font-mono">{tx.timestamp}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{tx.gateway}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Ref Code: <span className="text-slate-200">{tx.txReference}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${tx.amountUSD.toLocaleString()} USD
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
