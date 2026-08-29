import React from 'react';
import { DollarSign, Users, TrendingUp, CheckCircle, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

export interface PayrollDepartmentMetric {
  id: string;
  departmentName: string;
  headcount: number;
  monthlyGrossUSD: number;
  taxWithholdingsUSD: number;
  benefitsContributionUSD: number;
  netDisbursementUSD: number;
  growthPercentage: number;
  status: 'DISBURSED' | 'PROCESSING' | 'FLAGGED';
}

interface PayrollBreakdownCardProps {
  metric: PayrollDepartmentMetric;
  onInspect: () => void;
}

export default function PayrollBreakdownCard({ metric, onInspect }: PayrollBreakdownCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between group">
      <div>
        {/* Department Name & Status Pill */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition">
            {metric.departmentName}
          </h3>

          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-semibold border font-mono ${
              metric.status === 'DISBURSED'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {metric.status}
          </span>
        </div>

        {/* Headcount & Gross */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 mb-4 font-mono text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Headcount</span>
            <span className="text-slate-200 font-bold text-sm flex items-center gap-1 mt-0.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" /> {metric.headcount} Staff
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Gross Pool</span>
            <span className="text-white font-bold text-sm mt-0.5 block">
              ${(metric.monthlyGrossUSD / 1000).toFixed(0)}k
            </span>
          </div>
        </div>

        {/* Financial Details Stack */}
        <div className="space-y-2 text-xs mb-5 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Tax Withholdings (Fed/State):</span>
            <span className="text-rose-400 font-semibold">-${(metric.taxWithholdingsUSD / 1000).toFixed(1)}k</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Health & Retirement Benefits:</span>
            <span className="text-amber-400 font-semibold">-${(metric.benefitsContributionUSD / 1000).toFixed(1)}k</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-800 text-slate-200 font-bold">
            <span>Net Batch Disbursement:</span>
            <span className="text-emerald-400">${(metric.netDisbursementUSD / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="text-[11px] text-slate-400 font-mono">
          MoM Shift: <span className={metric.growthPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{metric.growthPercentage >= 0 ? `+${metric.growthPercentage}%` : `${metric.growthPercentage}%`}</span>
        </div>

        <button
          onClick={onInspect}
          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/30 transition flex items-center gap-1"
        >
          <span>Audit Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
