import React, { useState } from 'react';
import { DollarSign, Users, ShieldCheck, Download, Filter, Search, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, FileCheck, Activity } from 'lucide-react';
import ContractorPayoutCard, { GlobalContractor } from '../../components/contractors/ContractorPayoutCard';
import PayoutStreamTimeline from '../../components/contractors/PayoutStreamTimeline';

const CONTRACTORS: GlobalContractor[] = [
  {
    id: 'cntr-501',
    name: 'Mateo Rossi',
    title: 'Principal Distributed Systems Architect',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    country: 'Italy',
    flagEmoji: '🇮🇹',
    taxFormStatus: 'W-8BEN Verified',
    hourlyRateUSD: 145,
    hoursBilledMonthly: 160,
    monthlyGrossUSD: 23200,
    paymentMethod: 'SWIFT International Wire',
    payoutStatus: 'SCHEDULED',
  },
  {
    id: 'cntr-502',
    name: 'Aarav Sharma',
    title: 'Senior Full-Stack React / Node Engineer',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    country: 'India',
    flagEmoji: '🇮🇳',
    taxFormStatus: 'W-8BEN Verified',
    hourlyRateUSD: 95,
    hoursBilledMonthly: 172,
    monthlyGrossUSD: 16340,
    paymentMethod: 'Wise Business ACH',
    payoutStatus: 'PAID',
  },
  {
    id: 'cntr-503',
    name: 'Camila Fernandez',
    title: 'Lead UX Researcher & Systems Designer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    country: 'Argentina',
    flagEmoji: '🇦🇷',
    taxFormStatus: 'W-8BEN Verified',
    hourlyRateUSD: 85,
    hoursBilledMonthly: 150,
    monthlyGrossUSD: 12750,
    paymentMethod: 'Crypto Stablecoin (USDC)',
    payoutStatus: 'PAID',
  },
  {
    id: 'cntr-504',
    name: 'Lukas Meyer',
    title: 'Cybersecurity & DevSecOps Specialist',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    country: 'Germany',
    flagEmoji: '🇩🇪',
    taxFormStatus: 'W-8BEN Verified',
    hourlyRateUSD: 130,
    hoursBilledMonthly: 140,
    monthlyGrossUSD: 18200,
    paymentMethod: 'SEPA Instant Credit',
    payoutStatus: 'PROCESSING',
  },
];

export default function GlobalContractorDisbursementPage() {
  const [contractors, setContractors] = useState<GlobalContractor[]>(CONTRACTORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'contractors' | 'stream'>('contractors');
  const [selectedContractorModal, setSelectedContractorModal] = useState<GlobalContractor | null>(null);

  const totalMonthlyPayout = contractors.reduce((acc, c) => acc + c.monthlyGrossUSD, 0);

  const filteredContractors = contractors.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 border border-teal-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-teal-500/20 text-teal-300 text-xs px-3 py-1 rounded-full font-semibold border border-teal-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Global Workforce
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Automated W-8BEN / W-9 Verification
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-teal-200 bg-clip-text text-transparent">
              Global Contractor Disbursement & Invoicing
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Automated multi-gateway payouts via SWIFT, Wise, SEPA, and USDC Stablecoin for non-resident contractors and 1099 talent.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-teal-600/30 transition flex items-center gap-2 border border-teal-400/20 text-sm">
              <Download className="w-4 h-4" /> Download 1099 / W-8BEN Summary
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
              <span>Total Monthly Payouts</span>
              <DollarSign className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalMonthlyPayout / 1000).toFixed(1)}k USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Tax Compliant Documentation
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Contractor Network</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{contractors.length} Contractors</div>
            <div className="text-teal-400 text-xs mt-2 font-medium">
              Spanning 4 Countries & 3 Continents
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Tax Compliance Status</span>
              <FileCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">100% Verified</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              W-8BEN Forms Active in IRS Vault
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('contractors')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'contractors'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" /> Active Contractors
            </button>
            <button
              onClick={() => setActiveTab('stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'stream'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Real-Time Payout Stream
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search contractor or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'stream' ? (
          <PayoutStreamTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredContractors.map((cntr) => (
              <ContractorPayoutCard
                key={cntr.id}
                contractor={cntr}
                onInspect={() => setSelectedContractorModal(cntr)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedContractorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedContractorModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-4 mb-4">
              <img
                src={selectedContractorModal.avatar}
                alt={selectedContractorModal.name}
                className="w-14 h-14 rounded-full border-2 border-teal-500/40 object-cover"
              />
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {selectedContractorModal.name}
                  <span>{selectedContractorModal.flagEmoji}</span>
                </h3>
                <p className="text-slate-400 text-xs">{selectedContractorModal.title}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Hourly Rate</span>
                <span className="text-white font-bold text-sm">${selectedContractorModal.hourlyRateUSD}/hr</span>
              </div>
              <div>
                <span className="text-slate-500 block">Monthly Billed Hours</span>
                <span className="text-teal-400 font-bold text-sm">{selectedContractorModal.hoursBilledMonthly} hrs</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Invoice Gross</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedContractorModal.monthlyGrossUSD.toLocaleString()} USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tax Documentation</span>
                <span className="text-blue-400 font-bold text-sm">{selectedContractorModal.taxFormStatus}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedContractorModal(null)}
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
