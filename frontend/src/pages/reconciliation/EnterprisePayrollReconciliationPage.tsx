import React, { useState } from 'react';
import { Landmark, ArrowRightLeft, ShieldCheck, Download, Search, Sparkles, CheckCircle2, Clock, Globe, DollarSign, Activity, AlertTriangle, FileCheck } from 'lucide-react';
import ReconciliationBatchCard, { ReconciliationBatch } from '../../components/reconciliation/ReconciliationBatchCard';
import ReconciliationStreamTimeline from '../../components/reconciliation/ReconciliationStreamTimeline';

const RECONCILIATION_BATCHES: ReconciliationBatch[] = [
  {
    id: 'rec-401',
    batchName: 'US-East ACH Payroll vs FedWire Clearing',
    bankPartner: 'JPMorgan Chase (ACH Direct Settlement)',
    totalDisbursedUSD: 4850000,
    matchedTransactionsCount: 1420,
    unmatchedDiscrepanciesCount: 0,
    varianceUSD: 0.00,
    clearingHouse: 'FedACH System',
    reconciliationDate: 'Oct 24, 2026',
    status: 'PERFECT_MATCH',
  },
  {
    id: 'rec-402',
    batchName: 'UK & EU BACS / SEPA Payroll Settlement',
    bankPartner: 'Barclays Commercial Banking',
    totalDisbursedUSD: 3120000,
    matchedTransactionsCount: 850,
    unmatchedDiscrepanciesCount: 2,
    varianceUSD: 14.50,
    clearingHouse: 'BACS & Target2 SEPA',
    reconciliationDate: 'Oct 24, 2026',
    status: 'VARIANCE_DETECTED',
  },
  {
    id: 'rec-403',
    batchName: 'Global Contractor Wise & SWIFT Wire Pool',
    bankPartner: 'Wise for Business & SWIFT Network',
    totalDisbursedUSD: 1950000,
    matchedTransactionsCount: 410,
    unmatchedDiscrepanciesCount: 0,
    varianceUSD: 0.00,
    clearingHouse: 'SWIFT GPI Network',
    reconciliationDate: 'Oct 23, 2026',
    status: 'PERFECT_MATCH',
  },
];

export default function EnterprisePayrollReconciliationPage() {
  const [batches, setBatches] = useState<ReconciliationBatch[]>(RECONCILIATION_BATCHES);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'batches' | 'reconcile-stream'>('batches');
  const [selectedBatchModal, setSelectedBatchModal] = useState<ReconciliationBatch | null>(null);

  const totalVolumeUSD = batches.reduce((acc, b) => acc + b.totalDisbursedUSD, 0);

  const filteredBatches = batches.filter(b =>
    b.batchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.bankPartner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.clearingHouse.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Banking Ledger
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Automated Bank Feed Matching (MT940 / BAI2)
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
              Enterprise Payroll Bank Reconciliation Suite
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Automated 2-way bank feed matching, ACH clearing house statement verification, discrepancy resolution workflows, and general ledger journal posting.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm">
              <FileCheck className="w-4 h-4" /> Trigger Auto-Reconciliation
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Reconciled Disbursed Volume</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalVolumeUSD / 1000000).toFixed(2)}M USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 99.99% Match Rate Across Clearing Feeds
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Matched Transactions</span>
              <Landmark className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">2,680 Items</div>
            <div className="text-teal-400 text-xs mt-2 font-medium">
              Automated BAI2 & MT940 Matching
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Discrepancies</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">$14.50 Total</div>
            <div className="text-amber-400 text-xs mt-2 font-medium">
              2 Foreign Exchange Rounding Items
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('batches')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'batches'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Landmark className="w-4 h-4" /> Bank Batches
            </button>
            <button
              onClick={() => setActiveTab('reconcile-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'reconcile-stream'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Real-time Matching Stream
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search batch or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'reconcile-stream' ? (
          <ReconciliationStreamTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredBatches.map((batch) => (
              <ReconciliationBatchCard
                key={batch.id}
                batch={batch}
                onInspect={() => setSelectedBatchModal(batch)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedBatchModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedBatchModal.batchName}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedBatchModal.bankPartner}</div>
              </div>
              <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded font-mono text-xs font-bold border border-emerald-500/30">
                {selectedBatchModal.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Total Disbursed Volume</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedBatchModal.totalDisbursedUSD.toLocaleString()} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Matched Transactions</span>
                <span className="text-white font-bold text-sm">{selectedBatchModal.matchedTransactionsCount} Items</span>
              </div>
              <div>
                <span className="text-slate-500 block">Unmatched Discrepancies</span>
                <span className="text-amber-400 font-bold text-sm">{selectedBatchModal.unmatchedDiscrepanciesCount} Items</span>
              </div>
              <div>
                <span className="text-slate-500 block">Variance Delta</span>
                <span className="text-teal-400 font-bold text-sm">${selectedBatchModal.varianceUSD.toFixed(2)} USD</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedBatchModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
