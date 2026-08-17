import React from 'react';
import { Activity, CheckCircle2, ShieldCheck, DollarSign, Clock, FileCheck } from 'lucide-react';

interface TelemetryBatch {
  id: string;
  batchCode: string;
  department: string;
  disbursedUSD: number;
  bankRouting: string;
  timestamp: string;
  complianceHash: string;
}

const RECENT_DISBURSEMENTS: TelemetryBatch[] = [
  {
    id: 'batch-1',
    batchCode: 'PAY-2026-08-A',
    department: 'Engineering & Product Development',
    disbursedUSD: 1202500,
    bankRouting: 'JPMorgan Chase (ACH Direct)',
    timestamp: '12 mins ago',
    complianceHash: '0x8f9a...3b21',
  },
  {
    id: 'batch-2',
    batchCode: 'PAY-2026-08-B',
    department: 'Global Sales & Enterprise Accounts',
    disbursedUSD: 923000,
    bankRouting: 'Bank of America (Wire)',
    timestamp: '45 mins ago',
    complianceHash: '0x4e1c...99a0',
  },
  {
    id: 'batch-3',
    batchCode: 'PAY-2026-08-C',
    department: 'Customer Success & Support Operations',
    disbursedUSD: 396500,
    bankRouting: 'Wells Fargo (ACH Direct)',
    timestamp: '2 hours ago',
    complianceHash: '0x7d32...11f8',
  },
];

export default function ExecutiveDisbursementTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> Automated ACH / Wire Disbursement Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">Live banking gateway response codes and cryptography compliance hashes.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-emerald-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Automated Compliance Lock
        </div>
      </div>

      <div className="space-y-4">
        {RECENT_DISBURSEMENTS.map((batch) => (
          <div
            key={batch.id}
            className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  {batch.batchCode}
                </span>
                <span className="text-slate-500 text-xs font-mono">{batch.timestamp}</span>
              </div>
              <h4 className="text-base font-bold text-slate-100">{batch.department}</h4>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                Gateway: <span className="text-slate-200">{batch.bankRouting}</span> • Hash: <span className="text-slate-500">{batch.complianceHash}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-emerald-400 font-mono font-extrabold text-lg bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20">
                ${batch.disbursedUSD.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Settled
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
