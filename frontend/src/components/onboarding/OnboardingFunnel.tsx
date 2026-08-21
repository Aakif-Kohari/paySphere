/* ═══════════════════════════════════════════════════════════════
   OnboardingFunnel — Horizontal funnel showing conversion
   rates and drop-off between onboarding stages.
   ═══════════════════════════════════════════════════════════════ */

import React from 'react';
import { Filter, TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react';
import type { OnboardingFunnelStage } from '../../services/onboarding/onboardingService';

interface OnboardingFunnelProps {
  stages: OnboardingFunnelStage[];
}

export default function OnboardingFunnel({ stages }: OnboardingFunnelProps) {
  const maxCount = Math.max(...stages.map((s) => s.count));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-5 pb-4 border-b border-slate-800/50">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" /> Onboarding Funnel
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">Conversion from pre-board through completion</p>
      </div>
      <div className="p-5 space-y-3">
        {stages.map((stage, idx) => {
          const widthPct = (stage.count / maxCount) * 100;
          const dropoff = idx > 0 ? stages[idx - 1].count - stage.count : 0;
          return (
            <div key={stage.stage}>
              <div className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-right">
                  <div className="text-[11px] font-semibold text-white">{stage.stage}</div>
                  <div className="text-[9px] text-slate-500">{stage.avgDaysInStage}d avg</div>
                </div>
                <div className="flex-1 h-7 bg-slate-800 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-700 ease-out flex items-center"
                    style={{
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, hsl(${230 + idx * 20}, 70%, 55%), hsl(${230 + idx * 20}, 60%, 45%))`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white pl-2">{stage.count}</span>
                  </div>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <span className={`text-[11px] font-mono font-bold ${stage.conversionRate >= 95 ? 'text-emerald-400' : stage.conversionRate >= 85 ? 'text-amber-400' : 'text-red-400'}`}>
                    {stage.conversionRate}%
                  </span>
                </div>
              </div>
              {dropoff > 0 && (
                <div className="flex items-center gap-2 ml-31 pl-[124px] py-1">
                  <TrendingDown className="w-3 h-3 text-red-400/50" />
                  <span className="text-[9px] text-red-400/70">-{dropoff} dropped ({Math.round((dropoff / stages[idx - 1].count) * 100)}%)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-500">
        <span>Overall conversion: <span className="text-emerald-400 font-bold">{stages[stages.length - 1].conversionRate}%</span></span>
        <span>Total cohort: <span className="text-white font-bold">{stages[0].count}</span> → <span className="text-emerald-400 font-bold">{stages[stages.length - 1].count}</span> completed</span>
      </div>
    </div>
  );
}
