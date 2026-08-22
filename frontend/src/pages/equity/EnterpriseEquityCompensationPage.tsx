import React, { useState } from 'react';
import { EquityGrantCard, EquityGrant } from '../../components/equity/EquityGrantCard';
import { EquityExerciseTimeline } from '../../components/equity/EquityExerciseTimeline';

/**
 * Enterprise Equity Compensation & ESOP Management Dashboard Page.
 * Surveillance dashboard for employee stock option grants (ISO, NSO, RSU),
 * 409A Fair Market Value tracking, cliff vesting progress, and exercise telemetry.
 */
export default function EnterpriseEquityCompensationPage() {
  const [grants, setGrants] = useState<EquityGrant[]>([
    {
      grantId: 'ESOP-901',
      employeeId: 'EMP-4011',
      employeeFullName: 'Marcus Vance',
      grantType: 'INCENTIVE_STOCK_OPTION_ISO',
      totalOptionsGranted: 10000,
      vestedOptionsCount: 5000,
      exercisedOptionsCount: 2000,
      strikePriceUsd: 2.5,
      currentFmvUsd: 14.8,
      grantStatus: 'ACTIVE_VESTING',
    },
    {
      grantId: 'ESOP-902',
      employeeId: 'EMP-4012',
      employeeFullName: 'Samantha Reed',
      grantType: 'RESTRICTED_STOCK_UNIT_RSU',
      totalOptionsGranted: 15000,
      vestedOptionsCount: 15000,
      exercisedOptionsCount: 5000,
      strikePriceUsd: 0.0,
      currentFmvUsd: 14.8,
      grantStatus: 'FULLY_VESTED',
    },
  ]);

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [newGrant, setNewGrant] = useState({
    employeeFullName: '',
    employeeId: '',
    grantType: 'INCENTIVE_STOCK_OPTION_ISO',
    totalOptionsGranted: 5000,
    strikePriceUsd: 3.5,
    currentFmvUsd: 14.8,
  });

  const handleExerciseOptions = (grantId: string) => {
    alert(`Initiated stock option exercise transaction for Grant ${grantId}`);
  };

  const handleIssueGrant = (e: React.FormEvent) => {
    e.preventDefault();
    const created: EquityGrant = {
      grantId: `ESOP-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      employeeId: newGrant.employeeId,
      employeeFullName: newGrant.employeeFullName,
      grantType: newGrant.grantType,
      totalOptionsGranted: newGrant.totalOptionsGranted,
      vestedOptionsCount: 0,
      exercisedOptionsCount: 0,
      strikePriceUsd: newGrant.strikePriceUsd,
      currentFmvUsd: newGrant.currentFmvUsd,
      grantStatus: 'ACTIVE_VESTING',
    };

    setGrants([created, ...grants]);
    setShowIssueModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 rounded-3xl p-8 mb-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-500/20 border border-purple-500/40 text-purple-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                SEC & IRS 409A Valuation Engine
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                Cap Table & ESOP Management
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">
              Enterprise Equity & ESOP Hub
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              High-precision cap table management for ISO/NSO stock options and RSUs, cliff vesting calculations, 409A Fair Market Value spread modeling, and exercise telemetry.
            </p>
          </div>

          <button
            onClick={() => setShowIssueModal(true)}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl shadow-purple-600/25 transition-all transform hover:-translate-y-0.5"
          >
            + Issue Equity Grant
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Total Active Grants
          </span>
          <span className="text-white text-3xl font-black">{grants.length}</span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Total Options Pool
          </span>
          <span className="text-purple-400 text-3xl font-black">
            {grants.reduce((acc, g) => acc + g.totalOptionsGranted, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Total Vested Options
          </span>
          <span className="text-emerald-400 text-3xl font-black">
            {grants.reduce((acc, g) => acc + g.vestedOptionsCount, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            409A Fair Market Value
          </span>
          <span className="text-cyan-400 text-3xl font-black">$14.80</span>
        </div>
      </div>

      {/* Grants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {grants.map((g) => (
          <EquityGrantCard
            key={g.grantId}
            grant={g}
            onExerciseOptions={handleExerciseOptions}
          />
        ))}
      </div>

      {/* Audit Timeline */}
      <EquityExerciseTimeline grants={grants} />

      {/* Issue Grant Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl">
            <h3 className="text-white font-extrabold text-2xl mb-6">Issue Stock Option Grant</h3>
            <form onSubmit={handleIssueGrant} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1">Employee Full Name</label>
                <input
                  type="text"
                  required
                  value={newGrant.employeeFullName}
                  onChange={(e) => setNewGrant({ ...newGrant, employeeFullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Employee ID Ref</label>
                  <input
                    type="text"
                    required
                    value={newGrant.employeeId}
                    onChange={(e) => setNewGrant({ ...newGrant, employeeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Grant Type</label>
                  <select
                    value={newGrant.grantType}
                    onChange={(e) => setNewGrant({ ...newGrant, grantType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  >
                    <option value="INCENTIVE_STOCK_OPTION_ISO">ISO (Incentive Stock Option)</option>
                    <option value="NON_QUALIFIED_STOCK_OPTION_NSO">NSO (Non-Qualified Option)</option>
                    <option value="RESTRICTED_STOCK_UNIT_RSU">RSU (Restricted Stock Unit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Total Options Granted</label>
                  <input
                    type="number"
                    value={newGrant.totalOptionsGranted}
                    onChange={(e) => setNewGrant({ ...newGrant, totalOptionsGranted: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Strike Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newGrant.strikePriceUsd}
                    onChange={(e) => setNewGrant({ ...newGrant, strikePriceUsd: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="bg-slate-800 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  Issue Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
