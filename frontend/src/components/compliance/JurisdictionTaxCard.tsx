import React from 'react';
import { ShieldCheck, Calendar, Users, ArrowUpRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface TaxJurisdiction {
  id: string;
  countryName: string;
  regionName: string;
  flagEmoji: string;
  corporateTaxRate: number;
  payrollTaxRate: number;
  filingStatus: 'COMPLIANT' | 'PENDING_REVIEW' | 'ACTION_REQUIRED';
  nextFilingDeadline: string;
  activeEmployees: number;
  totalTaxesRemittedUSD: number;
}

interface JurisdictionTaxCardProps {
  jurisdiction: TaxJurisdiction;
  onInspect: () => void;
}

export default function JurisdictionTaxCard({ jurisdiction, onInspect }: JurisdictionTaxCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-rose-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Flag & Status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{jurisdiction.flagEmoji}</span>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-rose-300 transition">
                {jurisdiction.countryName}
              </h3>
              <p className="text-xs text-slate-400 font-medium">{jurisdiction.regionName}</p>
            </div>
          </div>

          <span
            className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold border ${
              jurisdiction.filingStatus === 'COMPLIANT'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {jurisdiction.filingStatus}
          </span>
        </div>

        {/* Remitted Display */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">YTD Tax Remitted</div>
          <div className="text-2xl font-black text-white">
            ${jurisdiction.totalTaxesRemittedUSD.toLocaleString()} USD
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <Users className="w-3.5 h-3.5 text-indigo-400" /> {jurisdiction.activeEmployees} Staff Taxpayer Profiles Active
          </div>
        </div>

        {/* Rate Stack */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Corporate Tax Rate:</span>
            <span className="text-slate-200 font-bold">{jurisdiction.corporateTaxRate}%</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Employer Payroll Tax Rate:</span>
            <span className="text-rose-400 font-bold">{jurisdiction.payrollTaxRate}%</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Statutory Filing Deadline:</span>
            <span className="text-amber-400 font-bold">{jurisdiction.nextFilingDeadline}</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">IRS / HMRC Synchronized</span>
        <button
          onClick={onInspect}
          className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-rose-500/30 transition flex items-center gap-1"
        >
          <span>Tax Details</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
