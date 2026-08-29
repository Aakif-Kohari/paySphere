/* ═══════════════════════════════════════════════════════════════
   CompensationBenchmarks — Salary range visualization with
   market band indicators and budget impact analysis.
   ═══════════════════════════════════════════════════════════════ */

import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CompensationBenchmark } from '../../services/workforce/workforceService';
import { bandColor, formatCurrency, formatNumber } from '../../services/workforce/workforceService';

/* ─────────────── Salary Range Bar ────────────────── */

function SalaryRangeBar({ benchmark }: { benchmark: CompensationBenchmark }) {
  const maxVal = benchmark.p90 * 1.15;
  const minVal = benchmark.p25 * 0.85;
  const range = maxVal - minVal;

  const p25Pct = ((benchmark.p25 - minVal) / range) * 100;
  const p50Pct = ((benchmark.p50 - minVal) / range) * 100;
  const p75Pct = ((benchmark.p75 - minVal) / range) * 100;
  const p90Pct = ((benchmark.p90 - minVal) / range) * 100;
  const currentPct = ((benchmark.currentAvg - minVal) / range) * 100;

  return (
    <div className="space-y-1.5">
      {/* Range bar */}
      <div className="relative h-3 bg-slate-800 rounded-full">
        {/* p25-p90 range */}
        <div
          className="absolute h-full bg-slate-700/50 rounded-full"
          style={{ left: `${p25Pct}%`, width: `${p90Pct - p25Pct}%` }}
        />
        {/* p25-p75 interquartile */}
        <div
          className="absolute h-full bg-indigo-500/30 rounded-full"
          style={{ left: `${p25Pct}%`, width: `${p75Pct - p25Pct}%` }}
        />
        {/* p50 marker */}
        <div
          className="absolute w-0.5 h-full bg-white/60"
          style={{ left: `${p50Pct}%` }}
        />
        {/* Current avg marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-indigo-400 shadow-lg shadow-indigo-500/30"
          style={{ left: `${currentPct}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
        <span>{formatCurrency(benchmark.p25)}</span>
        <span>P50: {formatCurrency(benchmark.p50)}</span>
        <span>{formatCurrency(benchmark.p90)}</span>
      </div>
    </div>
  );
}

/* ─────────────── Main Component ────────────────── */

interface CompensationBenchmarksProps {
  data: CompensationBenchmark[];
  onExport?: () => void;
}

export default function CompensationBenchmarks({ data, onExport }: CompensationBenchmarksProps) {
  const totalHeadcount = data.reduce((a, d) => a + d.headcount, 0);
  const totalBudgetImpact = data.reduce((a, d) => a + d.budgetImpact, 0);
  const belowMarketCount = data.filter((d) => d.band === 'BELOW_MARKET').length;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Compensation Benchmarks</h3>
          </div>
          {onExport && (
            <button onClick={onExport} className="text-[10px] text-slate-400 hover:text-white transition">Export CSV</button>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px]">
          <span className="text-slate-400">{totalHeadcount} roles benchmarked</span>
          <span className={`font-semibold ${totalBudgetImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            Net budget impact: {totalBudgetImpact >= 0 ? '+' : ''}{formatCurrency(totalBudgetImpact)}
          </span>
          {belowMarketCount > 0 && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {belowMarketCount} roles below market
            </span>
          )}
        </div>
      </div>

      {/* Benchmark Rows */}
      <div className="divide-y divide-slate-800/50">
        {data.map((b) => (
          <div key={b.role} className="p-5 hover:bg-slate-800/20 transition">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white">{b.role}</span>
                  <span className="text-[10px] text-slate-500">{b.department}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${bandColor(b.band)}`}>
                    {b.band.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span>{b.headcount} employees</span>
                  <span>Avg: {formatCurrency(b.currentAvg)}</span>
                  <span className={`flex items-center gap-0.5 ${b.budgetImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {b.budgetImpact >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatCurrency(b.budgetImpact)} budget
                  </span>
                </div>
              </div>
            </div>
            <SalaryRangeBar benchmark={b} />
          </div>
        ))}
      </div>
    </div>
  );
}
