import React, { useState, useMemo } from 'react';
import {
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Timer,
  ShieldCheck,
  Download,
  Filter,
  Search,
  Calendar,
  FileText,
  PieChart,
  Activity,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Fingerprint,
  Zap,
  BarChart3,
} from 'lucide-react';
import AttendanceSummaryCard, { AttendanceEmployeeMetric } from '../../components/timeattendance/AttendanceSummaryCard';
import AttendanceActivityTimeline from '../../components/timeattendance/AttendanceActivityTimeline';

// ── Mock Data ───────────────────────────────────────────────────────────────

const ATTENDANCE_METRICS: AttendanceEmployeeMetric[] = [
  {
    employeeId: 'emp-1001', employeeName: 'Sarah Chen', departmentCode: 'ENG', departmentName: 'Engineering',
    totalScheduledDays: 22, totalDaysPresent: 22, totalDaysAbsent: 0, totalOvertimeHours: 7.5,
    attendancePercentage: 100, complianceStatus: 'COMPLIANT',
  },
  {
    employeeId: 'emp-1002', employeeName: 'James Rodriguez', departmentCode: 'SALES', departmentName: 'Global Sales',
    totalScheduledDays: 22, totalDaysPresent: 18, totalDaysAbsent: 2, totalOvertimeHours: 18.2,
    attendancePercentage: 81.82, complianceStatus: 'WARNING',
  },
  {
    employeeId: 'emp-1003', employeeName: 'Priya Patel', departmentCode: 'OPS', departmentName: 'Corporate Operations',
    totalScheduledDays: 22, totalDaysPresent: 22, totalDaysAbsent: 0, totalOvertimeHours: 2.1,
    attendancePercentage: 100, complianceStatus: 'COMPLIANT',
  },
  {
    employeeId: 'emp-1004', employeeName: 'Marcus Thompson', departmentCode: 'ENG', departmentName: 'Engineering',
    totalScheduledDays: 22, totalDaysPresent: 16, totalDaysAbsent: 4, totalOvertimeHours: 22.5,
    attendancePercentage: 72.73, complianceStatus: 'NON_COMPLIANT',
  },
  {
    employeeId: 'emp-1005', employeeName: 'Aiko Tanaka', departmentCode: 'FIN', departmentName: 'Finance & Accounting',
    totalScheduledDays: 22, totalDaysPresent: 22, totalDaysAbsent: 0, totalOvertimeHours: 5.3,
    attendancePercentage: 100, complianceStatus: 'COMPLIANT',
  },
  {
    employeeId: 'emp-1006', employeeName: 'Elena Vasquez', departmentCode: 'SALES', departmentName: 'Global Sales',
    totalScheduledDays: 22, totalDaysPresent: 20, totalDaysAbsent: 1, totalOvertimeHours: 6.8,
    attendancePercentage: 90.91, complianceStatus: 'COMPLIANT',
  },
  {
    employeeId: 'emp-1007', employeeName: 'David Kim', departmentCode: 'HR', departmentName: 'People & Culture',
    totalScheduledDays: 22, totalDaysPresent: 21, totalDaysAbsent: 1, totalOvertimeHours: 3.2,
    attendancePercentage: 95.45, complianceStatus: 'COMPLIANT',
  },
  {
    employeeId: 'emp-1008', employeeName: 'Fatima Al-Rashid', departmentCode: 'ENG', departmentName: 'Engineering',
    totalScheduledDays: 22, totalDaysPresent: 22, totalDaysAbsent: 0, totalOvertimeHours: 9.1,
    attendancePercentage: 100, complianceStatus: 'COMPLIANT',
  },
];

const DEPARTMENTS = ['All', 'ENG', 'SALES', 'OPS', 'FIN', 'HR'];
const STATUSES = ['All', 'COMPLIANT', 'WARNING', 'NON_COMPLIANT'];

// ── Page ────────────────────────────────────────────────────────────────────

export default function EnterpriseTimeAttendanceDashboardPage() {
  const [metrics, setMetrics] = useState<AttendanceEmployeeMetric[]>(ATTENDANCE_METRICS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline'>('overview');
  const [selectedEmployeeModal, setSelectedEmployeeModal] = useState<AttendanceEmployeeMetric | null>(null);

  // ── Aggregate KPIs ──────────────────────────────────────────────────────
  const totalEmployees = metrics.length;
  const compliantCount = metrics.filter(m => m.complianceStatus === 'COMPLIANT').length;
  const warningCount = metrics.filter(m => m.complianceStatus === 'WARNING').length;
  const nonCompliantCount = metrics.filter(m => m.complianceStatus === 'NON_COMPLIANT').length;
  const totalOTHours = metrics.reduce((sum, m) => sum + m.totalOvertimeHours, 0);
  const avgAttendance = Math.round(metrics.reduce((sum, m) => sum + m.attendancePercentage, 0) / totalEmployees * 100) / 100;
  const totalPresent = metrics.reduce((sum, m) => sum + m.totalDaysPresent, 0);
  const totalScheduled = metrics.reduce((sum, m) => sum + m.totalScheduledDays, 0);

  // ── Filtering ──────────────────────────────────────────────────────────
  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      const matchesSearch =
        m.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDepartment === 'All' || m.departmentCode === selectedDepartment;
      const matchesStatus = selectedStatus === 'All' || m.complianceStatus === selectedStatus;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [metrics, searchQuery, selectedDepartment, selectedStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* ── Executive Header Banner ───────────────────────────────────── */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-indigo-950 via-slate-900 to-violet-950 border border-indigo-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> PaySphere Enterprise Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> SOC-2 Type II Certified Pipeline
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              Enterprise Time & Attendance Intelligence
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Real-time geo-fenced clock events, biometric verification telemetry, overtime compliance monitoring, and cross-facility attendance analytics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 border border-indigo-400/20 text-sm">
              <Download className="w-4 h-4" /> Export Attendance Audit
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* ── Top KPI Stats ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Avg Attendance */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Avg Attendance Rate</span>
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{avgAttendance}%</div>
            <div className="text-indigo-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> +3.1% from previous period
            </div>
          </div>

          {/* Overtime Hours */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total OT Hours</span>
              <Timer className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{totalOTHours.toFixed(1)}h</div>
            <div className="text-amber-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <Zap className="w-3.5 h-3.5" /> Est. ${(totalOTHours * 45 * 1.5).toFixed(0)} OT cost
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Compliance Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">
              {Math.round((compliantCount / totalEmployees) * 100)}%
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono">
              <span className="text-emerald-400">{compliantCount} compliant</span>
              {warningCount > 0 && <span className="text-amber-400">{warningCount} warning</span>}
              {nonCompliantCount > 0 && <span className="text-rose-400">{nonCompliantCount} at risk</span>}
            </div>
          </div>

          {/* Active Headcount */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Headcount</span>
              <Users className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-black text-white font-mono">{totalEmployees}</div>
            <div className="text-violet-400 text-xs mt-2 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> {totalPresent} / {totalScheduled} days tracked
            </div>
          </div>
        </div>

        {/* ── Navigation Bar ──────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <PieChart className="w-4 h-4" /> Employee Breakdown
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 ${
                activeTab === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Live Activity Stream
            </button>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-900/90 border border-slate-800 rounded-xl text-slate-100 text-sm px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Tab Body ────────────────────────────────────────────────── */}
        {activeTab === 'timeline' ? (
          <AttendanceActivityTimeline />
        ) : (
          <>
            {filteredMetrics.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">No employees match your current filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredMetrics.map((emp) => (
                  <AttendanceSummaryCard
                    key={emp.employeeId}
                    metric={emp}
                    onInspect={() => setSelectedEmployeeModal(emp)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Detail Modal ──────────────────────────────────────────────── */}
      {selectedEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedEmployeeModal(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedEmployeeModal.employeeName}</h2>
                <div className="text-xs text-slate-400 font-mono">
                  {selectedEmployeeModal.employeeId} • {selectedEmployeeModal.departmentName}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Attendance Rate</span>
                <span className={`font-bold text-sm ${selectedEmployeeModal.attendancePercentage >= 95 ? 'text-emerald-400' : selectedEmployeeModal.attendancePercentage >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {selectedEmployeeModal.attendancePercentage}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Compliance Status</span>
                <span className={`font-bold text-sm ${
                  selectedEmployeeModal.complianceStatus === 'COMPLIANT' ? 'text-emerald-400' :
                  selectedEmployeeModal.complianceStatus === 'WARNING' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {selectedEmployeeModal.complianceStatus}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Days Present</span>
                <span className="text-white font-bold text-sm">{selectedEmployeeModal.totalDaysPresent} / {selectedEmployeeModal.totalScheduledDays}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Days Absent</span>
                <span className="text-rose-400 font-bold text-sm">{selectedEmployeeModal.totalDaysAbsent}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total OT Hours</span>
                <span className="text-amber-400 font-bold text-sm">{selectedEmployeeModal.totalOvertimeHours}h</span>
              </div>
              <div>
                <span className="text-slate-500 block">OT Cost Estimate</span>
                <span className="text-amber-400 font-bold text-sm">${(selectedEmployeeModal.totalOvertimeHours * 45 * 1.5).toFixed(0)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSelectedEmployeeModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs transition"
              >
                Close Audit View
              </button>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs transition flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
