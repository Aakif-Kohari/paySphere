import React from 'react';
import { DollarSign, ShieldCheck, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';

export interface GlobalContractor {
  id: string;
  name: string;
  title: string;
  avatar: string;
  country: string;
  flagEmoji: string;
  taxFormStatus: string;
  hourlyRateUSD: number;
  hoursBilledMonthly: number;
  monthlyGrossUSD: number;
  paymentMethod: string;
  payoutStatus: 'PAID' | 'SCHEDULED' | 'PROCESSING';
}

interface ContractorPayoutCardProps {
  contractor: GlobalContractor;
  onInspect: () => void;
}

export default function ContractorPayoutCard({ contractor, onInspect }: ContractorPayoutCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-teal-500/10 flex flex-col justify-between group">
      <div>
        {/* Profile Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={contractor.avatar}
              alt={contractor.name}
              className="w-11 h-11 rounded-full border border-teal-500/30 object-cover"
            />
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-teal-300 transition flex items-center gap-1.5">
                {contractor.name} <span>{contractor.flagEmoji}</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">{contractor.title}</p>
            </div>
          </div>

          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold border ${
              contractor.payoutStatus === 'PAID'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {contractor.payoutStatus}
          </span>
        </div>

        {/* Invoice Summary Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Monthly Gross Invoice</div>
          <div className="text-2xl font-black text-white">
            ${contractor.monthlyGrossUSD.toLocaleString()} USD
          </div>
          <div className="text-xs text-teal-400 mt-1 font-semibold">
            {contractor.hoursBilledMonthly} Hours @ ${contractor.hourlyRateUSD}/hr
          </div>
        </div>

        {/* Payment & Tax Stack */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Disbursement Method:</span>
            <span className="text-slate-200 font-bold">{contractor.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Tax Document Audit:</span>
            <span className="text-emerald-400 font-bold">{contractor.taxFormStatus}</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">Country: {contractor.country}</span>
        <button
          onClick={onInspect}
          className="bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-teal-500/30 transition flex items-center gap-1"
        >
          <span>Invoice Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
