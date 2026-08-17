import React, { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Users, ShieldCheck, Download, Filter, Search, Calendar, FileText, PieChart, Activity, Sparkles, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import PayrollBreakdownCard, { PayrollDepartmentMetric } from '../../components/payroll/PayrollBreakdownCard';
import ExecutiveDisbursementTimeline from '../../components/payroll/ExecutiveDisbursementTimeline';

const DEPARTMENT_METRICS: PayrollDepartmentMetric[] = [
  {
    id: 'dept-101',
    departmentName: 'Engineering & Product Development',
    headcount: 142,
    monthlyGrossUSD: 1850000,
    taxWithholdingsUSD: 462500,
    benefitsContributionUSD: 185000,
    netDisbursementUSD: 1202500,
    growthPercentage: 8.4,
    status: 'DISBURSED',
  },
  {
    id: 'dept-102',
    departmentName: 'Global Sales & Enterprise Accounts',
    headcount: 98,
    monthlyGrossUSD: 1420000,
    taxWithholdingsUSD: 355000,
    benefitsContributionUSD: 142000,
    netDisbursementUSD: 923000,
    growthPercentage: 12.1,
    status: 'DISBURSED',
  },
  {
    id: 'dept-103',
    departmentName: 'Corporate Operations & Legal',
    headcount: 45,
    monthlyGrossUSD: 580000,
    taxWithholdingsUSD: 145000,
    benefitsContributionUSD: 58000,
    netDisbursementUSD: 377000,
    growthPercentage: -2.1,
    status: 'PROCESSING',
  },
  {
    id: 'dept-104',
    departmentName: 'Customer Success & Support Operations',
    headcount: 64,
    monthlyGrossUSD: 610000,
    taxWithholdingsUSD: 152500,
    benefitsContributionUSD: 61000,
    netDisbursementUSD: 396500,
    growthPercentage: 4.5,
    status: 'DISBURSED',
  },
];

export default function EnterprisePayrollDashboardPage() {
  const [metrics, setMetrics] = useState<PayrollDepartmentMetric[]>(DEPARTMENT_METRICS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'compliance'>('overview');
  const [selectedDeptModal, setSelectedDeptModal] = useState<PayrollDepartmentMetric | null>(null);

  const totalGross = metrics.reduce((acc, curr) => acc + curr.monthlyGrossUSD, 0);
  const totalNet = metrics.reduce((acc, curr) => acc + curr.netDisbursementUSD, 0);
  const totalHeadcount = metrics.reduce((acc, curr) => acc + curr.headcount, 0);

  const filteredMetrics = metrics.filter(m => {
    const matchesSearch = m.departmentName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || m.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Executive Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SOC-2 Type II Certified Pipeline
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
              Global Payroll & Financial Analytics
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Real-time audit telemetry, tax withholdings breakdown, multi-department salary disbursements, and automated compliance reporting.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm">
              <Download className="w-4 h-4" /> Export Payroll Audit
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* Top Executive Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Monthly Payroll</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalGross / 1000000).toFixed(2)}M</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> +6.2% from previous cycle
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Net Employee Disbursement</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalNet / 1000000).toFixed(2)}M</div>
            <div className="text-slate-400 text-xs mt-2 font-medium">
              {metrics.filter(m => m.status === 'DISBURSED').length} of {metrics.length} Batches Disbursed
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Active Headcount</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{totalHeadcount}</div>
            <div className="text-indigo-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> +18 New Hires Onboarded
            </div>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <PieChart className="w-4 h-4" /> Department Breakdown
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'timeline'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Disbursement Telemetry
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'timeline' ? (
          <ExecutiveDisbursementTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMetrics.map((dept) => (
              <PayrollBreakdownCard
                key={dept.id}
                metric={dept}
                onInspect={() => setSelectedDeptModal(dept)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedDeptModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <h2 className="text-xl font-bold text-white mb-1">{selectedDeptModal.departmentName}</h2>
            <div className="text-xs text-slate-400 mb-4 font-mono">Department ID: {selectedDeptModal.id}</div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Gross Salary Pool</span>
                <span className="text-white font-bold text-sm">${selectedDeptModal.monthlyGrossUSD.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tax Withholdings</span>
                <span className="text-rose-400 font-bold text-sm">${selectedDeptModal.taxWithholdingsUSD.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Benefits Contribution</span>
                <span className="text-amber-400 font-bold text-sm">${selectedDeptModal.benefitsContributionUSD.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Net Disbursed</span>
                <span className="text-emerald-400 font-bold text-sm">${selectedDeptModal.netDisbursementUSD.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedDeptModal(null)}
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
