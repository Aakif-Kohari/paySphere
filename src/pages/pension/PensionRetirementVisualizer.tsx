import React, { useState, useMemo } from 'react';
import { PensionRetirementService } from './PensionRetirementService';
import { EmployeeRetirementProfile } from './PensionRetirementModel';

export default function PensionRetirementVisualizer() {
  const [service] = useState(() => new PensionRetirementService());
  const [selectedProfileId, setSelectedProfileId] = useState<string>('EMP-401K-001');
  const [payPeriodSalaryUsd, setPayPeriodSalaryUsd] = useState<number>(7500);

  const profiles = service.getState().getProfiles();
  const activeProfile = useMemo(() => {
    return profiles.find(p => p.employeeId === selectedProfileId) || profiles[0];
  }, [profiles, selectedProfileId]);

  const matchResult = useMemo(() => {
    return service.calculatePayPeriodMatch(activeProfile, payPeriodSalaryUsd);
  }, [service, activeProfile, payPeriodSalaryUsd]);

  const adpTest = useMemo(() => {
    return service.evaluateAdpNonDiscriminationTest(profiles);
  }, [service, profiles]);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30 uppercase tracking-wider">
              IRS 401(k) & Pension Compliance
            </span>
            <span className="text-slate-400 text-xs font-mono">v7.0.0 • IRS 2026 Limits ($23,000 + $7,500)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Pension 401(k) Retirement Compliance Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Automated statutory elective deferral cap enforcement, tiered employer matching, and ADP/ACP non-discrimination compliance testing.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Employee Deferral</div>
          <div className="text-xl font-bold text-emerald-400">${matchResult.employeeContributionUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">{activeProfile.employeeDeferralPercent}% Deferral Rate</div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Employer Match</div>
          <div className="text-xl font-bold text-cyan-400">${matchResult.employerMatchUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Tiered Formula Match</div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Remaining Deferral Room</div>
          <div className="text-xl font-bold text-amber-300">${matchResult.remainingDeferralRoomUsd.toLocaleString()}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Max Statutory Cap</div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">ADP Compliance Test</div>
          <div className="text-xl font-bold text-teal-300">
            {adpTest.isCompliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
          </div>
          <div className="text-slate-400 text-xs mt-1 font-mono">HCE {adpTest.hceAverageDeferralPercent}% vs NHCE {adpTest.nhceAverageDeferralPercent}%</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">Employee Selection</h2>

          <div>
            <label className="text-xs text-slate-400 block mb-2 font-medium">Select Employee Profile</label>
            <select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            >
              {profiles.map(p => (
                <option key={p.employeeId} value={p.employeeId}>
                  {p.fullName} ({p.planType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-2 font-medium">Pay Period Gross Salary ($USD)</label>
            <input
              type="number"
              value={payPeriodSalaryUsd}
              onChange={e => setPayPeriodSalaryUsd(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 font-mono"
            />
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">ADP Non-Discrimination Compliance Test</h2>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Highly Compensated (HCE) Avg Deferral:</span>
              <span className="text-amber-400 font-bold">{adpTest.hceAverageDeferralPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Non-Highly Compensated (NHCE) Avg Deferral:</span>
              <span className="text-emerald-400 font-bold">{adpTest.nhceAverageDeferralPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">IRS Max Allowed HCE Deferral:</span>
              <span className="text-cyan-400 font-bold">{adpTest.maxAllowedHcePercent}%</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-400">Required Corrective Refund:</span>
              <span className="text-purple-300 font-bold">${adpTest.correctiveRefundUsd.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
