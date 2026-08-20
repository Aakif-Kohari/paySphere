import React from 'react';
import { Heart, ShieldCheck, ArrowRight, DollarSign, Users } from 'lucide-react';

export interface BenefitPlan {
  id: string;
  planName: string;
  providerName: string;
  planCategory: 'Medical & Health' | 'Dental Care' | 'Vision Care' | 'Retirement Savings' | 'Life Insurance';
  monthlyEmployerContributionUSD: number;
  monthlyEmployeeDeductionUSD: number;
  coveredEmployees: number;
  tierType: string;
  deductibleUSD: number;
  copayUSD: number;
  status: 'ACTIVE' | 'UPCOMING_RENEWAL' | 'PAUSED';
}

interface BenefitPlanCardProps {
  plan: BenefitPlan;
  onInspect: () => void;
}

export default function BenefitPlanCard({ plan, onInspect }: BenefitPlanCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-cyan-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Plan Name & Category */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition">
              {plan.planName}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{plan.providerName}</p>
          </div>

          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs px-2.5 py-1 rounded-lg font-mono font-semibold">
            {plan.planCategory}
          </span>
        </div>

        {/* Subsidy Display Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Employer Contribution / Month</div>
          <div className="text-2xl font-black text-white">
            ${plan.monthlyEmployerContributionUSD.toLocaleString()} USD
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold">
            Employee Payroll Deduction: ${plan.monthlyEmployeeDeductionUSD} / mo
          </div>
        </div>

        {/* Coverage Stack */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Enrolled Staff Members:</span>
            <span className="text-white font-bold">{plan.coveredEmployees} Employees</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Annual Plan Deductible:</span>
            <span className="text-amber-400 font-bold">${plan.deductibleUSD} USD</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">ERISA Tier: {plan.tierType}</span>
        <button
          onClick={onInspect}
          className="bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-cyan-500/30 transition flex items-center gap-1"
        >
          <span>Plan Breakdown</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
