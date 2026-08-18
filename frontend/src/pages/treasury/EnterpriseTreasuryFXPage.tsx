import React, { useState } from 'react';
import { RefreshCw, ArrowRightLeft, ShieldCheck, Download, Search, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, DollarSign, Activity, Lock, Landmark } from 'lucide-react';
import ForexSwapCard, { ForexSwapContract } from '../../components/treasury/ForexSwapCard';
import SwapExecutionTimeline from '../../components/treasury/SwapExecutionTimeline';

const FOREX_SWAPS: ForexSwapContract[] = [
  {
    id: 'swap-801',
    pairName: 'USD / EUR Institutional Swap',
    baseCurrency: 'USD',
    quoteCurrency: 'EUR',
    spotRate: 0.9215,
    forwardPoints: 0.0012,
    notionalAmountBaseUSD: 2500000,
    settlementDate: 'Oct 30, 2026',
    liquidityProvider: 'JPMorgan Chase Forex Desk',
    slippageTolerancePercent: 0.05,
    status: 'EXECUTED',
  },
  {
    id: 'swap-802',
    pairName: 'USD / GBP Treasury Hedging',
    baseCurrency: 'USD',
    quoteCurrency: 'GBP',
    spotRate: 0.7680,
    forwardPoints: -0.0008,
    notionalAmountBaseUSD: 1800000,
    settlementDate: 'Nov 15, 2026',
    liquidityProvider: 'Barclays Institutional FX',
    slippageTolerancePercent: 0.08,
    status: 'ORDER_OPEN',
  },
  {
    id: 'swap-803',
    pairName: 'USD / JPY Currency Buffer',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    spotRate: 149.35,
    forwardPoints: 0.25,
    notionalAmountBaseUSD: 3100000,
    settlementDate: 'Dec 01, 2026',
    liquidityProvider: 'Mitsubishi UFJ Financial Group',
    slippageTolerancePercent: 0.10,
    status: 'EXECUTED',
  },
];

export default function EnterpriseTreasuryFXPage() {
  const [swaps, setSwaps] = useState<ForexSwapContract[]>(FOREX_SWAPS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'swaps' | 'swap-stream'>('swaps');
  const [selectedSwapModal, setSelectedSwapModal] = useState<ForexSwapContract | null>(null);

  const totalNotionalUSD = swaps.reduce((acc, s) => acc + s.notionalAmountBaseUSD, 0);

  const filteredSwaps = swaps.filter(s =>
    s.pairName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.liquidityProvider.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.baseCurrency.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.quoteCurrency.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-950 via-slate-900 to-cyan-950 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Treasury Desk
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-blue-400" /> Automated Institutional Liquidity Routing
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
              Automated Treasury FX Swap Engine
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Programmatic spot and forward forex swaps, automated currency hedging algorithms, zero-slippage liquidity provider routing, and multi-currency treasury balancing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-2 border border-blue-400/20 text-sm">
              <RefreshCw className="w-4 h-4" /> Trigger Auto-Hedging Swap
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
              <span>Total Hedged Notional Volume</span>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalNotionalUSD / 1000000).toFixed(2)}M USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% FX Volatility Hedged
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Average Execution Slippage</span>
              <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">0.07 bps</div>
            <div className="text-cyan-400 text-xs mt-2 font-medium">
              Institutional Prime Broker Liquidity
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Swap Contracts</span>
              <Globe className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">3 Active Swaps</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              USD/EUR, USD/GBP & USD/JPY
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('swaps')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'swaps'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" /> Swap Contracts
            </button>
            <button
              onClick={() => setActiveTab('swap-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'swap-stream'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Real-time Execution Telemetry
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search swap pair or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'swap-stream' ? (
          <SwapExecutionTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSwaps.map((swap) => (
              <ForexSwapCard
                key={swap.id}
                swap={swap}
                onInspect={() => setSelectedSwapModal(swap)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedSwapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedSwapModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedSwapModal.pairName}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedSwapModal.liquidityProvider}</div>
              </div>
              <span className="bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded font-mono text-xs font-bold border border-blue-500/30">
                {selectedSwapModal.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Notional Amount</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedSwapModal.notionalAmountBaseUSD.toLocaleString()} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Spot Execution Rate</span>
                <span className="text-blue-400 font-bold text-sm">{selectedSwapModal.spotRate}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Forward Points</span>
                <span className="text-amber-400 font-bold text-sm">{selectedSwapModal.forwardPoints > 0 ? `+${selectedSwapModal.forwardPoints}` : selectedSwapModal.forwardPoints}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Settlement Value Date</span>
                <span className="text-white font-bold text-sm">{selectedSwapModal.settlementDate}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedSwapModal(null)}
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
