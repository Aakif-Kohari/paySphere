import React, { useState } from 'react';
import { Award, ShieldCheck, Download, Search, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, TrendingUp, PieChart, Lock, Zap, Activity } from 'lucide-react';
import EquityGrantCard, { EquityGrant } from '../../components/equity/EquityGrantCard';
import EquityVestingTimeline from '../../components/equity/EquityVestingTimeline';

const EQUITY_GRANTS: EquityGrant[] = [
  {
    id: 'eq-1001',
    granteeName: 'Elena Rostova',
    roleTitle: 'VP of Distributed Systems Engineering',
    grantType: 'ISO Stock Options',
    sharesGranted: 125000,
    strikePriceUSD: 1.25,
    currentFairMarketValueUSD: 18.50,
    totalVestedShares: 62500,
    vestingStartDate: 'Jan 1, 2024',
    vestingSchedule: '4-Year Linear with 1-Year Cliff',
    vestingProgressPercent: 50.0,
    status: 'ACTIVE_VESTING',
  },
  {
    id: 'eq-1002',
    granteeName: 'Marcus Vance',
    roleTitle: 'Principal Quantitative Architect',
    grantType: 'Restricted Stock Units (RSUs)',
    sharesGranted: 85000,
    strikePriceUSD: 0.00,
    currentFairMarketValueUSD: 18.50,
    totalVestedShares: 42500,
    vestingStartDate: 'Jul 1, 2024',
    vestingSchedule: '4-Year Quarterly Vesting',
    vestingProgressPercent: 50.0,
    status: 'ACTIVE_VESTING',
  },
  {
    id: 'eq-1003',
    granteeName: 'David Chen',
    roleTitle: 'Head of Global Treasury & FX',
    grantType: 'NSO Stock Options',
    sharesGranted: 60000,
    strikePriceUSD: 2.10,
    currentFairMarketValueUSD: 18.50,
    totalVestedShares: 60000,
    vestingStartDate: 'Jan 1, 2022',
    vestingSchedule: '4-Year Linear',
    vestingProgressPercent: 100.0,
    status: 'FULLY_VESTED',
  },
];

export default function EnterpriseEquityDashboardPage() {
  const [grants, setGrants] = useState<EquityGrant[]>(EQUITY_GRANTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'grants' | 'vesting-stream'>('grants');
  const [selectedGrantModal, setSelectedGrantModal] = useState<EquityGrant | null>(null);

  const totalPoolValuationUSD = grants.reduce((acc, g) => acc + (g.sharesGranted * g.currentFairMarketValueUSD), 0);

  const filteredGrants = grants.filter(g =>
    g.granteeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.roleTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.grantType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-amber-950 via-slate-900 to-yellow-950 border border-amber-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-amber-500/20 text-amber-300 text-xs px-3 py-1 rounded-full font-semibold border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Cap Table & Equity
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SEC 409A Valuation Synchronized
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-200 bg-clip-text text-transparent">
              Enterprise Equity & Option Grant Management
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Automated ISO/NSO stock option grants, RSU vesting schedules, 409A fair market valuation tracking, and employee equity exercise portals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-amber-600/30 transition flex items-center gap-2 border border-amber-400/20 text-sm">
              <Download className="w-4 h-4" /> Export Cap Table Summary
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
              <span>Total Cap Table Value</span>
              <TrendingUp className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalPoolValuationUSD / 1000000).toFixed(2)}M USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fair Market Value: $18.50 / Share
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Option Pool</span>
              <PieChart className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">270,000 Shares</div>
            <div className="text-amber-400 text-xs mt-2 font-medium">
              Distributed Across ISO, NSO & RSU Pool
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Average Vesting Maturity</span>
              <Clock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">66.6%</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              1-Year Cliff Passed Across Active Staff
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('grants')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'grants'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Award className="w-4 h-4" /> Employee Equity Grants
            </button>
            <button
              onClick={() => setActiveTab('vesting-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'vesting-stream'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Live Vesting Telemetry
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search grantee or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'vesting-stream' ? (
          <EquityVestingTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredGrants.map((grant) => (
              <EquityGrantCard
                key={grant.id}
                grant={grant}
                onInspect={() => setSelectedGrantModal(grant)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedGrantModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedGrantModal.granteeName}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedGrantModal.roleTitle}</div>
              </div>
              <span className="bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded font-mono text-xs font-bold border border-amber-500/30">
                {selectedGrantModal.grantType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Total Shares Granted</span>
                <span className="text-white font-bold text-sm">{selectedGrantModal.sharesGranted.toLocaleString()} Shares</span>
              </div>
              <div>
                <span className="text-slate-500 block">Current Net Valuation</span>
                <span className="text-emerald-400 font-bold text-sm">${(selectedGrantModal.sharesGranted * selectedGrantModal.currentFairMarketValueUSD).toLocaleString()} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Strike Price</span>
                <span className="text-amber-400 font-bold text-sm">${selectedGrantModal.strikePriceUSD.toFixed(2)} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Vesting Schedule</span>
                <span className="text-indigo-400 font-bold text-sm">{selectedGrantModal.vestingSchedule}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedGrantModal(null)}
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
