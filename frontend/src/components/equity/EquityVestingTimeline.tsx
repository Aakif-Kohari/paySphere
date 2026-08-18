import React from 'react';
import { CheckCircle2, ShieldCheck, TrendingUp, Activity, Award } from 'lucide-react';

interface VestingEvent {
  id: string;
  granteeName: string;
  sharesVested: number;
  grantType: string;
  equivalentUSD: number;
  vestingQuarter: string;
  timestampAgo: string;
}

const RECENT_VESTING_EVENTS: VestingEvent[] = [
  {
    id: 'vest-1',
    granteeName: 'Elena Rostova',
    sharesVested: 7812,
    grantType: 'ISO Stock Options',
    equivalentUSD: 144522,
    vestingQuarter: 'Q3 2026 Monthly Tranche',
    timestampAgo: '1 hour ago',
  },
  {
    id: 'vest-2',
    granteeName: 'Marcus Vance',
    sharesVested: 5312,
    grantType: 'RSU Grant',
    equivalentUSD: 98272,
    vestingQuarter: 'Q3 2026 Quarterly Tranche',
    timestampAgo: '4 hours ago',
  },
  {
    id: 'vest-3',
    granteeName: 'David Chen',
    sharesVested: 3750,
    grantType: 'NSO Options',
    equivalentUSD: 69375,
    vestingQuarter: 'Final Tranche (Fully Vested)',
    timestampAgo: '1 day ago',
  },
];

export default function EquityVestingTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" /> Automated Cap Table Vesting Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Real-time equity cliff releases, monthly option vesting events, and 409A valuation logs.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-amber-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-amber-400" /> 409A SEC Audit Verified
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_VESTING_EVENTS.map((evt) => (
          <div
            key={evt.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-500/10 text-amber-400 text-[11px] font-mono px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                  {evt.grantType}
                </span>
                <span className="text-slate-500 text-xs font-mono">{evt.timestampAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{evt.granteeName}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Tranche: <span className="text-slate-200">{evt.vestingQuarter}</span> • Vested: <span className="text-amber-300 font-bold">{evt.sharesVested.toLocaleString()} Shares</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${evt.equivalentUSD.toLocaleString()} USD
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Released
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
