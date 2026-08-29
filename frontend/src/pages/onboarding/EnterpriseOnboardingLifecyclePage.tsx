/* ═══════════════════════════════════════════════════════════════
   Enterprise Onboarding Lifecycle Intelligence Hub
   
   Full-featured dashboard with onboarding pipeline, conversion
   funnel, milestone tracking, buddy program metrics, department
   breakdown, and new hire risk assessment.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Rocket, Search, Download, RefreshCw, Users, TrendingUp, TrendingDown,
  BarChart3, Target, AlertTriangle, CheckCircle2, Clock, UserCheck,
  ArrowUpRight, ArrowDownRight, X, Filter, Star, Briefcase, Award,
  Heart, Building2,
} from 'lucide-react';

import {
  SEED_NEW_HIRES, SEED_MILESTONES, SEED_DEPT_ONBOARDING, SEED_TTP,
  SEED_BUDDY_METRICS, SEED_FUNNEL,
  statusColor, riskColor, categoryColor, exportToCsv, formatNumber,
} from '../../services/onboarding/onboardingService';
import type { NewHire, DepartmentOnboarding } from '../../services/onboarding/onboardingService';
import OnboardingPipeline from '../../components/onboarding/OnboardingPipeline';
import OnboardingFunnel from '../../components/onboarding/OnboardingFunnel';
import HireDetailModal from '../../components/onboarding/HireDetailModal';

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

/* ─────────────────── Department Detail Modal ─────────────────── */

function DeptDetailModal({ dept, onClose }: { dept: DepartmentOnboarding; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-bold text-white">{dept.department}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Avg Time-to-Productivity</div>
            <div className={`text-2xl font-black font-mono ${dept.avgTimeToProductivity <= 55 ? 'text-emerald-400' : dept.avgTimeToProductivity <= 70 ? 'text-amber-400' : 'text-red-400'}`}>{dept.avgTimeToProductivity}d</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Completion Rate</div>
            <div className={`text-2xl font-black font-mono ${dept.avgCompletionRate >= 90 ? 'text-emerald-400' : dept.avgCompletionRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{dept.avgCompletionRate}%</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Avg NPS Score</div>
            <div className={`text-2xl font-black font-mono ${dept.avgNPSScore >= 7.5 ? 'text-emerald-400' : dept.avgNPSScore >= 5.5 ? 'text-amber-400' : 'text-red-400'}`}>{dept.avgNPSScore.toFixed(1)}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Buddy Participation</div>
            <div className={`text-2xl font-black font-mono ${dept.buddyProgramParticipation >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>{dept.buddyProgramParticipation}%</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Completed</div>
            <div className="text-lg font-black font-mono text-emerald-400">{dept.completedThisQuarter}</div>
          </div>
          <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Dropped</div>
            <div className="text-lg font-black font-mono text-red-400">{dept.droppedThisQuarter}</div>
          </div>
          <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/10 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Current Cohort</div>
            <div className="text-lg font-black font-mono text-blue-400">{dept.currentCohortSize}</div>
          </div>
        </div>
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

export default function EnterpriseOnboardingLifecyclePage() {
  const { toasts, addToast, dismiss } = useToasts();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'funnel' | 'milestones' | 'departments' | 'buddies'>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [hireModal, setHireModal] = useState<NewHire | null>(null);
  const [deptModal, setDeptModal] = useState<DepartmentOnboarding | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  /* ───── Derived KPIs ───── */
  const totalCohort = SEED_NEW_HIRES.length;
  const completedHires = SEED_NEW_HIRES.filter((h) => h.status === 'COMPLETED').length;
  const droppedHires = SEED_NEW_HIRES.filter((h) => h.status === 'DROPPED').length;
  const atRiskHires = SEED_NEW_HIRES.filter((h) => h.riskLevel !== 'LOW').length;
  const avgCompletion = Math.round(SEED_NEW_HIRES.reduce((a, h) => a + h.completionPct, 0) / totalCohort);
  const avgNPS = (SEED_NEW_HIRES.filter((h) => h.npsScore !== null).reduce((a, h) => a + (h.npsScore ?? 0), 0) / SEED_NEW_HIRES.filter((h) => h.npsScore !== null).length).toFixed(1);
  const avgTTP = Math.round(SEED_DEPT_ONBOARDING.reduce((a, d) => a + d.avgTimeToProductivity, 0) / SEED_DEPT_ONBOARDING.length);
  const overallConversion = SEED_FUNNEL[SEED_FUNNEL.length - 1].conversionRate;

  /* ───── Filters ───── */
  const filteredHires = useMemo(() => {
    let list = [...SEED_NEW_HIRES];
    if (statusFilter !== 'ALL') list = list.filter((h) => h.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q) || h.role.toLowerCase().includes(q) || h.department.toLowerCase().includes(q) || h.location.toLowerCase().includes(q));
    }
    return list;
  }, [statusFilter, searchQuery]);

  const filteredBuddies = useMemo(() => {
    if (!searchQuery) return SEED_BUDDY_METRICS;
    const q = searchQuery.toLowerCase();
    return SEED_BUDDY_METRICS.filter((b) => b.buddyName.toLowerCase().includes(q) || b.department.toLowerCase().includes(q));
  }, [searchQuery]);

  /* ───── Exports ───── */
  const handleExportHires = () => {
    exportToCsv(filteredHires.map((h) => ({
      name: h.name, role: h.role, department: h.department, manager: h.manager, buddy: h.buddy ?? 'Unassigned',
      startDate: h.startDate, status: h.status, completionPct: h.completionPct, riskLevel: h.riskLevel,
      npsScore: h.npsScore ?? 'N/A', location: h.location, employmentType: h.employmentType,
    })), 'onboarding-hires.csv');
    addToast('New hire data exported', 'success');
  };

  const handleExportDepts = () => {
    exportToCsv(SEED_DEPT_ONBOARDING.map((d) => ({
      department: d.department, avgTimeToProductivity: d.avgTimeToProductivity,
      avgCompletionRate: d.avgCompletionRate, avgNPSScore: d.avgNPSScore,
      currentCohortSize: d.currentCohortSize, completedThisQuarter: d.completedThisQuarter,
      droppedThisQuarter: d.droppedThisQuarter, buddyParticipation: d.buddyProgramParticipation,
    })), 'onboarding-departments.csv');
    addToast('Department onboarding data exported', 'success');
  };

  /* ───── Tabs ───── */
  const tabs = [
    { key: 'pipeline' as const, label: 'Pipeline', icon: Rocket, count: filteredHires.length },
    { key: 'funnel' as const, label: 'Funnel', icon: Filter, count: `${overallConversion}%` },
    { key: 'milestones' as const, label: 'Milestones', icon: Target, count: SEED_MILESTONES.length },
    { key: 'departments' as const, label: 'Departments', icon: Building2, count: SEED_DEPT_ONBOARDING.length },
    { key: 'buddies' as const, label: 'Buddy Program', icon: Users, count: SEED_BUDDY_METRICS.length },
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
                <Rocket className="w-3.5 h-3.5" /> PaySphere People Operations
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30">
                {totalCohort} active hires
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              Employee Onboarding Lifecycle Intelligence Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              End-to-end onboarding pipeline, conversion funnel, milestone tracking, buddy program analytics, department benchmarks, and new hire risk assessment.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => addToast('Onboarding data refreshed', 'success')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-slate-700">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto space-y-6">
        {/* ──── KPI Cards ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Active Cohort', value: String(totalCohort), sub: 'New hires', icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
            { label: 'Completed', value: String(completedHires), sub: `${Math.round((completedHires / totalCohort) * 100)}% rate`, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Dropped', value: String(droppedHires), sub: `${Math.round((droppedHires / totalCohort) * 100)}% attrition`, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { label: 'At Risk', value: String(atRiskHires), sub: 'Need attention', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Avg Completion', value: `${avgCompletion}%`, sub: 'All hires', icon: BarChart3, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
            { label: 'Onboarding NPS', value: avgNPS, sub: 'Out of 10', icon: Star, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} border rounded-2xl p-4 backdrop-blur-md`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpi.value}</div>
              <div className={`${kpi.color} text-[11px] mt-1 font-medium`}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ──── Tab Navigation ──── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.key ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
                <span className="text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === 'pipeline' && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs px-3 py-2.5 focus:outline-none focus:border-indigo-500">
                <option value="ALL">All Stages</option>
                <option value="PRE_BOARDING">Pre-boarding</option>
                <option value="DAY_ONE">Day 1</option>
                <option value="WEEK_1">Week 1</option>
                <option value="MONTH_1">Month 1</option>
                <option value="MONTH_3">Month 3</option>
                <option value="COMPLETED">Completed</option>
                <option value="DROPPED">Dropped</option>
              </select>
            )}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition" />
            </div>
            {activeTab === 'pipeline' && (
              <button onClick={handleExportHires} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
            {activeTab === 'departments' && (
              <button onClick={handleExportDepts} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════ TAB: PIPELINE ═══════════════════════ */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <OnboardingPipeline hires={filteredHires} onHireClick={(h) => setHireModal(h)} />
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> At-Risk Hires</h3>
                <div className="space-y-2">
                  {SEED_NEW_HIRES.filter((h) => h.riskLevel !== 'LOW').map((h) => (
                    <div key={h.id} onClick={() => setHireModal(h)} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                        {h.name.split(' ').map((w) => w[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">{h.name}</div>
                        <div className="text-[9px] text-slate-500 truncate">{h.riskFactors[0]}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${riskColor(h.riskLevel)}`}>{h.riskLevel}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-violet-400" /> Top NPS Scores</h3>
                <div className="space-y-2">
                  {SEED_NEW_HIRES.filter((h) => h.npsScore !== null).sort((a, b) => (b.npsScore ?? 0) - (a.npsScore ?? 0)).slice(0, 5).map((h) => (
                    <div key={h.id} onClick={() => setHireModal(h)} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/30 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                        {h.name.split(' ').map((w) => w[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-white truncate">{h.name}</div>
                        <div className="text-[9px] text-slate-500">{h.role}</div>
                      </div>
                      <span className={`text-sm font-black font-mono ${(h.npsScore ?? 0) >= 8 ? 'text-emerald-400' : (h.npsScore ?? 0) >= 6 ? 'text-amber-400' : 'text-red-400'}`}>{h.npsScore}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ TAB: FUNNEL ═══════════════════════ */}
        {activeTab === 'funnel' && (
          <div className="space-y-6">
            <OnboardingFunnel stages={SEED_FUNNEL} />
          </div>
        )}

        {/* ═══════════════════════ TAB: MILESTONES ═══════════════════════ */}
        {activeTab === 'milestones' && (
          <div className="space-y-4">
            {SEED_MILESTONES.map((ms) => {
              const gap = ms.targetCompletionPct - ms.actualCompletionPct;
              return (
                <div key={ms.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-white">{ms.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${categoryColor(ms.category)}`}>{ms.category}</span>
                      <span className="text-[10px] text-slate-500 font-mono">Day {ms.dayNumber}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${ms.actualCompletionPct >= ms.targetCompletionPct ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {ms.actualCompletionPct}% / {ms.targetCompletionPct}% target
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
                    {/* Target line */}
                    <div className="absolute h-full w-0.5 bg-white/30" style={{ left: `${ms.targetCompletionPct}%` }} />
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${ms.actualCompletionPct >= ms.targetCompletionPct ? 'bg-emerald-500' : ms.actualCompletionPct >= ms.targetCompletionPct * 0.8 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${ms.actualCompletionPct}%` }}
                    />
                  </div>
                  {gap > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> {gap}pp below target
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════ TAB: DEPARTMENTS ═══════════════════════ */}
        {activeTab === 'departments' && (
          <div className="space-y-4">
            {SEED_DEPT_ONBOARDING.map((d) => (
              <div key={d.department} onClick={() => setDeptModal(d)} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-white">{d.department}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${riskColor(d.riskLevel)}`}>{d.riskLevel}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">TTP</div>
                    <div className={`text-sm font-black font-mono ${d.avgTimeToProductivity <= 55 ? 'text-emerald-400' : d.avgTimeToProductivity <= 70 ? 'text-amber-400' : 'text-red-400'}`}>{d.avgTimeToProductivity}d</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Completion</div>
                    <div className={`text-sm font-black font-mono ${d.avgCompletionRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>{d.avgCompletionRate}%</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">NPS</div>
                    <div className={`text-sm font-black font-mono ${d.avgNPSScore >= 7.5 ? 'text-emerald-400' : 'text-amber-400'}`}>{d.avgNPSScore.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Completed</div>
                    <div className="text-sm font-black font-mono text-emerald-400">{d.completedThisQuarter}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Dropped</div>
                    <div className={`text-sm font-black font-mono ${d.droppedThisQuarter > 0 ? 'text-red-400' : 'text-slate-500'}`}>{d.droppedThisQuarter}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {d.currentCohortSize} active</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> Buddy: {d.buddyProgramParticipation}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: BUDDIES ═══════════════════════ */}
        {activeTab === 'buddies' && (
          <div className="space-y-4">
            {filteredBuddies.map((b) => (
              <div key={b.buddyName} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">{b.buddyName}</span>
                    <span className="text-[10px] text-slate-500">{b.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{b.assignedHires} hires</span>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-500 uppercase">Satisfaction</div>
                      <div className={`text-sm font-black font-mono ${b.satisfactionScore >= 8 ? 'text-emerald-400' : b.satisfactionScore >= 6 ? 'text-amber-400' : 'text-red-400'}`}>{b.satisfactionScore.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Avg NPS</div>
                    <div className={`text-sm font-black font-mono ${b.avgHireNPS >= 7.5 ? 'text-emerald-400' : 'text-amber-400'}`}>{b.avgHireNPS.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Completion</div>
                    <div className={`text-sm font-black font-mono ${b.avgCompletionRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>{b.avgCompletionRate}%</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-2.5 border border-slate-800 text-center">
                    <div className="text-[9px] text-slate-500 uppercase">Active</div>
                    <div className="text-sm font-black font-mono text-blue-400">{b.activeBuddies}</div>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${b.satisfactionScore >= 8 ? 'bg-emerald-500' : b.satisfactionScore >= 6 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${(b.satisfactionScore / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ──── Modals ──── */}
      {hireModal && <HireDetailModal hire={hireModal} onClose={() => setHireModal(null)} />}
      {deptModal && <DeptDetailModal dept={deptModal} onClose={() => setDeptModal(null)} />}
    </div>
  );
}
