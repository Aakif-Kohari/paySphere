import React from 'react';
import { TrendingUp, ArrowRight, ShieldCheck, BarChart3, Cpu } from 'lucide-react';

export interface PayrollForecastModel {
  id: string;
  modelTitle: string;
  departmentScope: string;
  projectedQuarterlySpendUSD: number;
  varianceFromBudgetPercent: number;
  headcountDelta: number;
  confidenceScorePercent: number;
  scenarioType: string;
  status: 'ACTIVE_SIMULATION' | 'COMMITTED' | 'ARCHIVED';
}

interface ForecastModelCardProps {
  model: PayrollForecastModel;
  onInspect: () => void;
}

export default function ForecastModelCard({ model, onInspect }: ForecastModelCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Title & Scenario Badge */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition">
              {model.modelTitle}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{model.departmentScope}</p>
          </div>

          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {model.scenarioType}
          </span>
        </div>

        {/* Forecasted Spend Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Projected Quarterly Payroll Spend</div>
          <div className="text-2xl font-black text-white">
            ${(model.projectedQuarterlySpendUSD / 1000000).toFixed(2)}M USD
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            Monte Carlo Confidence: {model.confidenceScorePercent}% Score
          </div>
        </div>

        {/* Delta Specs */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Simulated Headcount Delta:</span>
            <span className="text-white font-bold">+{model.headcountDelta} Roles</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Budget Variance Target:</span>
            <span className="text-teal-400 font-bold">+{model.varianceFromBudgetPercent}%</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">Engine: Monte Carlo AI v4</span>
        <button
          onClick={onInspect}
          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/30 transition flex items-center gap-1"
        >
          <span>Run Simulation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
