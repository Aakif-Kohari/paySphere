import React, { useState } from 'react';
import { DollarSign, Globe, RefreshCw, ArrowUpRight, TrendingUp, ShieldCheck, Download, Filter, Search, Sparkles, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import CurrencyVaultCard, { CurrencyVault } from '../../components/treasury/CurrencyVaultCard';
import ForexSettlementTimeline from '../../components/treasury/ForexSettlementTimeline';

const INITIAL_VAULTS: CurrencyVault[] = [
  {
    id: 'vlt-01',
    currencyCode: 'USD',
    currencyName: 'United States Dollar',
    flagEmoji: '🇺🇸',
    totalBalance: 8450000.50,
    hedgedPercentage: 100,
    fxRateToUSD: 1.0,
    dailyChangePercentage: 0.0,
    status: 'ACTIVE',
  },
  {
    id: 'vlt-02',
    currencyCode: 'EUR',
    currencyName: 'Euro Currency Union',
    flagEmoji: '🇪🇺',
    totalBalance: 3200000.00,
    hedgedPercentage: 85,
    fxRateToUSD: 1.085,
    dailyChangePercentage: 0.42,
    status: 'ACTIVE',
  },
  {
    id: 'vlt-03',
    currencyCode: 'GBP',
    currencyName: 'British Pound Sterling',
    flagEmoji: '🇬🇧',
    totalBalance: 1950000.75,
    hedgedPercentage: 90,
    fxRateToUSD: 1.272,
    dailyChangePercentage: -0.15,
    status: 'ACTIVE',
  },
  {
    id: 'vlt-04',
    currencyCode: 'SGD',
    currencyName: 'Singapore Dollar',
    flagEmoji: '🇸🇬',
    totalBalance: 2400000.00,
    hedgedPercentage: 75,
    fxRateToUSD: 0.745,
    dailyChangePercentage: 0.18,
    status: 'ACTIVE',
  },
];

export default function MultiCurrencyTreasuryPage() {
  const [vaults, setVaults] = useState<CurrencyVault[]>(INITIAL_VAULTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'vaults' | 'forex-stream'>('vaults');
  const [selectedVaultModal, setSelectedVaultModal] = useState<CurrencyVault | null>(null);

  const totalUSDValue = vaults.reduce((acc, v) => acc + v.totalBalance * v.fxRateToUSD, 0);

  const filteredVaults = vaults.filter(v =>
    v.currencyCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.currencyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Treasury Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold border border-blue-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Global Treasury
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Automated FX Hedging Protocol
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-blue-200 bg-clip-text text-transparent">
              Multi-Currency Liquidity & FX Vaults
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Cross-border treasury reserves management, dynamic exchange hedging, automated liquidity rebalancing, and real-time forex settlements.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-2 border border-blue-400/20 text-sm">
              <RefreshCw className="w-4 h-4" /> Trigger Liquidity Swap
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Global Reserve Value</span>
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalUSDValue / 1000000).toFixed(2)}M USD</div>
            <div className="text-blue-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> Synchronized across 4 central banks
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Automated FX Hedged Coverage</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">87.5%</div>
            <div className="text-emerald-400 text-xs mt-2 font-medium">
              Volatility Risk Shield Active
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Vault Accounts</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{vaults.length} Vaults</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              USD, EUR, GBP, SGD Pools
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('vaults')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'vaults'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Globe className="w-4 h-4" /> Reserve Vaults
            </button>
            <button
              onClick={() => setActiveTab('forex-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'forex-stream'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <RefreshCw className="w-4 h-4" /> Settlement Stream
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search currency or vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Body */}
        {activeTab === 'forex-stream' ? (
          <ForexSettlementTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredVaults.map((vault) => (
              <CurrencyVaultCard
                key={vault.id}
                vault={vault}
                onInspect={() => setSelectedVaultModal(vault)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal Popup */}
      {selectedVaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedVaultModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{selectedVaultModal.flagEmoji}</span>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedVaultModal.currencyName} ({selectedVaultModal.currencyCode})</h2>
                <div className="text-xs text-slate-400 font-mono">Vault ID: {selectedVaultModal.id}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Total Reserve Balance</span>
                <span className="text-white font-bold text-sm">{selectedVaultModal.totalBalance.toLocaleString()} {selectedVaultModal.currencyCode}</span>
              </div>
              <div>
                <span className="text-slate-500 block">USD Equivalent</span>
                <span className="text-emerald-400 font-bold text-sm">${(selectedVaultModal.totalBalance * selectedVaultModal.fxRateToUSD).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">FX Spot Rate</span>
                <span className="text-blue-400 font-bold text-sm">1 {selectedVaultModal.currencyCode} = ${selectedVaultModal.fxRateToUSD} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Hedging Coverage</span>
                <span className="text-amber-400 font-bold text-sm">{selectedVaultModal.hedgedPercentage}% Covered</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedVaultModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
