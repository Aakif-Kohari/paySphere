import React from 'react';
import { CheckCircle2, ShieldCheck, Activity, Cpu } from 'lucide-react';

interface SimulationRun {
  id: string;
  modelName: string;
  iterationsCount: number;
  projectedSpendUSD: number;
  confidencePercent: number;
  completedAgo: string;
}

const RECENT_SIMULATIONS: SimulationRun[] = [
  {
    id: 'sim-1',
    modelName: 'Q4 2026 Global Headcount Expansion',
    iterationsCount: 100000,
    projectedSpendUSD: 4250000,
    confidencePercent: 96.5,
    completedAgo: '15 mins ago',
  },
  {
    id: 'sim-2',
    modelName: '2027 Statutory Tax Escalation (UK & EU)',
    iterationsCount: 250000,
    projectedSpendUSD: 12800000,
    confidencePercent: 98.0,
    completedAgo: '1 hour ago',
  },
  {
    id: 'sim-3',
    modelName: 'Executive Merit & Equity Bonus Refresh',
    iterationsCount: 50000,
    projectedSpendUSD: 1850000,
    confidencePercent: 94.0,
    completedAgo: '3 hours ago',
  },
];

export default function PayrollAnalyticsTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> Monte Carlo Simulation Telemetry Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live execution logs of stochastic payroll budget simulations and variance distributions.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-emerald-300 font-semibold font-mono">
          <Cpu className="w-4 h-4 text-emerald-400" /> AI Accelerator Cluster Active
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_SIMULATIONS.map((sim) => (
          <div
            key={sim.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  {sim.iterationsCount.toLocaleString()} Iterations
                </span>
                <span className="text-slate-500 text-xs font-mono">{sim.completedAgo}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{sim.modelName}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Projected Run-Rate: <span className="text-emerald-300 font-bold">${(sim.projectedSpendUSD / 1000000).toFixed(2)}M USD</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-cyan-400 font-mono font-extrabold text-sm bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/20">
                {sim.confidencePercent}% Confidence
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Convergence Achieved
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
