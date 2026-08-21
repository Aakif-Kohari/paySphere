/* ═══════════════════════════════════════════════════════════════
   Workforce Intelligence & Predictive Analytics — Service Layer
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────── Types ─────────────────────────── */

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AttritionCategory = 'VOLUNTARY' | 'INVOLUNTARY' | 'RETIREMENT' | 'INTERNAL';
export type CompensationBand = 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET';

export interface HeadcountSnapshot {
  month: string;
  total: number;
  engineering: number;
  product: number;
  sales: number;
  operations: number;
  hr: number;
  finance: number;
  marketing: number;
  customerSuccess: number;
}

export interface AttritionRecord {
  id: string;
  employeeName: string;
  department: string;
  role: string;
  tenure: string;
  tenureMonths: number;
  category: AttritionCategory;
  exitDate: string;
  riskScore: number;
  lastEngagementScore: number;
  replacementCost: number;
  exitReason: string;
}

export interface CompensationBenchmark {
  role: string;
  department: string;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  currentAvg: number;
  band: CompensationBand;
  headcount: number;
  budgetImpact: number;
}

export interface AttritionRiskProfile {
  department: string;
  lowTenure: number;
  midTenure: number;
  highTenure: number;
  overallRisk: RiskLevel;
  predictedAttrition: number;
  retentionActions: string[];
}

export interface WorkforceKPI {
  label: string;
  value: string;
  subtitle: string;
  trend: TrendDirection;
  trendValue: string;
  icon: string;
  colorClass: string;
  bgClass: string;
}

export interface TimeToHireMetric {
  department: string;
  avgDays: number;
  medianDays: number;
  p90Days: number;
  openRoles: number;
  filledLast30d: number;
  trend: TrendDirection;
}

export interface DiversityMetric {
  department: string;
  genderParity: number;
  ethnicityIndex: number;
  ageDiversity: number;
  leadershipParity: number;
  overallScore: number;
  trend: TrendDirection;
}

export interface TurnoverTrend {
  month: string;
  voluntaryRate: number;
  involuntaryRate: number;
  totalRate: number;
  industryAvg: number;
}

/* ─────────────────────── Seed Data ─────────────────────── */

export const SEED_HEADCOUNT: HeadcountSnapshot[] = [
  { month: '2026-03', total: 370, engineering: 90, product: 40, sales: 65, operations: 22, hr: 28, finance: 50, marketing: 32, customerSuccess: 35 },
  { month: '2026-04', total: 378, engineering: 93, product: 41, sales: 67, operations: 22, hr: 28, finance: 51, marketing: 33, customerSuccess: 36 },
  { month: '2026-05', total: 385, engineering: 95, product: 42, sales: 68, operations: 23, hr: 29, finance: 52, marketing: 34, customerSuccess: 37 },
  { month: '2026-06', total: 390, engineering: 97, product: 43, sales: 69, operations: 23, hr: 29, finance: 53, marketing: 34, customerSuccess: 38 },
  { month: '2026-07', total: 395, engineering: 98, product: 44, sales: 70, operations: 24, hr: 30, finance: 54, marketing: 35, customerSuccess: 40 },
  { month: '2026-08', total: 400, engineering: 100, product: 45, sales: 70, operations: 25, hr: 30, finance: 55, marketing: 35, customerSuccess: 40 },
];

export const SEED_ATTRITION: AttritionRecord[] = [
  { id: 'ATR-001', employeeName: 'James Wilson', department: 'Operations', role: 'Logistics Coordinator', tenure: '1.2 years', tenureMonths: 14, category: 'VOLUNTARY', exitDate: '2026-08-18', riskScore: 92, lastEngagementScore: 2.1, replacementCost: 28500, exitReason: 'Burnout from sustained overtime' },
  { id: 'ATR-002', employeeName: 'Rachel Adams', department: 'Engineering', role: 'Senior Backend Engineer', tenure: '3.1 years', tenureMonths: 37, category: 'VOLUNTARY', exitDate: '2026-08-15', riskScore: 87, lastEngagementScore: 2.8, replacementCost: 65000, exitReason: 'Better comp offer from competitor' },
  { id: 'ATR-003', employeeName: 'Mike Thompson', department: 'Customer Success', role: 'CS Manager', tenure: '2.4 years', tenureMonths: 29, category: 'VOLUNTARY', exitDate: '2026-08-12', riskScore: 78, lastEngagementScore: 3.0, replacementCost: 52000, exitReason: 'Escalation fatigue and role stagnation' },
  { id: 'ATR-004', employeeName: 'Lisa Chang', department: 'Finance', role: 'Senior Accountant', tenure: '4.5 years', tenureMonths: 54, category: 'INTERNAL', exitDate: '2026-08-10', riskScore: 25, lastEngagementScore: 4.2, replacementCost: 15000, exitReason: 'Transferred to Product team' },
  { id: 'ATR-005', employeeName: 'David Brown', department: 'Operations', role: 'Warehouse Lead', tenure: '5.8 years', tenureMonths: 70, category: 'RETIREMENT', exitDate: '2026-08-08', riskScore: 10, lastEngagementScore: 4.5, replacementCost: 42000, exitReason: 'Early retirement package' },
  { id: 'ATR-006', employeeName: 'Emma Rodriguez', department: 'Sales', role: 'Account Executive', tenure: '1.8 years', tenureMonths: 22, category: 'VOLUNTARY', exitDate: '2026-08-05', riskScore: 83, lastEngagementScore: 2.5, replacementCost: 45000, exitReason: 'Quota pressure and territory disputes' },
  { id: 'ATR-007', employeeName: 'Tom Nguyen', department: 'Engineering', role: 'Frontend Developer', tenure: '0.9 years', tenureMonths: 11, category: 'VOLUNTARY', exitDate: '2026-08-01', riskScore: 95, lastEngagementScore: 1.8, replacementCost: 38000, exitReason: 'On-call burden and sprint fatigue' },
  { id: 'ATR-008', employeeName: 'Priya Sharma', department: 'Marketing', role: 'Content Strategist', tenure: '2.1 years', tenureMonths: 25, category: 'INVOLUNTARY', exitDate: '2026-07-28', riskScore: 0, lastEngagementScore: 3.2, replacementCost: 22000, exitReason: 'Role eliminated in restructure' },
];

export const SEED_COMPENSATION: CompensationBenchmark[] = [
  { role: 'Senior Software Engineer', department: 'Engineering', p25: 125000, p50: 155000, p75: 185000, p90: 220000, currentAvg: 162000, band: 'AT_MARKET', headcount: 22, budgetImpact: 154000 },
  { role: 'Engineering Manager', department: 'Engineering', p25: 155000, p50: 185000, p75: 220000, p90: 260000, currentAvg: 198000, band: 'AT_MARKET', headcount: 8, budgetImpact: 104000 },
  { role: 'Product Manager', department: 'Product', p25: 115000, p50: 140000, p75: 170000, p90: 200000, currentAvg: 148000, band: 'AT_MARKET', headcount: 6, budgetImpact: 48000 },
  { role: 'Account Executive', department: 'Sales', p25: 75000, p50: 95000, p75: 125000, p90: 160000, currentAvg: 88000, band: 'BELOW_MARKET', headcount: 18, budgetImpact: -126000 },
  { role: 'Data Analyst', department: 'Finance', p25: 68000, p50: 85000, p75: 105000, p90: 130000, currentAvg: 92000, band: 'AT_MARKET', headcount: 5, budgetImpact: 35000 },
  { role: 'CS Manager', department: 'Customer Success', p25: 90000, p50: 115000, p75: 140000, p90: 170000, currentAvg: 108000, band: 'BELOW_MARKET', headcount: 4, budgetImpact: -28000 },
  { role: 'Marketing Specialist', department: 'Marketing', p25: 55000, p50: 72000, p75: 92000, p90: 115000, currentAvg: 78000, band: 'AT_MARKET', headcount: 7, budgetImpact: 42000 },
  { role: 'HR Business Partner', department: 'HR', p25: 80000, p50: 100000, p75: 125000, p90: 155000, currentAvg: 105000, band: 'AT_MARKET', headcount: 3, budgetImpact: 15000 },
];

export const SEED_ATTRITION_RISK: AttritionRiskProfile[] = [
  { department: 'Operations', lowTenure: 85, midTenure: 60, highTenure: 20, overallRisk: 'CRITICAL', predictedAttrition: 28, retentionActions: ['Hire 3 specialists', 'Enforce mandatory PTO', 'Reduce overtime cap'] },
  { department: 'Engineering', lowTenure: 78, midTenure: 45, highTenure: 15, overallRisk: 'HIGH', predictedAttrition: 18, retentionActions: ['Reduce on-call burden', 'Increase equity grants', 'Sprint capacity reset'] },
  { department: 'Customer Success', lowTenure: 70, midTenure: 50, highTenure: 18, overallRisk: 'HIGH', predictedAttrition: 15, retentionActions: ['Tiered support model', 'Career path clarity', 'Recognition program'] },
  { department: 'Sales', lowTenure: 55, midTenure: 35, highTenure: 12, overallRisk: 'MEDIUM', predictedAttrition: 12, retentionActions: ['Quota rebalancing', 'Territory fairness audit', 'Accelerator improvements'] },
  { department: 'Finance', lowTenure: 40, midTenure: 30, highTenure: 10, overallRisk: 'MEDIUM', predictedAttrition: 8, retentionActions: ['Month-end automation', 'Cross-training program', 'Comp review'] },
  { department: 'Marketing', lowTenure: 30, midTenure: 22, highTenure: 8, overallRisk: 'LOW', predictedAttrition: 6, retentionActions: ['Budget increase for campaigns'] },
  { department: 'Product', lowTenure: 25, midTenure: 18, highTenure: 5, overallRisk: 'LOW', predictedAttrition: 5, retentionActions: ['Conference budget expansion'] },
  { department: 'HR', lowTenure: 20, midTenure: 15, highTenure: 5, overallRisk: 'LOW', predictedAttrition: 3, retentionActions: [] },
];

export const SEED_TTH: TimeToHireMetric[] = [
  { department: 'Engineering', avgDays: 42, medianDays: 38, p90Days: 68, openRoles: 12, filledLast30d: 3, trend: 'DOWN' },
  { department: 'Sales', avgDays: 35, medianDays: 32, p90Days: 55, openRoles: 8, filledLast30d: 5, trend: 'FLAT' },
  { department: 'Product', avgDays: 38, medianDays: 35, p90Days: 58, openRoles: 3, filledLast30d: 1, trend: 'DOWN' },
  { department: 'Operations', avgDays: 28, medianDays: 25, p90Days: 42, openRoles: 6, filledLast30d: 2, trend: 'DOWN' },
  { department: 'Customer Success', avgDays: 32, medianDays: 30, p90Days: 48, openRoles: 4, filledLast30d: 1, trend: 'UP' },
  { department: 'Finance', avgDays: 40, medianDays: 36, p90Days: 62, openRoles: 2, filledLast30d: 0, trend: 'FLAT' },
];

export const SEED_DIVERSITY: DiversityMetric[] = [
  { department: 'Engineering', genderParity: 0.68, ethnicityIndex: 0.72, ageDiversity: 0.81, leadershipParity: 0.45, overallScore: 67, trend: 'UP' },
  { department: 'Product', genderParity: 0.75, ethnicityIndex: 0.78, ageDiversity: 0.85, leadershipParity: 0.55, overallScore: 73, trend: 'UP' },
  { department: 'Sales', genderParity: 0.62, ethnicityIndex: 0.70, ageDiversity: 0.78, leadershipParity: 0.40, overallScore: 63, trend: 'FLAT' },
  { department: 'HR', genderParity: 0.82, ethnicityIndex: 0.80, ageDiversity: 0.88, leadershipParity: 0.72, overallScore: 81, trend: 'UP' },
  { department: 'Finance', genderParity: 0.70, ethnicityIndex: 0.75, ageDiversity: 0.82, leadershipParity: 0.50, overallScore: 69, trend: 'UP' },
  { department: 'Marketing', genderParity: 0.78, ethnicityIndex: 0.82, ageDiversity: 0.86, leadershipParity: 0.60, overallScore: 77, trend: 'UP' },
];

export const SEED_TURNOVER_TRENDS: TurnoverTrend[] = [
  { month: '2026-03', voluntaryRate: 1.8, involuntaryRate: 0.4, totalRate: 2.2, industryAvg: 2.5 },
  { month: '2026-04', voluntaryRate: 1.6, involuntaryRate: 0.3, totalRate: 1.9, industryAvg: 2.4 },
  { month: '2026-05', voluntaryRate: 1.9, involuntaryRate: 0.5, totalRate: 2.4, industryAvg: 2.5 },
  { month: '2026-06', voluntaryRate: 2.1, involuntaryRate: 0.4, totalRate: 2.5, industryAvg: 2.6 },
  { month: '2026-07', voluntaryRate: 2.3, involuntaryRate: 0.3, totalRate: 2.6, industryAvg: 2.5 },
  { month: '2026-08', voluntaryRate: 2.0, involuntaryRate: 0.2, totalRate: 2.2, industryAvg: 2.4 },
];

/* ─────────────────────── Utilities ─────────────────────── */

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function bandColor(band: CompensationBand): string {
  switch (band) {
    case 'BELOW_MARKET': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'AT_MARKET': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'ABOVE_MARKET': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function trendIcon(trend: TrendDirection): string {
  return trend === 'UP' ? '↑' : trend === 'DOWN' ? '↓' : '→';
}

export function trendColor(trend: TrendDirection): string {
  return trend === 'UP' ? 'text-emerald-400' : trend === 'DOWN' ? 'text-red-400' : 'text-slate-400';
}

export function categoryColor(cat: AttritionCategory): string {
  switch (cat) {
    case 'VOLUNTARY': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'INVOLUNTARY': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'RETIREMENT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'INTERNAL': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-US').format(val);
}
