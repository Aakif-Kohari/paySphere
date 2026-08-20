import React, { useState } from 'react';
import { TrendingUp, DollarSign, Download, Search, Sparkles, CheckCircle2, Clock, Globe, ArrowUpRight, BarChart3, PieChart, ShieldCheck, Activity, Cpu } from 'lucide-react';
import ForecastModelCard, { PayrollForecastModel } from '../../components/analytics/ForecastModelCard';
import PayrollAnalyticsTimeline from '../../components/analytics/PayrollAnalyticsTimeline';

const FORECAST_MODELS: PayrollForecastModel[] = [
  {
    id: 'fc-501',
    modelTitle: 'Q4 2026 Global Headcount Expansion',
    departmentScope: 'Engineering & Product',
    projectedQuarterlySpendUSD: 4250000,
    varianceFromBudgetPercent: 2.4,
    headcountDelta: 25,
    confidenceScorePercent: 96.5,
    scenarioType: 'Growth Expansion',
    status: 'ACTIVE_SIMULATION',
  },
  {
    id: 'fc-502',
    modelTitle: '2027 International Statutory Tax Rate Shift',
    departmentScope: 'All Jurisdictions (US, UK, EU, JP)',
    projectedQuarterlySpendUSD: 12800000,
    varianceFromBudgetPercent: -1.2,
    headcountDelta: 0,
    confidenceScorePercent: 98.0,
    scenarioType: 'Regulatory Compliance',
    status: 'ACTIVE_SIMULATION',
  },
  {
    id: 'fc-503',
    modelTitle: 'Annual Executive Equity & Merit Bonus Pool',
    departmentScope: 'Executive Leadership',
    projectedQuarterlySpendUSD: 1850000,
    varianceFromBudgetPercent: 0.8,
    headcountDelta: 2,
    confidenceScorePercent: 94.0,
    scenarioType: 'Compensation Adjustment',
    status: 'COMMITTED',
  },
];

export default function EnterprisePayrollAnalyticsPage() {
  const [models, setModels] = useState<PayrollForecastModel[]>(FORECAST_MODELS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'forecasts' | 'analytics-stream'>('forecasts');
  const [selectedModelModal, setSelectedModelModal] = useState<PayrollForecastModel | null>(null);

  const totalProjectedRunRateUSD = models.reduce((acc, m) => acc + m.projectedQuarterlySpendUSD, 0);

  const filteredModels = models.filter(m =>
    m.modelTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.departmentScope.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.scenarioType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Header Banner */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> PaySphere Predictive AI Engine
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Monte Carlo Simulation Engine
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-200 bg-clip-text text-transparent">
              Enterprise Payroll Forecasting & Predictive Analytics
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Real-time headcount spend projections, Monte Carlo budget variance simulations, statutory tax escalation models, and executive compensation analytics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 border border-emerald-400/20 text-sm">
              <Download className="w-4 h-4" /> Export Analytics Forecast
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
              <span>Total Projected Run-Rate</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">${(totalProjectedRunRateUSD / 1000000).toFixed(2)}M USD</div>
            <div className="text-emerald-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 97.2% Model Accuracy Confidence
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Budget Variance Delta</span>
              <TrendingUp className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">+1.2% Target</div>
            <div className="text-teal-400 text-xs mt-2 font-medium">
              Within Board Operating Budget Limits
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Simulated Headcount Addition</span>
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">+27 New Roles</div>
            <div className="text-indigo-400 text-xs mt-2 font-medium">
              Modeled Across Q4 2026 - Q1 2027
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('forecasts')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'forecasts'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Predictive Models
            </button>
            <button
              onClick={() => setActiveTab('analytics-stream')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'analytics-stream'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Live Monte Carlo Stream
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search forecast model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tab Body */}
        {activeTab === 'analytics-stream' ? (
          <PayrollAnalyticsTimeline />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredModels.map((model) => (
              <ForecastModelCard
                key={model.id}
                model={model}
                onInspect={() => setSelectedModelModal(model)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal View */}
      {selectedModelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedModelModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedModelModal.modelTitle}</h3>
                <div className="text-xs text-slate-400 font-mono">{selectedModelModal.departmentScope}</div>
              </div>
              <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded font-mono text-xs font-bold border border-emerald-500/30">
                {selectedModelModal.scenarioType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Projected Quarterly Spend</span>
                <span className="text-emerald-400 font-bold text-sm">${(selectedModelModal.projectedQuarterlySpendUSD / 1000000).toFixed(2)}M USD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Model Confidence Score</span>
                <span className="text-cyan-400 font-bold text-sm">{selectedModelModal.confidenceScorePercent}%</span>
              </div>
              <div>
                <span className="text-slate-500 block">Headcount Addition</span>
                <span className="text-amber-400 font-bold text-sm">+{selectedModelModal.headcountDelta} Staff</span>
              </div>
              <div>
                <span className="text-slate-500 block">Variance from Budget</span>
                <span className="text-white font-bold text-sm">+{selectedModelModal.varianceFromBudgetPercent}%</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedModelModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Simulation View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
