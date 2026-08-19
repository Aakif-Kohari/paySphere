import React from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Fingerprint,
  AlertTriangle,
  ShieldCheck,
  User,
  Timer,
  ArrowRight,
  Eye,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  employeeName: string;
  employeeId: string;
  departmentName: string;
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'APPROVED' | 'FLAGGED' | 'REJECTED' | 'BREAK_START' | 'BREAK_END';
  timestamp: string;
  location: string;
  biometricVerified: boolean;
  hoursWorked?: number;
  overtimeHours?: number;
  flaggedReason?: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const TIMELINE_ENTRIES: TimelineEntry[] = [
  {
    id: 'tl-001',
    employeeName: 'Sarah Chen',
    employeeId: 'emp-1001',
    departmentName: 'Engineering',
    action: 'APPROVED',
    timestamp: '12 mins ago',
    location: 'HQ New York',
    biometricVerified: true,
    hoursWorked: 8.72,
    overtimeHours: 0.72,
  },
  {
    id: 'tl-002',
    employeeName: 'Marcus Thompson',
    employeeId: 'emp-1004',
    departmentName: 'Engineering',
    action: 'FLAGGED',
    timestamp: '34 mins ago',
    location: 'HQ New York',
    biometricVerified: false,
    hoursWorked: 13.0,
    overtimeHours: 5.0,
    flaggedReason: 'Biometric verification failed — manual clock-in required',
  },
  {
    id: 'tl-003',
    employeeName: 'James Rodriguez',
    employeeId: 'emp-1002',
    departmentName: 'Global Sales',
    action: 'FLAGGED',
    timestamp: '1 hour ago',
    location: 'LA Office',
    biometricVerified: true,
    hoursWorked: 11.42,
    overtimeHours: 3.42,
    flaggedReason: 'Exceeds daily overtime cap — requires manager review',
  },
  {
    id: 'tl-004',
    employeeName: 'Aiko Tanaka',
    employeeId: 'emp-1005',
    departmentName: 'Finance & Accounting',
    action: 'CLOCK_IN',
    timestamp: '2 hours ago',
    location: 'Tokyo Office',
    biometricVerified: true,
  },
  {
    id: 'tl-005',
    employeeName: 'Priya Patel',
    employeeId: 'emp-1003',
    departmentName: 'Corporate Operations',
    action: 'CLOCK_OUT',
    timestamp: '3 hours ago',
    location: 'London Office',
    biometricVerified: true,
    hoursWorked: 8.08,
  },
  {
    id: 'tl-006',
    employeeName: 'Elena Vasquez',
    employeeId: 'emp-1006',
    departmentName: 'Global Sales',
    action: 'APPROVED',
    timestamp: '3 hours ago',
    location: 'Berlin Office',
    biometricVerified: true,
    hoursWorked: 8.45,
    overtimeHours: 0.45,
  },
  {
    id: 'tl-007',
    employeeName: 'David Kim',
    employeeId: 'emp-1007',
    departmentName: 'People & Culture',
    action: 'CLOCK_OUT',
    timestamp: '4 hours ago',
    location: 'SF Office',
    biometricVerified: true,
    hoursWorked: 7.0,
  },
  {
    id: 'tl-008',
    employeeName: 'Fatima Al-Rashid',
    employeeId: 'emp-1008',
    departmentName: 'Engineering',
    action: 'APPROVED',
    timestamp: '5 hours ago',
    location: 'Dubai Office',
    biometricVerified: true,
    hoursWorked: 9.58,
    overtimeHours: 1.58,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function actionConfig(action: TimelineEntry['action']) {
  switch (action) {
    case 'CLOCK_IN':
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: Clock, label: 'Clock In' };
    case 'CLOCK_OUT':
      return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', icon: Clock, label: 'Clock Out' };
    case 'APPROVED':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2, label: 'Approved' };
    case 'FLAGGED':
      return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: AlertTriangle, label: 'Flagged' };
    case 'REJECTED':
      return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle, label: 'Rejected' };
    case 'BREAK_START':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: Timer, label: 'Break Start' };
    case 'BREAK_END':
      return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: Timer, label: 'Break End' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', icon: Activity, label: 'Unknown' };
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AttendanceActivityTimeline() {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" /> Real-Time Attendance Telemetry Stream
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            Geo-fenced clock events, biometric verification status, and overtime compliance alerts.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-indigo-300 font-semibold font-mono">
          <ShieldCheck className="w-4 h-4 text-indigo-400" /> Live Event Stream
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/30 via-slate-800 to-transparent" />

        <div className="space-y-5">
          {TIMELINE_ENTRIES.map((entry) => {
            const cfg = actionConfig(entry.action);
            const ActionIcon = cfg.icon;

            return (
              <div key={entry.id} className="relative pl-12">
                {/* Dot on timeline */}
                <div
                  className={`absolute left-3 top-5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    entry.action === 'FLAGGED'
                      ? 'bg-rose-500/20 border-rose-500'
                      : entry.action === 'APPROVED'
                      ? 'bg-emerald-500/20 border-emerald-500'
                      : 'bg-slate-500/20 border-slate-600'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      entry.action === 'FLAGGED'
                        ? 'bg-rose-400'
                        : entry.action === 'APPROVED'
                        ? 'bg-emerald-400'
                        : 'bg-slate-400'
                    }`}
                  />
                </div>

                {/* Card */}
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 hover:border-indigo-500/30 transition-all">
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-300" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-100">{entry.employeeName}</span>
                        <span className="text-[11px] text-slate-500 font-mono ml-2">{entry.employeeId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border font-mono flex items-center gap-1 ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        <ActionIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">{entry.timestamp}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">Department</span>
                      <span className="text-slate-200 font-semibold">{entry.departmentName}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> Location
                      </span>
                      <span className="text-slate-200 font-semibold">{entry.location}</span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
                      <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                        <Fingerprint className="w-2.5 h-2.5" /> Biometric
                      </span>
                      <span className={entry.biometricVerified ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {entry.biometricVerified ? 'Verified ✓' : 'Failed ✕'}
                      </span>
                    </div>
                    {entry.hoursWorked !== undefined && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                          <Timer className="w-2.5 h-2.5" /> Hours
                        </span>
                        <span className="text-white font-bold">
                          {entry.hoursWorked}h
                          {entry.overtimeHours !== undefined && entry.overtimeHours > 0 && (
                            <span className="text-amber-400 ml-1">+{entry.overtimeHours} OT</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Flagged reason */}
                  {entry.flaggedReason && (
                    <div className="mt-3 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-rose-300 font-medium leading-relaxed">{entry.flaggedReason}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
