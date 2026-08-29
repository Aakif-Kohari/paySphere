import React, { useState, useMemo } from 'react';
import { EquityEsopService } from './EquityEsopService';

export default function EquityEsopVisualizer() {
  const [service] = useState(() => new EquityEsopService());
  const [selectedGrantId, setSelectedGrantId] = useState<string>('EQUITY-GRANT-101');
  const [sharesToExercise, setSharesToExercise] = useState<number>(1000);
  const [exerciseFmv, setExerciseFmv] = useState<number>(55.00);

  const grants = service.getState().getGrants();
  const activeGrant = useMemo(() => {
    return grants.find(g => g.grantId === selectedGrantId) || grants[0];
  }, [grants, selectedGrantId]);

  const taxResult = useMemo(() => {
    return service.calculateExerciseTaxWithholding(activeGrant, sharesToExercise, exerciseFmv);
  }, [service, activeGrant, sharesToExercise, exerciseFmv]);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-violet-500/20 text-violet-400 text-xs font-semibold rounded-full border border-violet-500/30 uppercase tracking-wider">
              Equity & ESOP Compensation Tax
            </span>
            <span className="text-slate-400 text-xs font-mono">v7.3.0 • NSO, ISO (AMT), RSU & Section 83(b) Engine</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400">
            Equity Compensation & Stock Options Tax Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Automated statutory tax withholding calculation on stock option exercises, RSU vesting, FICA Medicare/Social Security enforcement, and ISO AMT preference tracking.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Gross Option Spread</div>
          <div className="text-xl font-bold text-violet-300">${taxResult.grossSpreadUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">{taxResult.sharesExercised} Shares @ (${exerciseFmv} - ${activeGrant.strikePriceUsd})</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Federal Supplemental Tax</div>
          <div className="text-xl font-bold text-amber-400">${taxResult.federalSupplementalTaxUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">22% Statutory Flat Rate</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">FICA (SS + Medicare) Tax</div>
          <div className="text-xl font-bold text-rose-400">${(taxResult.ficaMedicareTaxUsd + taxResult.ficaSocialSecurityTaxUsd).toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">7.65% Combined FICA Rate</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">ISO AMT Preference Item</div>
          <div className="text-xl font-bold text-cyan-300">${taxResult.isoAmtPreferenceItemUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">{activeGrant.grantType === 'ISO' ? 'Form 6251 AMT Item' : 'N/A for Non-ISO'}</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Grant & Exercise Controls</h2>

          <div>
            <label className="text-xs text-slate-400 block mb-2 font-medium">Select Equity Grant</label>
            <select
              value={selectedGrantId}
              onChange={e => setSelectedGrantId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            >
              {grants.map(g => (
                <option key={g.grantId} value={g.grantId}>
                  {g.employeeName} - {g.grantType} ({g.vestedShares} Vested)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-2 font-medium">Shares to Exercise / Vest</label>
            <input
              type="number"
              value={sharesToExercise}
              onChange={e => setSharesToExercise(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-2 font-medium">Current Stock Fair Market Value ($USD)</label>
            <input
              type="number"
              value={exerciseFmv}
              onChange={e => setExerciseFmv(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Payroll Tax Withholding Settlement Breakdown</h2>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Statutory Required Withholding:</span>
              <span className="text-amber-400 font-bold">${taxResult.totalPayableWithholdingUsd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Net Stock Proceeds Post Tax:</span>
              <span className="text-emerald-400 font-bold">${(taxResult.grossSpreadUsd - taxResult.totalPayableWithholdingUsd).toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-400">Section 83(b) Election Status:</span>
              <span className="text-violet-300 font-bold">{activeGrant.hasSection83bElection ? 'FILED WITH IRS' : 'NOT FILED'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
