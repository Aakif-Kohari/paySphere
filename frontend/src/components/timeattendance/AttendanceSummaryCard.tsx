import React from 'react';
import {
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Fingerprint,
  ArrowRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Timer,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AttendanceEmployeeMetric {
  employeeId: string;
  employeeName: string;
  departmentCode: string;
  departmentName: string;
  totalScheduledDays: number;
  totalDaysPresent: number;
  totalDaysAbsent: number;
  totalOvertimeHours: number;
  attendancePercentage: number;
  complianceStatus: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT' | 'UNDER_REVIEW';
}

interface AttendanceSummaryCardProps {
  metric: AttendanceEmployeeMetric;
  onInspect: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function complianceBadge(status: AttendanceEmployeeMetric['complianceStatus']) {
  switch (status) {
    case 'COMPLIANT':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: ShieldCheck,
        label: 'COMPLIANT',
      };
    case 'WARNING':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        icon: ShieldAlert,
        label: 'WARNING',
      };
    case 'NON_COMPLIANT':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        icon: ShieldX,
        label: 'NON-COMPLIANT',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        icon: ShieldCheck,
        label: 'UNDER REVIEW',
      };
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AttendanceSummaryCard({ metric, onInspect }: AttendanceSummaryCardProps) {
  const badge = complianceBadge(metric.complianceStatus);
  const BadgeIcon = badge.icon;
  const attendanceBarWidth = Math.min(100, metric.attendancePercentage);
  const absenceRate =
    metric.totalScheduledDays > 0
      ? Math.round((metric.totalDaysAbsent / metric.totalScheduledDays) * 10000) / 100
      : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-indigo-500/10 flex flex-col justify-between group">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition leading-tight">
                {metric.employeeName}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                {metric.employeeId} • {metric.departmentName}
              </p>
            </div>
          </div>

          <span
            className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border font-mono flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}
          >
            <BadgeIcon className="w-3 h-3" />
            {badge.label}
          </span>
        </div>

        {/* ── Attendance Bar ──────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 font-medium">Attendance Rate</span>
            <span className="font-mono font-bold text-slate-200">{metric.attendancePercentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                metric.attendancePercentage >= 95
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : metric.attendancePercentage >= 85
                  ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                  : 'bg-gradient-to-r from-rose-500 to-pink-400'
              }`}
              style={{ width: `${attendanceBarWidth}%` }}
            />
          </div>
        </div>

        {/* ── Metrics Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 mb-4 font-mono text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Days Present</span>
            <span className="text-emerald-400 font-bold text-sm flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {metric.totalDaysPresent} / {metric.totalScheduledDays}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Days Absent</span>
            <span className="text-rose-400 font-bold text-sm flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {metric.totalDaysAbsent}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Overtime Hours</span>
            <span className="text-amber-400 font-bold text-sm flex items-center gap-1 mt-0.5">
              <Timer className="w-3.5 h-3.5" /> {metric.totalOvertimeHours}h
            </span>
          </div>

          <div>
            <span className="text-slate-500 block text-[11px]">Absence Rate</span>
            <span className={`font-bold text-sm mt-0.5 block ${absenceRate > 10 ? 'text-rose-400' : 'text-slate-200'}`}>
              {absenceRate}%
            </span>
          </div>
        </div>

        {/* ── Details Stack ───────────────────────────────────────────── */}
        <div className="space-y-2 text-xs mb-5 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Compliance Score:</span>
            <span
              className={`font-semibold ${
                metric.attendancePercentage >= 95
                  ? 'text-emerald-400'
                  : metric.attendancePercentage >= 85
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {metric.attendancePercentage >= 95 ? '✓ Excellent' : metric.attendancePercentage >= 85 ? '⚠ Needs Review' : '✕ At Risk'}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>OT Cost Estimate:</span>
            <span className="text-amber-400 font-semibold">
              ${(metric.totalOvertimeHours * 45 * 1.5).toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-800 text-slate-200 font-bold">
            <span>Regular Hours (PP):</span>
            <span className="text-indigo-400">{metric.totalDaysPresent * 8}h</span>
          </div>
        </div>
      </div>

      {/* ── Footer Action ─────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="text-[11px] text-slate-400 font-mono">
          Trend:{' '}
          {metric.attendancePercentage >= 90 ? (
            <span className="text-emerald-400 flex items-center gap-1 inline-flex">
              <TrendingUp className="w-3 h-3" /> Improving
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1 inline-flex">
              <TrendingDown className="w-3 h-3" /> Declining
            </span>
          )}
        </div>

        <button
          onClick={onInspect}
          className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-indigo-500/30 transition flex items-center gap-1"
        >
          <span>Full Audit</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
