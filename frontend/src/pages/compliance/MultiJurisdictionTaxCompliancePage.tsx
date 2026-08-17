import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, AlertTriangle, Download, Search, Filter, Sparkles, Building2, Globe, Clock, Layers, Activity } from 'lucide-react';
import JurisdictionTaxCard, { TaxJurisdiction } from '../../components/compliance/JurisdictionTaxCard';
import ComplianceAuditTimeline from '../../components/compliance/ComplianceAuditTimeline';

const JURISDICTIONS: TaxJurisdiction[] = [
  {
    id: 'juris-01',
    countryName: 'United States',
    regionName: 'Federal & State (50 States)',
    flagEmoji: '🇺🇸',
    corporateTaxRate: 21.0,
    payrollTaxRate: 15.3,
    filingStatus: 'COMPLIANT',
    nextFilingDeadline: '2026-09-15',
    activeEmployees: 384,
    totalTaxesRemittedUSD: 2450000,
  },
  {
    id: 'juris-02',
    countryName: 'United Kingdom',
    regionName: 'HMRC Pay As You Earn (PAYE)',
    flagEmoji: '🇬🇧',
    corporateTaxRate: 25.0,
    payrollTaxRate: 13.8,
    filingStatus: 'COMPLIANT',
    nextFilingDeadline: '2026-09-19',
    activeEmployees: 112,
    totalTaxesRemittedUSD: 890000,
  },
  {
    id: 'juris-03',
    countryName: 'Germany',
    regionName: 'Bundeszentralamt für Steuern',
    flagEmoji: '🇩🇪',
    corporateTaxRate: 29.9,
    payrollTaxRate: 19.8,
    filingStatus: 'PENDING_REVIEW',
    nextFilingDeadline: '2026-08-31',
    activeEmployees: 64,
    totalTaxesRemittedUSD: 620000,
  },
  {
    id: 'juris-04',
    countryName: 'Singapore',
    regionName: 'Inland Revenue Authority (IRAS)',
    flagEmoji: '🇸🇬',
    corporateTaxRate: 17.0,
    payrollTaxRate: 17.0,
    filingStatus: 'COMPLIANT',
    nextFilingDeadline: '2026-09-30',
    activeEmployees: 95,
    totalTaxesRemittedUSD: 510000,
  },
];

export default function MultiJurisdictionTaxCompliancePage() {
  const [jurisdictions, setJurisdictions] = useState<TaxJurisdiction[]>(JURISDICTIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'jurisdictions' | 'audit-trail'>('jurisdictions');
  const [selectedJurisdictModal, setSelectedJurisdictModal] = useState<TaxJurisdiction | null>(null);

  const totalTaxesRemitted = jurisdictions.reduce((acc, j) => acc + j.totalTaxesRemittedUSD, 0);

  const filteredJurisdictions = jurisdictions.filter(j =>
    j.countryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    j.regionName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-rose-950 via-slate-900 to-purple-950 border border-rose-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-rose-500/20 text-rose-300 text-xs px-3 py-1 rounded-full font-semibold border border-rose-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Global Tax Hub
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Automated IRS / HMRC Filings
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-rose-200 bg-clip-text text-transparent">
              Multi-Jurisdiction Tax & Compliance Engine
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Cross-border payroll tax calculation, withholding schedules, statutory deadline tracking, and regulatory audit readiness across international entities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-rose-600/30 transition flex items-center gap-2 border border-rose-400/20 text-sm">
              <Download className="w-4 h-4" /> Download Filing Audit Pack
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
              <span>YTD Remitted Tax Volume</span>
              <Building2 className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalTaxesRemitted / 1000000).toFixed(2)}M USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> All Statutory Remittances On Schedule
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Tax Regions</span>
              <Globe className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{jurisdictions.length} Regions</div>
            <div className="text-purple-400 text-xs mt-2 font-medium">
              US, UK, DE, SG Compliance Active
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Compliance Health Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">99.8%</div>
            <div className="text-emerald-400 text-xs mt-2 font-medium">
              Zero Outstanding Penalty Flags
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('jurisdictions')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'jurisdictions'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Globe className="w-4 h-4" /> Tax Jurisdictions
            </button>
            <button
              onClick={() => setActiveTab('audit-trail')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'audit-trail'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Statutory Audit Stream
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search country or authority..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Body */}
        {activeTab === 'audit-trail' ? (
          <ComplianceAuditTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredJurisdictions.map((juris) => (
              <JurisdictionTaxCard
                key={juris.id}
                jurisdiction={juris}
                onInspect={() => setSelectedJurisdictModal(juris)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedJurisdictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedJurisdictModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{selectedJurisdictModal.flagEmoji}</span>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedJurisdictModal.countryName}</h2>
                <div className="text-xs text-slate-400 font-mono">{selectedJurisdictModal.regionName}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Corporate Statutory Tax</span>
                <span className="text-white font-bold text-sm">{selectedJurisdictModal.corporateTaxRate}%</span>
              </div>
              <div>
                <span className="text-slate-500 block">Employer Payroll Tax</span>
                <span className="text-rose-400 font-bold text-sm">{selectedJurisdictModal.payrollTaxRate}%</span>
              </div>
              <div>
                <span className="text-slate-500 block">Next Filing Deadline</span>
                <span className="text-amber-400 font-bold text-sm">{selectedJurisdictModal.nextFilingDeadline}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Active Covered Employees</span>
                <span className="text-emerald-400 font-bold text-sm">{selectedJurisdictModal.activeEmployees} Staff</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedJurisdictModal(null)}
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
