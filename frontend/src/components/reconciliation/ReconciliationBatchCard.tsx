import React from 'react';
import { Landmark, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface ReconciliationBatch {
  id: string;
  batchName: string;
  bankPartner: string;
  totalDisbursedUSD: number;
  matchedTransactionsCount: number;
  unmatchedDiscrepanciesCount: number;
  varianceUSD: number;
  clearingHouse: string;
  reconciliationDate: string;
  status: 'PERFECT_MATCH' | 'VARIANCE_DETECTED' | 'UNRECONCILED';
}

interface ReconciliationBatchCardProps {
  batch: ReconciliationBatch;
  onInspect: () => void;
}

export default function ReconciliationBatchCard({ batch, onInspect }: ReconciliationBatchCardProps) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between group">
      <div>
        {/* Header Batch & Status */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition">
              {batch.batchName}
            </h3>
            <p className="text-xs text-slate-400 font-medium">{batch.bankPartner}</p>
          </div>

          <span className={`text-xs px-2.5 py-1 rounded-lg font-mono font-semibold border ${
            batch.status === 'PERFECT_MATCH'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            {batch.status}
          </span>
        </div>

        {/* Total Volume Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Total Disbursed Volume</div>
          <div className="text-2xl font-black text-white">
            ${batch.totalDisbursedUSD.toLocaleString()} USD
          </div>
          <div className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Matched {batch.matchedTransactionsCount} Transactions
          </div>
        </div>

        {/* Metadata Specs */}
        <div className="space-y-2 text-xs font-mono mb-5">
          <div className="flex justify-between text-slate-400">
            <span>Clearing System:</span>
            <span className="text-white font-bold">{batch.clearingHouse}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Variance Delta:</span>
            <span className={batch.varianceUSD === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              ${batch.varianceUSD.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">Reconciled: {batch.reconciliationDate}</span>
        <button
          onClick={onInspect}
          className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/30 transition flex items-center gap-1"
        >
          <span>Batch Audit</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
