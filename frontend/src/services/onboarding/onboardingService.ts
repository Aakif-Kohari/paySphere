/* ═══════════════════════════════════════════════════════════════
   Employee Onboarding Lifecycle Intelligence — Service Layer
   ═══════════════════════════════════════════════════════════════ */

export type OnboardingStatus = 'PRE_BOARDING' | 'DAY_ONE' | 'WEEK_1' | 'MONTH_1' | 'MONTH_3' | 'COMPLETED' | 'DROPPED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED';
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';
export type MilestoneCategory = 'COMPLIANCE' | 'EQUIPMENT' | 'TRAINING' | 'SOCIAL' | 'PERFORMANCE';

export interface NewHire {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  manager: string;
  buddy: string;
  startDate: string;
  status: OnboardingStatus;
  completionPct: number;
  tasksCompleted: number;
  tasksTotal: number;
  daysSinceStart: number;
  npsScore: number | null;
  riskLevel: RiskLevel;
  riskFactors: string[];
  location: string;
  employmentType: 'FULL_TIME' | 'CONTRACT' | 'INTERN';
}

export interface OnboardingTask {
  id: string;
  hireId: string;
  title: string;
  category: MilestoneCategory;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  completedDate: string | null;
  dayNumber: number;
  isBlocking: boolean;
}

export interface OnboardingMilestone {
  id: string;
  name: string;
  dayNumber: number;
  category: MilestoneCategory;
  targetCompletionPct: number;
  actualCompletionPct: number;
  trend: TrendDirection;
}

export interface DepartmentOnboarding {
  department: string;
  avgTimeToProductivity: number;
  avgCompletionRate: number;
  avgNPSScore: number;
  currentCohortSize: number;
  completedThisQuarter: number;
  droppedThisQuarter: number;
  riskLevel: RiskLevel;
  buddyProgramParticipation: number;
}

export interface TimeToProductivityMetric {
  department: string;
  avgDays: number;
  medianDays: number;
  p90Days: number;
  newHires: number;
  trend: TrendDirection;
}

export interface BuddyProgramMetric {
  buddyName: string;
  department: string;
  assignedHires: number;
  avgHireNPS: number;
  avgCompletionRate: number;
  activeBuddies: number;
  satisfactionScore: number;
}

export interface OnboardingFunnelStage {
  stage: string;
  count: number;
  conversionRate: number;
  avgDaysInStage: number;
}

/* ─────────────────────── Seed Data ─────────────────────── */

export const SEED_NEW_HIRES: NewHire[] = [
  { id: 'NH-001', name: 'Aarav Mehta', email: 'aarav.m@paysphere.com', role: 'Senior Backend Engineer', department: 'Engineering', manager: 'Sarah Chen', buddy: 'Marcus Lee', startDate: '2026-08-18', status: 'DAY_ONE', completionPct: 25, tasksCompleted: 4, tasksTotal: 16, daysSinceStart: 2, npsScore: null, riskLevel: 'LOW', riskFactors: [], location: 'Mumbai', employmentType: 'FULL_TIME' },
  { id: 'NH-002', name: 'Sofia Rodriguez', email: 'sofia.r@paysphere.com', role: 'Product Designer', department: 'Product', manager: 'James Wu', buddy: 'Priya Nair', startDate: '2026-08-15', status: 'WEEK_1', completionPct: 45, tasksCompleted: 7, tasksTotal: 16, daysSinceStart: 5, npsScore: 8, riskLevel: 'LOW', riskFactors: [], location: 'San Francisco', employmentType: 'FULL_TIME' },
  { id: 'NH-003', name: 'Ravi Kumar', email: 'ravi.k@paysphere.com', role: 'Account Executive', department: 'Sales', manager: 'Tom Bradley', buddy: 'Lisa Wong', startDate: '2026-08-12', status: 'WEEK_1', completionPct: 35, tasksCompleted: 5, tasksTotal: 16, daysSinceStart: 8, npsScore: 5, riskLevel: 'MEDIUM', riskFactors: ['Low NPS feedback', 'Delayed equipment'], location: 'London', employmentType: 'FULL_TIME' },
  { id: 'NH-004', name: 'Emma Chen', email: 'emma.c@paysphere.com', role: 'Data Analyst', department: 'Finance', manager: 'Michael Torres', buddy: 'David Kim', startDate: '2026-08-01', status: 'MONTH_1', completionPct: 72, tasksCompleted: 11, tasksTotal: 16, daysSinceStart: 19, npsScore: 7, riskLevel: 'LOW', riskFactors: [], location: 'New York', employmentType: 'FULL_TIME' },
  { id: 'NH-005', name: 'Jake Morrison', email: 'jake.m@paysphere.com', role: 'DevOps Engineer', department: 'Engineering', manager: 'Sarah Chen', buddy: 'Marcus Lee', startDate: '2026-07-28', status: 'MONTH_3', completionPct: 88, tasksCompleted: 14, tasksTotal: 16, daysSinceStart: 23, npsScore: 9, riskLevel: 'LOW', riskFactors: [], location: 'Austin', employmentType: 'FULL_TIME' },
  { id: 'NH-006', name: 'Nina Petrova', email: 'nina.p@paysphere.com', role: 'CS Manager', department: 'Customer Success', manager: 'Aisha Okafor', buddy: 'Rachel Green', startDate: '2026-07-15', status: 'COMPLETED', completionPct: 100, tasksCompleted: 16, tasksTotal: 16, daysSinceStart: 36, npsScore: 9, riskLevel: 'LOW', riskFactors: [], location: 'Berlin', employmentType: 'FULL_TIME' },
  { id: 'NH-007', name: 'Carlos Vega', email: 'carlos.v@paysphere.com', role: 'Marketing Intern', department: 'Marketing', manager: 'Kate Johnson', buddy: null, startDate: '2026-08-05', status: 'MONTH_1', completionPct: 55, tasksCompleted: 8, tasksTotal: 16, daysSinceStart: 15, npsScore: 4, riskLevel: 'HIGH', riskFactors: ['No buddy assigned', 'Low engagement score', 'Missed 3 training sessions'], location: 'Chicago', employmentType: 'INTERN' },
  { id: 'NH-008', name: 'Yuki Tanaka', email: 'yuki.t@paysphere.com', role: 'QA Engineer', department: 'Engineering', manager: 'Sarah Chen', buddy: 'Marcus Lee', startDate: '2026-08-10', status: 'WEEK_1', completionPct: 40, tasksCompleted: 6, tasksTotal: 16, daysSinceStart: 10, npsScore: 6, riskLevel: 'MEDIUM', riskFactors: ['Delayed access provisioning'], location: 'Tokyo', employmentType: 'FULL_TIME' },
  { id: 'NH-009', name: 'Fatima Al-Hassan', email: 'fatima.a@paysphere.com', role: 'HR Business Partner', department: 'HR', manager: 'Aisha Okafor', buddy: 'Priya Nair', startDate: '2026-08-20', status: 'PRE_BOARDING', completionPct: 10, tasksCompleted: 1, tasksTotal: 16, daysSinceStart: 0, npsScore: null, riskLevel: 'LOW', riskFactors: [], location: 'Dubai', employmentType: 'FULL_TIME' },
  { id: 'NH-010', name: 'Liam O\'Brien', email: 'liam.o@paysphere.com', role: 'Sales Rep', department: 'Sales', manager: 'Tom Bradley', buddy: 'Lisa Wong', startDate: '2026-07-20', status: 'DROPPED', completionPct: 30, tasksCompleted: 4, tasksTotal: 16, daysSinceStart: 31, npsScore: 2, riskLevel: 'CRITICAL', riskFactors: ['Resigned during onboarding', 'Very low engagement', 'No manager check-ins'], location: 'Dublin', employmentType: 'FULL_TIME' },
];

export const SEED_MILESTONES: OnboardingMilestone[] = [
  { id: 'MS-1', name: 'Account Setup', dayNumber: 0, category: 'COMPLIANCE', targetCompletionPct: 100, actualCompletionPct: 95, trend: 'UP' },
  { id: 'MS-2', name: 'Equipment Provisioned', dayNumber: 1, category: 'EQUIPMENT', targetCompletionPct: 100, actualCompletionPct: 88, trend: 'DOWN' },
  { id: 'MS-3', name: 'Compliance Training', dayNumber: 3, category: 'COMPLIANCE', targetCompletionPct: 95, actualCompletionPct: 82, trend: 'FLAT' },
  { id: 'MS-4', name: 'Team Introduction', dayNumber: 5, category: 'SOCIAL', targetCompletionPct: 90, actualCompletionPct: 85, trend: 'UP' },
  { id: 'MS-5', name: 'Role-Specific Training', dayNumber: 14, category: 'TRAINING', targetCompletionPct: 85, actualCompletionPct: 72, trend: 'DOWN' },
  { id: 'MS-6', name: 'First 1:1 with Manager', dayNumber: 7, category: 'PERFORMANCE', targetCompletionPct: 100, actualCompletionPct: 78, trend: 'FLAT' },
  { id: 'MS-7', name: '30-Day Review', dayNumber: 30, category: 'PERFORMANCE', targetCompletionPct: 90, actualCompletionPct: 68, trend: 'DOWN' },
  { id: 'MS-8', name: '90-Day Review', dayNumber: 90, category: 'PERFORMANCE', targetCompletionPct: 85, actualCompletionPct: 62, trend: 'DOWN' },
];

export const SEED_DEPT_ONBOARDING: DepartmentOnboarding[] = [
  { department: 'Engineering', avgTimeToProductivity: 68, avgCompletionRate: 92, avgNPSScore: 8.2, currentCohortSize: 4, completedThisQuarter: 8, droppedThisQuarter: 0, riskLevel: 'LOW', buddyProgramParticipation: 100 },
  { department: 'Product', avgTimeToProductivity: 55, avgCompletionRate: 88, avgNPSScore: 7.8, currentCohortSize: 2, completedThisQuarter: 5, droppedThisQuarter: 0, riskLevel: 'LOW', buddyProgramParticipation: 100 },
  { department: 'Sales', avgTimeToProductivity: 82, avgCompletionRate: 65, avgNPSScore: 5.5, currentCohortSize: 3, completedThisQuarter: 6, droppedThisQuarter: 2, riskLevel: 'HIGH', buddyProgramParticipation: 75 },
  { department: 'Customer Success', avgTimeToProductivity: 72, avgCompletionRate: 85, avgNPSScore: 7.5, currentCohortSize: 1, completedThisQuarter: 4, droppedThisQuarter: 0, riskLevel: 'LOW', buddyProgramParticipation: 100 },
  { department: 'Finance', avgTimeToProductivity: 60, avgCompletionRate: 90, avgNPSScore: 7.0, currentCohortSize: 1, completedThisQuarter: 3, droppedThisQuarter: 0, riskLevel: 'LOW', buddyProgramParticipation: 100 },
  { department: 'Marketing', avgTimeToProductivity: 50, avgCompletionRate: 72, avgNPSScore: 5.8, currentCohortSize: 1, completedThisQuarter: 3, droppedThisQuarter: 1, riskLevel: 'MEDIUM', buddyProgramParticipation: 60 },
  { department: 'HR', avgTimeToProductivity: 45, avgCompletionRate: 95, avgNPSScore: 8.5, currentCohortSize: 1, completedThisQuarter: 2, droppedThisQuarter: 0, riskLevel: 'LOW', buddyProgramParticipation: 100 },
  { department: 'Operations', avgTimeToProductivity: 75, avgCompletionRate: 80, avgNPSScore: 6.8, currentCohortSize: 0, completedThisQuarter: 3, droppedThisQuarter: 1, riskLevel: 'MEDIUM', buddyProgramParticipation: 80 },
];

export const SEED_TTP: TimeToProductivityMetric[] = [
  { department: 'Engineering', avgDays: 68, medianDays: 62, p90Days: 95, newHires: 12, trend: 'DOWN' },
  { department: 'Product', avgDays: 55, medianDays: 50, p90Days: 78, newHires: 7, trend: 'DOWN' },
  { department: 'Sales', avgDays: 82, medianDays: 75, p90Days: 110, newHires: 8, trend: 'UP' },
  { department: 'Customer Success', avgDays: 72, medianDays: 68, p90Days: 92, newHires: 5, trend: 'FLAT' },
  { department: 'Finance', avgDays: 60, medianDays: 55, p90Days: 80, newHires: 3, trend: 'DOWN' },
  { department: 'Marketing', avgDays: 50, medianDays: 45, p90Days: 70, newHires: 4, trend: 'DOWN' },
];

export const SEED_BUDDY_METRICS: BuddyProgramMetric[] = [
  { buddyName: 'Marcus Lee', department: 'Engineering', assignedHires: 4, avgHireNPS: 8.3, avgCompletionRate: 94, activeBuddies: 1, satisfactionScore: 9.1 },
  { buddyName: 'Priya Nair', department: 'Product', assignedHires: 3, avgHireNPS: 7.9, avgCompletionRate: 90, activeBuddies: 1, satisfactionScore: 8.8 },
  { buddyName: 'Lisa Wong', department: 'Sales', assignedHires: 3, avgHireNPS: 5.2, avgCompletionRate: 68, activeBuddies: 1, satisfactionScore: 6.5 },
  { buddyName: 'David Kim', department: 'Finance', assignedHires: 2, avgHireNPS: 7.0, avgCompletionRate: 88, activeBuddies: 1, satisfactionScore: 7.8 },
  { buddyName: 'Rachel Green', department: 'Customer Success', assignedHires: 2, avgHireNPS: 8.0, avgCompletionRate: 92, activeBuddies: 1, satisfactionScore: 8.5 },
];

export const SEED_FUNNEL: OnboardingFunnelStage[] = [
  { stage: 'Pre-boarding', count: 15, conversionRate: 100, avgDaysInStage: 14 },
  { stage: 'Day 1', count: 14, conversionRate: 93, avgDaysInStage: 1 },
  { stage: 'Week 1', count: 13, conversionRate: 93, avgDaysInStage: 5 },
  { stage: 'Month 1', count: 12, conversionRate: 92, avgDaysInStage: 23 },
  { stage: 'Month 3', count: 10, conversionRate: 83, avgDaysInStage: 62 },
  { stage: 'Completed', count: 9, conversionRate: 90, avgDaysInStage: 90 },
];

/* ─────────────────────── Utilities ─────────────────────── */

export function statusColor(s: OnboardingStatus): string {
  switch (s) {
    case 'PRE_BOARDING': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'DAY_ONE': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'WEEK_1': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'MONTH_1': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'MONTH_3': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'DROPPED': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function riskColor(l: RiskLevel): string {
  switch (l) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function taskStatusColor(s: TaskStatus): string {
  switch (s) {
    case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'IN_PROGRESS': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'PENDING': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'OVERDUE': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'SKIPPED': return 'bg-slate-700/20 text-slate-500 border-slate-600/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function categoryColor(c: MilestoneCategory): string {
  switch (c) {
    case 'COMPLIANCE': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'EQUIPMENT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'TRAINING': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'SOCIAL': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'PERFORMANCE': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function trendIcon(t: TrendDirection): string {
  return t === 'UP' ? '↑' : t === 'DOWN' ? '↓' : '→';
}

export function trendColor(t: TrendDirection): string {
  return t === 'UP' ? 'text-emerald-400' : t === 'DOWN' ? 'text-red-400' : 'text-slate-400';
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export function formatNumber(v: number): string { return new Intl.NumberFormat('en-US').format(v); }
