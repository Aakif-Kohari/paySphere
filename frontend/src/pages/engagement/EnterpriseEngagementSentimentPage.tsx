/* ═══════════════════════════════════════════════════════════════
   Enterprise Engagement & Sentiment Analytics Hub
   
   Full-featured dashboard with pulse surveys, department
   engagement breakdown, action plans, burnout risk indicators,
   sentiment trends, and a real-time activity feed.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Heart,
  Search,
  Download,
  RefreshCw,
  Plus,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Target,
  AlertTriangle,
  CheckCircle2,
  Flame,
  ClipboardList,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
  Filter,
  Brain,
  Smile,
  Frown,
  Meh,
} from 'lucide-react';

/* ── Service imports ── */
import {
  SEED_SURVEYS,
  SEED_DEPARTMENTS,
  SEED_ACTION_PLANS,
  SEED_ACTIVITIES,
  SEED_SENTIMENT_TRENDS,
  SEED_BURNOUT_INDICATORS,
  exportToCsv,
  statusColor,
  priorityColor,
  burnoutColor,
  trendIcon,
  trendColor,
} from '../../services/engagement/engagementService';
import type {
  PulseSurvey,
  DepartmentEngagement,
  EngagementActionPlan,
  EngagementActivity,
  BurnoutIndicator,
} from '../../services/engagement/engagementService';

/* ── Component imports ── */
import PulseSurveyCard from '../../components/engagement/PulseSurveyCard';
import SentimentTimeline from '../../components/engagement/SentimentTimeline';
import ActionPlanModal from '../../components/engagement/ActionPlanModal';

/* ─────────────────────── Toast Hook ─────────────────────────── */

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

let toastSeq = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, addToast, dismiss };
}

/* ─────────────────── Toast Renderer ─────────────────────────── */

function ToastRenderer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl text-sm font-medium animate-slide-in ${
            t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300' :
            t.type === 'error' ? 'bg-red-950/90 border-red-500/30 text-red-300' :
            t.type === 'warning' ? 'bg-amber-950/90 border-amber-500/30 text-amber-300' :
            'bg-slate-800/90 border-slate-700/50 text-slate-200'
          }`}
        >
          <div className="flex-1">{t.message}</div>
          <button onClick={() => dismiss(t.id)} className="text-current opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
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
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle
        cx={((data.length - 1) / (data.length - 1)) * width}
        cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

/* ─────────────────── Sentiment Bar ─────────────────────────── */

function SentimentBar({ breakdown }: { breakdown: { veryPositive: number; positive: number; neutral: number; negative: number; veryNegative: number } }) {
  const total = breakdown.veryPositive + breakdown.positive + breakdown.neutral + breakdown.negative + breakdown.veryNegative;
  if (total === 0) return <div className="h-3 bg-slate-800 rounded-full" />;
  const segments = [
    { pct: (breakdown.veryPositive / total) * 100, color: 'bg-emerald-500' },
    { pct: (breakdown.positive / total) * 100, color: 'bg-green-500' },
    { pct: (breakdown.neutral / total) * 100, color: 'bg-slate-500' },
    { pct: (breakdown.negative / total) * 100, color: 'bg-orange-500' },
    { pct: (breakdown.veryNegative / total) * 100, color: 'bg-red-500' },
  ];
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-px">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`${seg.color} transition-all duration-700`}
          style={{ width: `${seg.pct}%` }}
        />
      ))}
    </div>
  );
}

/* ─────────────────── Burnout Risk Card ─────────────────────── */

function BurnoutCard({ indicator }: { indicator: BurnoutIndicator }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-white">{indicator.departmentName}</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${burnoutColor(indicator.riskLevel)}`}>
          {indicator.riskLevel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">Workload</div>
          <div className={`text-sm font-black font-mono ${indicator.workloadScore >= 80 ? 'text-red-400' : indicator.workloadScore >= 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {indicator.workloadScore}%
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">PTO Usage</div>
          <div className={`text-sm font-black font-mono ${indicator.ptoUtilization < 50 ? 'text-red-400' : indicator.ptoUtilization < 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {indicator.ptoUtilization}%
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">OT Hrs/Wk</div>
          <div className={`text-sm font-black font-mono ${indicator.overtimeHours > 10 ? 'text-red-400' : indicator.overtimeHours > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {indicator.overtimeHours}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase">Sentiment</div>
          <div className={`text-sm font-black font-mono ${indicator.surveySentiment >= 4 ? 'text-emerald-400' : indicator.surveySentiment >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
            {indicator.surveySentiment.toFixed(1)}
          </div>
        </div>
      </div>
      {indicator.riskFactors.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {indicator.riskFactors.map((rf, i) => (
            <span key={i} className="bg-red-500/10 text-red-400 text-[9px] px-1.5 py-0.5 rounded-full border border-red-500/20">
              {rf}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Department Row ─────────────────────────── */

function DepartmentRow({ dept, onClick }: { dept: DepartmentEngagement; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-white">{dept.name}</h4>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${burnoutColor(dept.burnoutRisk)}`}>
            {dept.burnoutRisk === 'CRITICAL' ? <Flame className="w-3 h-3 inline mr-0.5" /> : null}
            {dept.burnoutRisk}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">eNPS</div>
          <div className={`text-sm font-black font-mono ${dept.eNPS >= 70 ? 'text-emerald-400' : dept.eNPS >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {dept.eNPS}
            <span className={`text-[10px] ml-0.5 ${trendColor(dept.eNPSTrend)}`}>{trendIcon(dept.eNPSTrend)}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Engagement</div>
          <div className="text-sm font-black font-mono text-white">
            {dept.engagementScore}
            <span className={`text-[10px] ml-0.5 ${trendColor(dept.engagementTrend)}`}>{trendIcon(dept.engagementTrend)}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Pulse</div>
          <div className="text-sm font-black font-mono text-white">
            {dept.pulseScore.toFixed(1)}
            <span className={`text-[10px] ml-0.5 ${trendColor(dept.pulseTrend)}`}>{trendIcon(dept.pulseTrend)}</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-500 uppercase">Ret. Risk</div>
          <div className={`text-sm font-black font-mono ${dept.retentionRisk >= 15 ? 'text-red-400' : dept.retentionRisk >= 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {dept.retentionRisk}%
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px]">
        <span className="text-slate-500">
          <Users className="w-3 h-3 inline mr-1" />{dept.headcount}
        </span>
        <span className="text-slate-500">
          <Target className="w-3 h-3 inline mr-1" />{dept.activeSurveys} active
        </span>
        <span className="text-slate-400 truncate flex-1">
          Top concern: {dept.topConcern}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────── Department Detail Modal ─────────────────── */

function DepartmentDetailModal({ dept, onClose }: { dept: DepartmentEngagement; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-bold text-white">{dept.name}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">eNPS</div>
            <div className={`text-2xl font-black font-mono ${dept.eNPS >= 70 ? 'text-emerald-400' : dept.eNPS >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {dept.eNPS}
            </div>
            <div className={`text-[10px] ${trendColor(dept.eNPSTrend)}`}>{trendIcon(dept.eNPSTrend)} {dept.eNPSTrend}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Engagement</div>
            <div className="text-2xl font-black font-mono text-white">{dept.engagementScore}</div>
            <div className={`text-[10px] ${trendColor(dept.engagementTrend)}`}>{trendIcon(dept.engagementTrend)} {dept.engagementTrend}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Pulse</div>
            <div className="text-2xl font-black font-mono text-white">{dept.pulseScore.toFixed(1)}</div>
            <div className={`text-[10px] ${trendColor(dept.pulseTrend)}`}>{trendIcon(dept.pulseTrend)} {dept.pulseTrend}</div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Top Concern</div>
            <div className="text-xs text-orange-400 font-medium">{dept.topConcern}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Top Strength</div>
            <div className="text-xs text-emerald-400 font-medium">{dept.topStrength}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Headcount: {dept.headcount}</span>
          <span>Retention Risk: <span className={`font-bold ${dept.retentionRisk >= 15 ? 'text-red-400' : dept.retentionRisk >= 8 ? 'text-amber-400' : 'text-emerald-400'}`}>{dept.retentionRisk}%</span></span>
          <span>Last Pulse: {dept.lastPulseDate}</span>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function EnterpriseEngagementSentimentPage() {
  const { toasts, addToast, dismiss } = useToasts();

  const [activeTab, setActiveTab] = useState<'surveys' | 'departments' | 'action-plans' | 'burnout' | 'activity'>('surveys');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modalData, setModalData] = useState<PulseSurvey | DepartmentEngagement | null>(null);
  const [modalType, setModalType] = useState<'survey' | 'department' | null>(null);
  const [actionPlanModal, setActionPlanModal] = useState<{ mode: 'view' | 'create'; plan?: EngagementActionPlan | null } | null>(null);
  const [actionPlanFilter, setActionPlanFilter] = useState<string>('ALL');
  const [actionPlans, setActionPlans] = useState<EngagementActionPlan[]>(SEED_ACTION_PLANS);

  /* ───── Derived KPIs ───── */
  const avgENPS = Math.round(SEED_DEPARTMENTS.reduce((a, d) => a + d.eNPS, 0) / SEED_DEPARTMENTS.length);
  const avgEngagement = Math.round(SEED_DEPARTMENTS.reduce((a, d) => a + d.engagementScore, 0) / SEED_DEPARTMENTS.length);
  const activeSurveys = SEED_SURVEYS.filter((s) => s.status === 'ACTIVE').length;
  const totalResponses = SEED_SURVEYS.reduce((a, s) => a + s.totalResponses, 0);
  const highRiskDepts = SEED_BURNOUT_INDICATORS.filter((b) => b.riskLevel === 'HIGH' || b.riskLevel === 'CRITICAL').length;
  const completedPlans = actionPlans.filter((p) => p.status === 'COMPLETED').length;
  const avgSentimentScore = SEED_SENTIMENT_TRENDS[SEED_SENTIMENT_TRENDS.length - 1].score;
  const trendSparklineData = SEED_SENTIMENT_TRENDS.map((t) => t.score);

  /* ───── Filters ───── */
  const filteredSurveys = useMemo(() => {
    let list = [...SEED_SURVEYS];
    if (statusFilter !== 'ALL') list = list.filter((s) => s.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.departmentName.toLowerCase().includes(q));
    }
    return list;
  }, [statusFilter, searchQuery]);

  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return SEED_DEPARTMENTS;
    const q = searchQuery.toLowerCase();
    return SEED_DEPARTMENTS.filter((d) => d.name.toLowerCase().includes(q) || d.topConcern.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredActionPlans = useMemo(() => {
    let list = [...actionPlans];
    if (actionPlanFilter !== 'ALL') list = list.filter((p) => p.status === actionPlanFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q) || p.departmentName.toLowerCase().includes(q));
    }
    return list;
  }, [actionPlanFilter, searchQuery, actionPlans]);

  const filteredBurnout = useMemo(() => {
    if (!searchQuery) return SEED_BURNOUT_INDICATORS;
    const q = searchQuery.toLowerCase();
    return SEED_BURNOUT_INDICATORS.filter((b) => b.departmentName.toLowerCase().includes(q));
  }, [searchQuery]);

  /* ───── CSV Exports ───── */
  const handleExportDepartments = () => {
    exportToCsv(
      filteredDepartments.map((d) => ({
        department: d.name,
        headcount: d.headcount,
        eNPS: d.eNPS,
        engagementScore: d.engagementScore,
        pulseScore: d.pulseScore,
        burnoutRisk: d.burnoutRisk,
        retentionRisk: d.retentionRisk,
        topConcern: d.topConcern,
        topStrength: d.topStrength,
      })),
      'engagement-departments.csv'
    );
    addToast('Department engagement data exported', 'success');
  };

  const handleExportBurnout = () => {
    exportToCsv(
      filteredBurnout.map((b) => ({
        department: b.departmentName,
        workloadScore: b.workloadScore,
        overtimeHours: b.overtimeHours,
        ptoUtilization: b.ptoUtilization,
        sentiment: b.surveySentiment,
        riskLevel: b.riskLevel,
        riskFactors: b.riskFactors.join('; '),
      })),
      'burnout-risk-report.csv'
    );
    addToast('Burnout risk report exported', 'success');
  };

  const handleExportActionPlans = () => {
    exportToCsv(
      filteredActionPlans.map((p) => ({
        id: p.id,
        title: p.title,
        owner: p.owner,
        department: p.departmentName,
        status: p.status,
        priority: p.priority,
        dueDate: p.dueDate,
        milestonesCompleted: p.milestones.filter((m) => m.completed).length,
        milestonesTotal: p.milestones.length,
        tags: p.tags.join('; '),
      })),
      'action-plans.csv'
    );
    addToast('Action plans exported', 'success');
  };

  const handleCreateActionPlan = (plan: EngagementActionPlan) => {
    setActionPlans((prev) => [plan, ...prev]);
    setActionPlanModal(null);
    addToast(`Action plan "${plan.title}" created successfully`, 'success');
  };

  /* ───── Tabs Config ───── */
  const tabs = [
    { key: 'surveys' as const, label: 'Pulse Surveys', icon: ClipboardList, count: filteredSurveys.length },
    { key: 'departments' as const, label: 'Departments', icon: Users, count: filteredDepartments.length },
    { key: 'action-plans' as const, label: 'Action Plans', icon: Target, count: filteredActionPlans.length },
    { key: 'burnout' as const, label: 'Burnout Risk', icon: Flame, count: `${highRiskDepts} at risk` },
    { key: 'activity' as const, label: 'Activity Feed', icon: Activity, count: SEED_ACTIVITIES.length },
  ];

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <ToastRenderer toasts={toasts} dismiss={dismiss} />

      {/* ──── Executive Header ──── */}
      <header className="max-w-[1400px] mx-auto mb-8 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-violet-500/20 text-violet-300 text-xs px-3 py-1 rounded-full font-semibold border border-violet-500/30 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" /> PaySphere People Analytics
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/30">
                eNPS {avgENPS}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-violet-200 bg-clip-text text-transparent">
              Employee Engagement & Sentiment Analytics Hub
            </h1>
            <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
              Real-time pulse surveys, department-level engagement metrics, eNPS tracking, burnout risk indicators, action plan management, and sentiment trend analysis for PaySphere's workforce of {SEED_DEPARTMENTS.reduce((a, d) => a + d.headcount, 0)} employees.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => addToast('Engagement data refreshed', 'success')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={() => setActionPlanModal({ mode: 'create' })}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-violet-600/20 transition flex items-center gap-2 text-sm border border-violet-400/20"
            >
              <Plus className="w-4 h-4" /> New Action Plan
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto space-y-6">
        {/* ──── KPI Cards ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Avg eNPS', value: String(avgENPS), sub: `${avgENPS >= 60 ? 'Healthy' : 'Needs attention'}`, icon: Smile, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', trend: 'UP' as const, trendVal: '+4' },
            { label: 'Engagement', value: String(avgEngagement), sub: 'Company average', icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', trend: 'UP' as const, trendVal: '+2' },
            { label: 'Active Surveys', value: String(activeSurveys), sub: `${totalResponses} total responses`, icon: ClipboardList, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', trend: 'UP' as const, trendVal: '+1' },
            { label: 'Sentiment Score', value: avgSentimentScore.toFixed(2), sub: 'Out of 5.0', icon: Brain, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', trend: 'UP' as const, trendVal: '+0.07' },
            { label: 'Burnout Risk', value: String(highRiskDepts), sub: 'Depts at HIGH+', icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', trend: 'DOWN' as const, trendVal: '-1' },
            { label: 'Plans Complete', value: `${completedPlans}/${actionPlans.length}`, sub: 'Action plans', icon: Target, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', trend: 'UP' as const, trendVal: '+1' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} border rounded-2xl p-4 backdrop-blur-md`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="text-2xl font-black text-white font-mono">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[11px] font-medium ${kpi.trend === 'UP' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kpi.trend === 'UP' ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
                  {kpi.trendVal}
                </span>
                <span className={`${kpi.color} text-[11px] font-medium`}>{kpi.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ──── Sentiment Trend Mini-Chart ──── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">6-Month Sentiment Trend</div>
              <div className="text-[11px] text-slate-400">Avg score from {SEED_SENTIMENT_TRENDS[0].responses} → {SEED_SENTIMENT_TRENDS[SEED_SENTIMENT_TRENDS.length - 1].responses} responses</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Sparkline data={trendSparklineData} color="#10b981" height={40} width={200} />
            <div className="text-right">
              <div className="text-lg font-black text-emerald-400 font-mono">{avgSentimentScore.toFixed(2)}</div>
              <div className="text-[10px] text-emerald-400/70">↑ 0.07 vs last month</div>
            </div>
          </div>
        </div>

        {/* ──── Tab Navigation ──── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.key ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className="text-[10px] opacity-70">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === 'surveys' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="CLOSED">Closed</option>
              </select>
            )}
            {activeTab === 'action-plans' && (
              <select
                value={actionPlanFilter}
                onChange={(e) => setActionPlanFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs px-3 py-2.5 focus:outline-none focus:border-violet-500"
              >
                <option value="ALL">All Status</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            )}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-violet-500 transition"
              />
            </div>
            {(activeTab === 'departments' || activeTab === 'burnout' || activeTab === 'action-plans') && (
              <button
                onClick={() => {
                  if (activeTab === 'departments') handleExportDepartments();
                  else if (activeTab === 'burnout') handleExportBurnout();
                  else handleExportActionPlans();
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 border border-slate-700 shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            )}
          </div>
        </div>

        {/* ═══════════════════════ TAB: SURVEYS ═══════════════════════ */}
        {activeTab === 'surveys' && (
          <div className="space-y-4">
            {filteredSurveys.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No surveys match your filter.</p>
              </div>
            )}
            {filteredSurveys.map((survey) => (
              <PulseSurveyCard
                key={survey.id}
                survey={survey}
                onExport={(s) => {
                  exportToCsv(
                    [{ id: s.id, title: s.title, status: s.status, responses: s.totalResponses, rate: s.responseRate, avgScore: s.avgScore }],
                    `survey-${s.id}.csv`
                  );
                  addToast('Survey data exported', 'success');
                }}
                onRemind={(s) => addToast(`Reminder sent to ${s.totalInvited - s.totalResponses} non-respondents for "${s.title}"`, 'info')}
                onViewDetails={(s) => { setModalData(s); setModalType('survey'); }}
              />
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: DEPARTMENTS ═══════════════════════ */}
        {activeTab === 'departments' && (
          <div className="space-y-4">
            {filteredDepartments.map((dept) => (
              <DepartmentRow key={dept.id} dept={dept} onClick={() => { setModalData(dept); setModalType('department'); }} />
            ))}
          </div>
        )}

        {/* ═══════════════════════ TAB: ACTION PLANS ═══════════════════════ */}
        {activeTab === 'action-plans' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setActionPlanModal({ mode: 'create' })}
                className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-violet-500/30"
              >
                <Plus className="w-3.5 h-3.5" /> New Plan
              </button>
            </div>
            {filteredActionPlans.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No action plans match your filter.</p>
              </div>
            )}
            {filteredActionPlans.map((plan) => {
              const progress = plan.milestones.length > 0 ? Math.round((plan.milestones.filter((m) => m.completed).length / plan.milestones.length) * 100) : 0;
              const daysLeft = Math.ceil((new Date(plan.dueDate).getTime() - new Date('2026-08-20T15:00:00Z').getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = daysLeft < 0 && plan.status !== 'COMPLETED';

              return (
                <div
                  key={plan.id}
                  onClick={() => setActionPlanModal({ mode: 'view', plan })}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Target className="w-4 h-4 text-violet-400 shrink-0" />
                        <span className="text-sm font-bold text-white truncate">{plan.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(plan.status)}`}>
                          {plan.status.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColor(plan.priority)}`}>
                          {plan.priority}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 ml-7">{plan.description}</p>
                      <div className="flex items-center gap-4 mt-2 ml-7 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[7px] font-bold text-white">
                            {plan.ownerAvatar}
                          </div>
                          {plan.owner}
                        </span>
                        <span>{plan.departmentName}</span>
                        <span className={isOverdue ? 'text-red-400 font-semibold' : daysLeft <= 14 ? 'text-amber-400' : ''}>
                          {plan.status === 'COMPLETED' ? 'Done' : isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                        </span>
                        <span>{plan.milestones.filter((m) => m.completed).length}/{plan.milestones.length} milestones</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-24">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-slate-500">Progress</span>
                          <span className="text-white font-mono font-bold">{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress === 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════ TAB: BURNOUT ═══════════════════════ */}
        {activeTab === 'burnout' && (
          <div className="space-y-4">
            {filteredBurnout.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <Flame className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No departments match your filter.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBurnout.map((indicator) => (
                <BurnoutCard key={indicator.departmentId} indicator={indicator} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════ TAB: ACTIVITY ═══════════════════════ */}
        {activeTab === 'activity' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SentimentTimeline activities={SEED_ACTIVITIES} />
            </div>
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> Activity Summary
                </h3>
                <div className="space-y-2">
                  {(['ALERT', 'WARNING', 'SUCCESS', 'INFO'] as const).map((sev) => {
                    const count = SEED_ACTIVITIES.filter((a) => a.severity === sev).length;
                    return (
                      <div key={sev} className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{sev}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sev === 'ALERT' ? 'bg-red-500' : sev === 'WARNING' ? 'bg-amber-500' : sev === 'SUCCESS' ? 'bg-emerald-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${(count / SEED_ACTIVITIES.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono w-4 text-right">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Alerts */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Active Alerts
                </h3>
                <div className="space-y-2">
                  {SEED_ACTIVITIES.filter((a) => a.severity === 'ALERT' || a.severity === 'WARNING').slice(0, 4).map((a) => (
                    <div key={a.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${a.severity === 'ALERT' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <span className="text-[10px] font-semibold text-white truncate">{a.title}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2">{a.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sentiment Breakdown Legend */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" /> Sentiment Legend
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Very Positive', color: 'bg-emerald-500', icon: Smile },
                    { label: 'Positive', color: 'bg-green-500', icon: Smile },
                    { label: 'Neutral', color: 'bg-slate-500', icon: Meh },
                    { label: 'Negative', color: 'bg-orange-500', icon: Frown },
                    { label: 'Very Negative', color: 'bg-red-500', icon: Frown },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                      <item.icon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] text-slate-400">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ──── Modals ──── */}
      {modalType === 'survey' && modalData && 'questions' in modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalData(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-bold text-white">{(modalData as PulseSurvey).title}</h2>
              <button onClick={() => setModalData(null)} className="text-slate-500 hover:text-slate-300 transition"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">{(modalData as PulseSurvey).description}</p>
            <SentimentBar breakdown={(modalData as PulseSurvey).sentimentBreakdown} />
            <div className="flex justify-end mt-4">
              <button onClick={() => setModalData(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {modalType === 'department' && modalData && 'eNPS' in modalData && (
        <DepartmentDetailModal dept={modalData as DepartmentEngagement} onClose={() => setModalData(null)} />
      )}

      {actionPlanModal && (
        <ActionPlanModal
          mode={actionPlanModal.mode}
          plan={actionPlanModal.plan ?? null}
          onClose={() => setActionPlanModal(null)}
          onSave={handleCreateActionPlan}
        />
      )}
    </div>
  );
}
