import React from 'react';
import { CheckCircle2, ShieldCheck, Activity, Landmark } from 'lucide-react';

interface ReconciliationMatchItem {
  id: string;
  batch: string;
  bankFeedRef: string;
  clearingAmountUSD: number;
  matchScorePercent: number;
  matchedAgo: string;
}

const RECENT_MATCH_ITEMS: ReconciliationMatchItem[] = [
  {
    id: 'm-1',
    batch: 'US-East ACH Payroll',
    bankFeedRef: 'BAI2-JPMC-9021-99',
    clearingAmountUSD: 4850000,
    matchScorePercent: 100,
    matchedAgo: '30 mins ago',
  },
  {
    id: 'm-2',
    batch: 'UK & EU BACS / SEPA',
    bankFeedRef: 'MT940-BARC-8812',
    clearingAmountUSD: 3120000,
    matchScorePercent: 99.8,
    matchedAgo: '2 hours ago',
  },
  {
    id: 'm-3',
    batch: 'Wise & SWIFT Pool',
    bankFeedRef: 'SWIFT-WISE-0091',
    clearingAmountUSD: 1950000,
    matchScorePercent: 100,
    matchedAgo: '4 hours ago',
  },
];

export default function ReconciliationStreamTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> Automated Bank Feed Matching Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live BAI2 and MT940 statement line item reconciliation and general ledger posting telemetry.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-emerald-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Auto-GL Posting Active
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_MATCH_ITEMS.map((item) => (
          <div
            key={item.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  {item.batch}
                </span>
                <span className="text-slate-500 text-xs font-mono">{item.matchedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">${item.clearingAmountUSD.toLocaleString()} USD Cleared</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Bank Feed Ref: <span className="text-slate-200">{item.bankFeedRef}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-teal-400 font-mono font-extrabold text-xs bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/20">
                {item.matchScorePercent}% Match Score
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> GL Posted
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
