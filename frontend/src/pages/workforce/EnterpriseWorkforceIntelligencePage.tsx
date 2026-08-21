/* ═══════════════════════════════════════════════════════════════
   Enterprise Workforce Intelligence & Predictive Analytics Hub
   
   Dashboard with headcount trends, attrition analysis, compensation
   benchmarks, time-to-hire metrics, diversity index, and turnover
   forecasting — 5 tabs, full search/filter, CSV export.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Brain,
  Search,
  Download,
  RefreshCw,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Clock,
  UserMinus,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
  Briefcase,
  Timer,
  Shield,
  Zap,
} from 'lucide-react';

import {
  SEED_HEADCOUNT,
  SEED_ATTRITION,
  SEED_COMPENSATION,
  SEED_ATTRITION_RISK,
  SEED_TTH,
  SEED_DIVERSITY,
  SEED_TURNOVER_TRENDS,
  exportToCsv,
  formatCurrency,
  formatNumber,
  riskColor,
  bandColor,
  trendIcon,
  trendColor,
  categoryColor,
} from '../../services/workforce/workforceService';
import type {
  HeadcountSnapshot,
  AttritionRecord,
  CompensationBenchmark,
  AttritionRiskProfile,
  TimeToHireMetric,
  DiversityMetric,
} from '../../services/workforce/workforceService';
import HeadcountTrendChart from '../../components/workforce/HeadcountTrendChart';
import AttritionRiskHeatmap from '../../components/workforce/AttritionRiskHeatmap';
import CompensationBenchmarks from '../../components/workforce/CompensationBenchmarks';

/* ─────────────────────── Toast Hook ─────────────────────────── */

interface Toast { id: number; message: string; type: 'success' | 'error' | 'warning' | 'info'; }
let toastSeq = 0;
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, []);
  return { toasts, addToast, dismiss };
}

function ToastRenderer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl text-sm font-medium animate-slide-in ${
          t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' :
          t.type === 'error' ? 'bg-red-950/90 border-red-500/30 text-red-300' :
          t.type === 'warning' ? 'bg-amber-950/90 border-amber-500/30 text-amber-300' :
          'bg-slate-800/90 border-slate-700/50 text-slate-200'
        }`}>
          <div className="flex-1">{t.message}</div>
          <button onClick={() => dismiss(t.id)} className="text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Mini Sparkline ─────────────────────────── */

function Sparkline({ data, color = '#10b981', height = 36, width = 120 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-slate-800/50 rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={((data.length - 1) / (data.length - 1)) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
}

/* ─────────────────── Attrition Detail Modal ─────────────────── */

function AttritionDetailModal({ record, onClose }: { record: AttritionRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">{record.employeeName}</h2>
            <p className="text-xs text-slate-400">{record.role} · {record.department}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Category</div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${categoryColor(record.category)}`}>{record.category}</span>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Risk Score</div>
            <div className={`text-lg font-black font-mono ${record.riskScore >= 80 ? 'text-red-400' : record.riskScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{record.riskScore}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Tenure</div>
            <div className="text-xs text-white font-semibold">{record.tenure}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Engagement</div>
            <div className={`text-lg font-black font-mono ${record.lastEngagementScore >= 4 ? 'text-emerald-400' : record.lastEngagementScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{record.lastEngagementScore.toFixed(1)}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Exit Date</div>
            <div className="text-xs text-white font-mono">{record.exitDate}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Replacement Cost</div>
            <div className="text-sm font-black font-mono text-red-400">{formatCurrency(record.replacementCost)}</div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 mb-4">
          <div className="text-[10px] text-slate-500 uppercase mb-1">Exit Reason</div>
          <p className="text-xs text-slate-300 leading-relaxed">{record.exitReason}</p>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Risk Detail Modal ─────────────────── */

function RiskDetailModal({ profile, onClose }: { profile: AttritionRiskProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-bold text-white">{profile.department}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${riskColor(profile.overallRisk)}`}>{profile.overallRisk} RISK</span>
          <span className="text-sm font-black font-mono text-white">{profile.predictedAttrition}% predicted attrition</span>
        </div>
        {profile.retentionActions.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Recommended Retention Actions</h4>
            <div className="space-y-1.5">
              {profile.retentionActions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-300">{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function EnterpriseWorkforceIntelligencePage() {
  const { toasts, addToast, dismiss } = useToasts();
  const [activeTab, setActiveTab] = useState<'overview' | 'attrition' | 'compensation' | 'hiring' | 'diversity'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskModal, setRiskModal] = useState<AttritionRiskProfile | null>(null);
  const [attritionModal, setAttritionModal] = useState<AttritionRecord | null>(null);
  const [attritionFilter, setAttritionFilter] = useState<string>('ALL');

  /* ───── Derived KPIs ───── */
  const latestHC = SEED_HEADCOUNT[SEED_HEADCOUNT.length - 1];
  const earliestHC = SEED_HEADCOUNT[0];
  const hcGrowth = latestHC.total - earliestHC.total;
  const hcGrowthPct = Math.round((hcGrowth / earliestHC.total) * 100);
  const totalTurnover = SEED_TURNOVER_TRENDS[SEED_TURNOVER_TRENDS.length - 1].totalRate;
  const avgReplacementCost = Math.round(SEED_ATTRITION.reduce((a, r) => a + r.replacementCost, 0) / SEED_ATTRITION.length);
  const criticalRiskDepts = SEED_ATTRITION_RISK.filter((r) => r.overallRisk === 'CRITICAL' || r.overallRisk === 'HIGH').length;
  const avgTTH = Math.round(SEED_TTH.reduce((a, t) => a + t.avgDays, 0) / SEED_TTH.length);
  const belowMarketRoles = SEED_COMPENSATION.filter((c) => c.band === 'BELOW_MARKET').length;
  const avgDiversity = Math.round(SEED_DIVERSITY.reduce((a, d) => a + d.overallScore, 0) / SEED_DIVERSITY.length);

  const turnoverSparkline = SEED_TURNOVER_TRENDS.map((t) => t.totalRate);

  /* ───── Filters ───── */
  const filteredAttrition = useMemo(() => {
    let list = [...SEED_ATTRITION];
    if (attritionFilter !== 'ALL') list = list.filter((r) => r.category === attritionFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.employeeName.toLowerCase().includes(q) || r.department.toLowerCase().includes(q) || r.role.toLowerCase().includes(q) || r.exitReason.toLowerCase().includes(q));
    }
    return list;
  }, [attritionFilter, searchQuery]);

  const filteredTTH = useMemo(() => {
    if (!searchQuery) return SEED_TTH;
    const q = searchQuery.toLowerCase();
    return SEED_TTH.filter((t) => t.department.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredDiversity = useMemo(() => {
    if (!searchQuery) return SEED_DIVERSITY;
    const q = searchQuery.toLowerCase();
    return SEED_DIVERSITY.filter((d) => d.department.toLowerCase().includes(q));
  }, [searchQuery]);

  /* ───── Exports ───── */
  const handleExportAttrition = () => {
    exportToCsv(filteredAttrition.map((r) => ({
      name: r.employeeName, department: r.department, role: r.role, tenure: r.tenure, category: r.category,
      exitDate: r.exitDate, riskScore: r.riskScore, engagement: r.lastEngagementScore,
      replacementCost: r.replacementCost, exitReason: r.exitReason,
    })), 'attrition-report.csv');
    addToast('Attrition report exported', 'success');
  };

  const handleExportTTH = () => {
    exportToCsv(filteredTTH.map((t) => ({
      department: t.department, avgDays: t.avgDays, medianDays: t.medianDays, p90Days: t.p90Days,
      openRoles: t.openRoles, filledLast30d: t.filledLast30d,
    })), 'time-to-hire.csv');
    addToast('Time-to-hire report exported', 'success');
  };

  /* ───── Tabs ───── */
  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'attrition' as const, label: 'Attrition', icon: UserMinus, count: filteredAttrition.length },
    { key: 'compensation' as const, label: 'Compensation', icon: DollarSign, count: `${belowMarketRoles} below` },
    { key: 'hiring' as const, label: 'Hiring Speed', icon: Timer, count: `${avgTTH}d avg` },
    { key: 'diversity' as const, label: 'Diversity', icon: Shield, count: `${avgDiversity}/100` },
  ];

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <ToastRenderer toasts={toasts} dismiss={dismiss} />

      {/* ──── Executive Header ──── */}
      <header className="max-w-[1400px] mx-auto mb-8 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> PaySphere Workforce Intelligence
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30">
                {formatNumber(latestHC.total)} employees
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              Workforce Intelligence & Predictive Analytics Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              Headcount trends, attrition risk modeling, compensation benchmarking, time-to-hire analytics, diversity metrics, and turnover forecasting across {SEED_HEADCOUNT[SEED_HEADCOUNT.length - 1].total} employees.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => addToast('Workforce data refreshed', 'success')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-slate-700">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto space-y-6">
        {/* ──── KPI Cards ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Headcount', value: formatNumber(latestHC.total), sub: `+${hcGrowth} (${hcGrowthPct}%)`, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', trend: 'UP' as const, trendVal: `+${hcGrowth}` },
            { label: 'Turnover', value: `${totalTurnover}%`, sub: 'Monthly total', icon: UserMinus, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', trend: 'DOWN' as const, trendVal: '-0.4%' },
            { label: 'Avg Replace', value: formatCurrency(avgReplacementCost), sub: 'Per departure', icon: DollarSign, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', trend: 'DOWN' as const, trendVal: '-$2.1K' },
            { label: 'At Risk', value: String(criticalRiskDepts), sub: 'Critical/High depts', icon: Flame, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', trend: 'DOWN' as const, trendVal: '-1' },
            { label: 'Time-to-Hire', value: `${avgTTH}d`, sub: 'Company average', icon: Timer, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', trend: 'DOWN' as const, trendVal: '-3d' },
            { label: 'Diversity', value: `${avgDiversity}`, sub: 'Out of 100', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', trend: 'UP' as const, trendVal: '+4' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} border rounded-2xl p-4 backdrop-blur-md`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[11px] font-medium ${kpi.trend === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kpi.trend === 'UP' ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}{kpi.trendVal}
                </span>
                <span className={`${kpi.color} text-[11px] font-medium`}>{kpi.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ──── Turnover Trend Mini ──── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">6-Month Turnover Trend</div>
              <div className="text-[11px] text-slate-400">Voluntary + involuntary vs industry average</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Sparkline data={turnoverSparkline} color="#f97316" height={40} width={200} />
            <div className="text-right">
              <div className="text-lg font-black text-orange-400 font-mono">{totalTurnover}%</div>
              <div className="text-[10px] text-emerald-400/70">↓ below industry {SEED_TURNOVER_TRENDS[SEED_TURNOVER_TRENDS.length - 1].industryAvg}%</div>
            </div>
          </div>
        </div>

        {/* ──── Tab Navigation ──── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.key ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
                {tab.count && <span className="text-[10px] opacity-70">{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === 'attrition' && (
              <select value={attritionFilter} onChange={(e) => setAttritionFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs px-3 py-2.5 focus:outline-none focus:border-indigo-500">
                <option value="ALL">All Types</option>
                <option value="VOLUNTARY">Voluntary</option>
                <option value="INVOLUNTARY">Involuntary</option>
                <option value="RETIREMENT">Retirement</option>
                <option value="INTERNAL">Internal Transfer</option>
              </select>
            )}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition" />
            </div>
            {activeTab === 'attrition' && (
              <button onClick={handleExportAttrition} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
            {activeTab === 'hiring' && (
              <button onClick={handleExportTTH} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════ TAB: OVERVIEW ═══════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <HeadcountTrendChart data={SEED_HEADCOUNT} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Turnover Breakdown */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-orange-400" /> Turnover Breakdown</h3>
                <div className="space-y-3">
                  {SEED_TURNOVER_TRENDS.slice().reverse().map((t) => (
                    <div key={t.month} className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-mono w-12">{t.month.split('-')[1]}</span>
                      <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-orange-500/60 transition-all" style={{ width: `${(t.voluntaryRate / 4) * 100}%` }} />
                        <div className="h-full bg-red-500/40 transition-all" style={{ width: `${(t.involuntaryRate / 4) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-white font-mono w-10 text-right">{t.totalRate}%</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500/60" /> Voluntary</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/40" /> Involuntary</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-500/40" /> Industry Avg</span>
                </div>
              </div>

              {/* Top Departures */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><UserMinus className="w-4 h-4 text-red-400" /> Recent Departures</h3>
                <div className="space-y-2">
                  {SEED_ATTRITION.slice(0, 5).map((r) => (
                    <div key={r.id} onClick={() => setAttritionModal(r)} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 transition cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {r.employeeName.split(' ').map((w) => w[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{r.employeeName}</div>
                        <div className="text-[10px] text-slate-500">{r.role} · {r.department}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[10px] font-bold ${r.riskScore >= 80 ? 'text-red-400' : r.riskScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>Risk: {r.riskScore}</div>
                        <div className="text-[9px] text-slate-600">{r.exitDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <AttritionRiskHeatmap data={SEED_ATTRITION_RISK} onRowClick={(d) => setRiskModal(d)} />
          </div>
        )}

        {/* ═══════════════════════ TAB: ATTRITION ═══════════════════════ */}
        {activeTab === 'attrition' && (
          <div className="space-y-4">
            {filteredAttrition.length === 0 && (
              <div className="text-center py-16 text-slate-500"><UserMinus className="w-12 h-12 mx-auto mb-3 opacity-50" /><p className="text-sm">No records match your filter.</p></div>
            )}
            {filteredAttrition.map((record) => (
              <div key={record.id} onClick={() => setAttritionModal(record)} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <UserMinus className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-sm font-bold text-white">{record.employeeName}</span>
                      <span className="text-[10px] text-slate-500">{record.role}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${categoryColor(record.category)}`}>{record.category}</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 ml-7">{record.exitReason}</p>
                    <div className="flex items-center gap-4 mt-2 ml-7 text-[11px] text-slate-500">
                      <span>{record.department}</span>
                      <span>Tenure: {record.tenure}</span>
                      <span>Engagement: <span className={`font-mono ${record.lastEngagementScore >= 4 ? 'text-emerald-400' : record.lastEngagementScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{record.lastEngagementScore.toFixed(1)}</span></span>
                      <span>{record.exitDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase">Risk</div>
                      <div className={`text-lg font-black font-mono ${record.riskScore >= 80 ? 'text-red-400' : record.riskScore >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{record.riskScore}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase">Cost</div>
                      <div className="text-sm font-black font-mono text-red-400">{formatCurrency(record.replacementCost)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: COMPENSATION ═══════════════════════ */}
        {activeTab === 'compensation' && (
          <div className="space-y-6">
            <CompensationBenchmarks data={SEED_COMPENSATION} onExport={() => {
              exportToCsv(SEED_COMPENSATION.map((c) => ({
                role: c.role, department: c.department, p25: c.p25, p50: c.p50, p75: c.p75, p90: c.p90,
                currentAvg: c.currentAvg, band: c.band, headcount: c.headcount, budgetImpact: c.budgetImpact,
              })), 'compensation-benchmarks.csv');
              addToast('Compensation benchmarks exported', 'success');
            }} />
          </div>
        )}

        {/* ═══════════════════════ TAB: HIRING ═══════════════════════ */}
        {activeTab === 'hiring' && (
          <div className="space-y-4">
            {filteredTTH.map((t) => (
              <div key={t.department} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Timer className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-bold text-white">{t.department}</span>
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trendColor(t.trend)}`}>
                      {trendIcon(t.trend)} {t.trend}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-bold px-2 py-0.5 rounded border border-cyan-500/30">
                      {t.openRoles} open
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                      {t.filledLast30d} filled
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Avg</div>
                    <div className={`text-lg font-black font-mono ${t.avgDays <= 35 ? 'text-emerald-400' : t.avgDays <= 45 ? 'text-amber-400' : 'text-red-400'}`}>{t.avgDays}d</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Median</div>
                    <div className="text-lg font-black font-mono text-white">{t.medianDays}d</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">P90</div>
                    <div className="text-lg font-black font-mono text-slate-300">{t.p90Days}d</div>
                  </div>
                </div>
                {/* TTH Bar */}
                <div className="mt-3 relative h-2 bg-slate-800 rounded-full">
                  <div className="absolute h-full rounded-full bg-cyan-500/40" style={{ width: `${(t.avgDays / 80) * 100}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-cyan-400" style={{ left: `${(t.avgDays / 80) * 100}%`, transform: 'translate(-50%, -50%)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: DIVERSITY ═══════════════════════ */}
        {activeTab === 'diversity' && (
          <div className="space-y-4">
            {filteredDiversity.map((d) => (
              <div key={d.department} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">{d.department}</span>
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trendColor(d.trend)}`}>
                      {trendIcon(d.trend)} {d.trend}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black font-mono text-white">{d.overallScore}</div>
                    <div className="text-[9px] text-slate-500">/ 100</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Gender Parity', value: d.genderParity, icon: Users },
                    { label: 'Ethnicity', value: d.ethnicityIndex, icon: Globe },
                    { label: 'Age Diversity', value: d.ageDiversity, icon: Clock },
                    { label: 'Leadership', value: d.leadershipParity, icon: Target },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                      <div className="text-[9px] text-slate-500 uppercase mb-1">{m.label}</div>
                      <div className="text-xs font-black font-mono text-white">{Math.round(m.value * 100)}%</div>
                      <div className="h-1 bg-slate-700 rounded-full mt-1.5">
                        <div
                          className={`h-full rounded-full ${m.value >= 0.7 ? 'bg-emerald-500' : m.value >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${m.value * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ──── Modals ──── */}
      {attritionModal && <AttritionDetailModal record={attritionModal} onClose={() => setAttritionModal(null)} />}
      {riskModal && <RiskDetailModal profile={riskModal} onClose={() => setRiskModal(null)} />}
    </div>
  );
}
