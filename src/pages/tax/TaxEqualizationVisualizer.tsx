import React, { useState, useMemo } from 'react';
import { TaxEqualizationService } from './TaxEqualizationService';

export default function TaxEqualizationVisualizer() {
  const [service] = useState(() => new TaxEqualizationService());
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('EXP-TEQ-001');

  const assignments = service.getState().getAssignments();
  const activeAssignment = useMemo(() => {
    return assignments.find(a => a.assignmentId === selectedAssignmentId) || assignments[0];
  }, [assignments, selectedAssignmentId]);

  const result = useMemo(() => {
    return service.calculateTaxEqualization(activeAssignment);
  }, [service, activeAssignment]);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-full border border-cyan-500/30 uppercase tracking-wider">
              Global Expatriate Mobility & TEQ
            </span>
            <span className="text-slate-400 text-xs font-mono">v7.2.0 • Double Tax Treaty & HTAX Engine</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
            Global Tax Equalization & Mobility Suite
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Hypothetical tax (HTAX) stay-at-home calculation, host country tax liability modeling, and employer tax gross-up balancing.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Gross Mobility Package</div>
          <div className="text-xl font-bold text-cyan-300">${result.grossPackageUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Base + Allowances</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Hypothetical Tax (HTAX)</div>
          <div className="text-xl font-bold text-amber-400">${result.hypotheticalTaxDeductionUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Employee Stay-at-Home Tax</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Host Country Tax Liability</div>
          <div className="text-xl font-bold text-rose-400">${result.actualHostTaxLiabilityUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">{activeAssignment.hostCountry} Local Tax Rate ({activeAssignment.hostCountryTaxRatePercent}%)</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Employer Gross-Up Cost</div>
          <div className="text-xl font-bold text-teal-300">${result.employerTaxGrossUpAdjustmentUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Tax Equalization Differential</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Assignment Profile</h2>

          <div>
            <label className="text-xs text-slate-400 block mb-2 font-medium">Select Expatriate Assignment</label>
            <select
              value={selectedAssignmentId}
              onChange={e => setSelectedAssignmentId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            >
              {assignments.map(a => (
                <option key={a.assignmentId} value={a.assignmentId}>
                  {a.fullName} ({a.homeCountry} → {a.hostCountry})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Home Country:</span>
              <span className="text-slate-200">{activeAssignment.homeCountry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Host Country:</span>
              <span className="text-cyan-300">{activeAssignment.hostCountry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Foreign Exclusion (FEIE):</span>
              <span className="text-emerald-400">${activeAssignment.foreignEarnedIncomeExclusionUsd.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Tax Equalization Financial Settlement</h2>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Expatriate Net Take-Home Pay:</span>
              <span className="text-emerald-400 font-bold">${result.netExpatriateTakeHomeUsd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-400">Total Employer Investment Cost:</span>
              <span className="text-cyan-300 font-bold">${result.effectiveTaxEqualizationCostUsd.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
