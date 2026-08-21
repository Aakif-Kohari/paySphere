import React from 'react';
import { TaxEqualizationProfile } from './TaxEqualizationCard';

interface TaxEqualizationTimelineProps {
  profiles: TaxEqualizationProfile[];
}

/**
 * Tax Equalization Reconciliation Audit Timeline Component.
 * Audits expatriate hypothetical tax deductions, host country tax payments, and year-end settlements.
 */
export const TaxEqualizationTimeline: React.FC<TaxEqualizationTimelineProps> = ({ profiles }) => {
  if (!profiles || profiles.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center backdrop-blur-xl">
        <p className="text-slate-400 text-sm">No global mobility tax equalization profiles found in registry.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
      <h3 className="text-white font-extrabold text-xl mb-6 flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-cyan-500 animate-ping" />
        Global Mobility Tax Equalization & Settlement Audit Ledger
      </h3>

      <div className="space-y-4">
        {profiles.map((p) => (
          <div
            key={p.profileId}
            className="relative pl-6 border-l-2 border-slate-800 hover:border-cyan-500 transition-colors"
          >
            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-cyan-500 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-cyan-400 font-extrabold text-sm">{p.profileId}</span>
                  <span className="text-slate-400 text-xs">Expat: {p.expatriateFullName}</span>
                  <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {p.homeCountryCode} ➔ {p.hostCountryCode}
                  </span>
                </div>
                <p className="text-slate-300 text-xs">
                  Base Salary: <strong className="text-white">${p.annualBaseSalaryUsd.toLocaleString()}</strong> | Allowances:{' '}
                  <strong className="text-cyan-300">${p.annualExpatAllowancesUsd.toLocaleString()}</strong> | Equalization Balance:{' '}
                  <strong className="text-emerald-400">${p.equalizationDifferentialBalanceUsd.toLocaleString()}</strong>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="text-cyan-400 font-extrabold text-xs">
                    {p.profileStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
