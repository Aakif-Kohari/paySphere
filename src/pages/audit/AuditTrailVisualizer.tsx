import React, { useState, useMemo } from 'react';
import { AuditTrailService } from './AuditTrailService';

export default function AuditTrailVisualizer() {
  const [service] = useState(() => new AuditTrailService());
  const logs = service.getState().getLogChain();

  const integrityResult = useMemo(() => {
    return service.verifyAuditChainIntegrity(logs);
  }, [service, logs]);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="mb-8 border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-full border border-cyan-500/30 uppercase tracking-wider">
              SOC 2 & SOX 404 Cryptographic Audit
            </span>
            <span className="text-slate-400 text-xs font-mono">v7.4.0 • SHA-256 Hash Chain Integrity Engine</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
            Payroll Audit Trail & Forensic Suite
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Cryptographically linked tamper-evident ledger, real-time wage spike anomaly detection, and SOX 404 audit logging.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Chain Integrity Status</div>
          <div className="text-2xl font-bold text-emerald-400">
            {integrityResult.isChainIntact ? '✓ INTACT & VERIFIED' : '✗ CHAIN TAMPERED'}
          </div>
          <div className="text-slate-400 text-xs mt-1 font-mono">{integrityResult.totalLogsAnalyzed} Cryptographic Blocks</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Detected Anomaly Events</div>
          <div className="text-2xl font-bold text-amber-400">{integrityResult.detectedAnomaliesCount}</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Real-Time Risk Alerts</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-xl">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Regulatory Standard</div>
          <div className="text-2xl font-bold text-cyan-300">SOX 404 / SOC 2</div>
          <div className="text-slate-400 text-xs mt-1 font-mono">Tamper-Proof Audit Spec</div>
        </div>
      </div>

      {/* Audit Log Chain Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-200 mb-4">Immutable Cryptographic Audit Trail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="py-3 px-3">Entry ID</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor / IP</th>
                <th className="py-3 px-3">Entity Type</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3 text-right">Anomaly Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {logs.map(log => (
                <tr key={log.entryId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-3 text-slate-200 font-bold">{log.entryId}</td>
                  <td className="py-3 px-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="py-3 px-3 text-cyan-300">{log.actorUserId} ({log.actorIpAddress})</td>
                  <td className="py-3 px-3 text-purple-300">{log.entityType}</td>
                  <td className="py-3 px-3 text-slate-200">{log.action}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`px-2 py-0.5 text-xs rounded ${log.isAnomaly ? 'bg-amber-500/20 text-amber-400 font-bold' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {log.isAnomaly ? 'ALERT' : 'NORMAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
