/* ═══════════════════════════════════════════════════════════════
   Employee Engagement & Sentiment Analytics — Service Layer
   Types, seed data, mock generators, and utility helpers.
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────── Types ─────────────────────────── */

export type SentimentLabel = 'VERY_POSITIVE' | 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'VERY_NEGATIVE';
export type SurveyStatus = 'ACTIVE' | 'DRAFT' | 'CLOSED' | 'ARCHIVED';
export type ActionPlanStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
export type ActionPlanPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EngagementRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

export interface PulseSurvey {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  createdAt: string;
  closesAt: string;
  questions: SurveyQuestion[];
  responseRate: number;
  totalResponses: number;
  totalInvited: number;
  avgScore: number;
  sentimentBreakdown: SentimentBreakdown;
  departmentId: string;
  departmentName: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'LIKERT_5' | 'NPS' | 'YES_NO' | 'OPEN_ENDED';
  avgScore?: number;
  distribution?: number[];
}

export interface SentimentBreakdown {
  veryPositive: number;
  positive: number;
  neutral: number;
  negative: number;
  veryNegative: number;
}

export interface DepartmentEngagement {
  id: string;
  name: string;
  headcount: number;
  eNPS: number;
  eNPSTrend: TrendDirection;
  engagementScore: number;
  engagementTrend: TrendDirection;
  pulseScore: number;
  pulseTrend: TrendDirection;
  burnoutRisk: EngagementRiskLevel;
  activeSurveys: number;
  lastPulseDate: string;
  topConcern: string;
  topStrength: string;
  retentionRisk: number;
}

export interface EngagementActionPlan {
  id: string;
  title: string;
  description: string;
  owner: string;
  ownerAvatar: string;
  departmentId: string;
  departmentName: string;
  status: ActionPlanStatus;
  priority: ActionPlanPriority;
  createdAt: string;
  dueDate: string;
  completedAt: string | null;
  relatedSurveyId: string;
  milestones: ActionMilestone[];
  tags: string[];
}

export interface ActionMilestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
}

export interface EngagementActivity {
  id: string;
  timestamp: string;
  type: 'SURVEY_LAUNCHED' | 'SURVEY_CLOSED' | 'ACTION_PLAN_CREATED' | 'ACTION_PLAN_COMPLETED' | 'MILESTONE_REACHED' | 'THRESHOLD_ALERT' | 'DEPARTMENT_UPDATE' | 'ENPS_CHANGE';
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  departmentName: string | null;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  metadata?: Record<string, string | number>;
}

export interface EngagementKPI {
  label: string;
  value: string;
  subtitle: string;
  trend: TrendDirection;
  trendValue: string;
  icon: string;
  colorClass: string;
  bgClass: string;
}

export interface SentimentTrendPoint {
  date: string;
  score: number;
  responses: number;
}

export interface BurnoutIndicator {
  departmentId: string;
  departmentName: string;
  workloadScore: number;
  overtimeHours: number;
  ptoUtilization: number;
  surveySentiment: number;
  riskLevel: EngagementRiskLevel;
  riskFactors: string[];
}

/* ─────────────────────── Seed Data ─────────────────────── */

export const SEED_SURVEYS: PulseSurvey[] = [
  {
    id: 'SRV-401',
    title: 'Q3 2026 Culture Pulse Check',
    description: 'Quarterly engagement pulse covering collaboration, leadership trust, growth opportunities, and work-life balance.',
    status: 'ACTIVE',
    createdAt: '2026-08-01T09:00:00Z',
    closesAt: '2026-08-31T23:59:59Z',
    questions: [
      { id: 'Q1', text: 'I feel valued and recognized for my contributions.', type: 'LIKERT_5', avgScore: 4.1, distribution: [3, 5, 12, 38, 42] },
      { id: 'Q2', text: 'My manager provides clear and constructive feedback.', type: 'LIKERT_5', avgScore: 3.8, distribution: [5, 8, 18, 41, 28] },
      { id: 'Q3', text: 'I have the tools and resources I need to succeed.', type: 'LIKERT_5', avgScore: 4.3, distribution: [2, 4, 9, 35, 50] },
      { id: 'Q4', text: 'How likely are you to recommend PaySphere as a great place to work?', type: 'NPS', avgScore: 72 },
      { id: 'Q5', text: 'I feel supported in maintaining a healthy work-life balance.', type: 'LIKERT_5', avgScore: 3.5, distribution: [8, 12, 22, 35, 23] },
    ],
    responseRate: 78,
    totalResponses: 312,
    totalInvited: 400,
    avgScore: 3.92,
    sentimentBreakdown: { veryPositive: 28, positive: 35, neutral: 22, negative: 11, veryNegative: 4 },
    departmentId: 'ALL',
    departmentName: 'All Departments',
  },
  {
    id: 'SRV-402',
    title: 'Engineering Team Wellbeing Survey',
    description: 'Targeted pulse for engineering org covering sprint fatigue, code review load, and on-call satisfaction.',
    status: 'ACTIVE',
    createdAt: '2026-08-05T10:00:00Z',
    closesAt: '2026-08-25T23:59:59Z',
    questions: [
      { id: 'EQ1', text: 'Sprint velocity is sustainable long-term.', type: 'LIKERT_5', avgScore: 3.2, distribution: [12, 15, 25, 30, 18] },
      { id: 'EQ2', text: 'On-call rotations are fairly distributed.', type: 'LIKERT_5', avgScore: 3.6, distribution: [6, 10, 20, 38, 26] },
      { id: 'EQ3', text: 'Code review turnaround does not block my progress.', type: 'LIKERT_5', avgScore: 2.9, distribution: [18, 22, 28, 20, 12] },
    ],
    responseRate: 85,
    totalResponses: 85,
    totalInvited: 100,
    avgScore: 3.23,
    sentimentBreakdown: { veryPositive: 15, positive: 25, neutral: 30, negative: 22, veryNegative: 8 },
    departmentId: 'DEPT-ENG',
    departmentName: 'Engineering',
  },
  {
    id: 'SRV-403',
    title: 'HR Onboarding Experience Feedback',
    description: 'Post-onboarding survey for employees who joined in the last 60 days.',
    status: 'CLOSED',
    createdAt: '2026-07-01T09:00:00Z',
    closesAt: '2026-07-31T23:59:59Z',
    questions: [
      { id: 'HO1', text: 'The onboarding process was well-organized.', type: 'LIKERT_5', avgScore: 4.4, distribution: [1, 3, 8, 32, 56] },
      { id: 'HO2', text: 'I felt welcome and included from day one.', type: 'LIKERT_5', avgScore: 4.6, distribution: [0, 2, 5, 28, 65] },
      { id: 'HO3', text: 'My onboarding buddy was helpful and available.', type: 'LIKERT_5', avgScore: 4.2, distribution: [2, 5, 10, 35, 48] },
    ],
    responseRate: 92,
    totalResponses: 46,
    totalInvited: 50,
    avgScore: 4.40,
    sentimentBreakdown: { veryPositive: 42, positive: 35, neutral: 15, negative: 6, veryNegative: 2 },
    departmentId: 'ALL',
    departmentName: 'All Departments',
  },
  {
    id: 'SRV-404',
    title: 'Remote Work Policy Satisfaction',
    description: 'Assess employee satisfaction with current hybrid/remote work arrangements and commute support.',
    status: 'DRAFT',
    createdAt: '2026-08-18T14:00:00Z',
    closesAt: '2026-09-15T23:59:59Z',
    questions: [
      { id: 'RW1', text: 'The current hybrid policy meets my needs.', type: 'LIKERT_5' },
      { id: 'RW2', text: 'I have adequate home office equipment.', type: 'YES_NO' },
      { id: 'RW3', text: 'I feel connected to my team while working remotely.', type: 'LIKERT_5' },
    ],
    responseRate: 0,
    totalResponses: 0,
    totalInvited: 380,
    avgScore: 0,
    sentimentBreakdown: { veryPositive: 0, positive: 0, neutral: 0, negative: 0, veryNegative: 0 },
    departmentId: 'ALL',
    departmentName: 'All Departments',
  },
];

export const SEED_DEPARTMENTS: DepartmentEngagement[] = [
  { id: 'DEPT-ENG', name: 'Engineering', headcount: 100, eNPS: 58, eNPSTrend: 'UP', engagementScore: 76, engagementTrend: 'UP', pulseScore: 3.2, pulseTrend: 'DOWN', burnoutRisk: 'HIGH', activeSurveys: 1, lastPulseDate: '2026-08-18', topConcern: 'Sprint velocity unsustainable', topStrength: 'Technical mentorship culture', retentionRisk: 18 },
  { id: 'DEPT-PROD', name: 'Product', headcount: 45, eNPS: 72, eNPSTrend: 'UP', engagementScore: 82, engagementTrend: 'FLAT', pulseScore: 4.1, pulseTrend: 'UP', burnoutRisk: 'LOW', activeSurveys: 0, lastPulseDate: '2026-08-12', topConcern: 'Cross-team alignment', topStrength: 'Clear product vision', retentionRisk: 5 },
  { id: 'DEPT-HR', name: 'Human Resources', headcount: 30, eNPS: 81, eNPSTrend: 'UP', engagementScore: 88, engagementTrend: 'UP', pulseScore: 4.4, pulseTrend: 'UP', burnoutRisk: 'LOW', activeSurveys: 1, lastPulseDate: '2026-08-15', topConcern: 'Recruiting bandwidth', topStrength: 'Strong team cohesion', retentionRisk: 3 },
  { id: 'DEPT-FIN', name: 'Finance & Accounting', headcount: 55, eNPS: 45, eNPSTrend: 'DOWN', engagementScore: 68, engagementTrend: 'DOWN', pulseScore: 3.0, pulseTrend: 'DOWN', burnoutRisk: 'MEDIUM', activeSurveys: 0, lastPulseDate: '2026-08-10', topConcern: 'Month-end overtime burden', topStrength: 'Process automation gains', retentionRisk: 12 },
  { id: 'DEPT-SALES', name: 'Sales', headcount: 70, eNPS: 64, eNPSTrend: 'FLAT', engagementScore: 74, engagementTrend: 'UP', pulseScore: 3.6, pulseTrend: 'UP', burnoutRisk: 'MEDIUM', activeSurveys: 0, lastPulseDate: '2026-08-14', topConcern: 'Quota pressure', topStrength: 'Winning team energy', retentionRisk: 9 },
  { id: 'DEPT-CS', name: 'Customer Success', headcount: 40, eNPS: 52, eNPSTrend: 'DOWN', engagementScore: 70, engagementTrend: 'FLAT', pulseScore: 3.3, pulseTrend: 'DOWN', burnoutRisk: 'HIGH', activeSurveys: 1, lastPulseDate: '2026-08-16', topConcern: 'Escalation fatigue', topStrength: 'Customer empathy', retentionRisk: 15 },
  { id: 'DEPT-MKTG', name: 'Marketing', headcount: 35, eNPS: 69, eNPSTrend: 'UP', engagementScore: 79, engagementTrend: 'UP', pulseScore: 3.9, pulseTrend: 'UP', burnoutRisk: 'LOW', activeSurveys: 0, lastPulseDate: '2026-08-11', topConcern: 'Brand consistency', topStrength: 'Creative autonomy', retentionRisk: 6 },
  { id: 'DEPT-OPS', name: 'Operations', headcount: 25, eNPS: 41, eNPSTrend: 'DOWN', engagementScore: 62, engagementTrend: 'DOWN', pulseScore: 2.8, pulseTrend: 'DOWN', burnoutRisk: 'CRITICAL', activeSurveys: 0, lastPulseDate: '2026-08-09', topConcern: 'Understaffing during peak', topStrength: 'Resilience under pressure', retentionRisk: 22 },
];

export const SEED_ACTION_PLANS: EngagementActionPlan[] = [
  {
    id: 'AP-201',
    title: 'Engineering Sprint Sustainability Initiative',
    description: 'Address unsustainable sprint velocity by introducing capacity planning workshops, reducing WIP limits, and establishing engineering health metrics.',
    owner: 'Sarah Chen',
    ownerAvatar: 'SC',
    departmentId: 'DEPT-ENG',
    departmentName: 'Engineering',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    createdAt: '2026-08-05T10:00:00Z',
    dueDate: '2026-10-31T23:59:59Z',
    completedAt: null,
    relatedSurveyId: 'SRV-402',
    milestones: [
      { id: 'MS-1', title: 'Conduct capacity planning workshop', completed: true, completedAt: '2026-08-12T14:00:00Z' },
      { id: 'MS-2', title: 'Implement WIP limits in Jira', completed: true, completedAt: '2026-08-15T11:30:00Z' },
      { id: 'MS-3', title: 'Deploy engineering health dashboard', completed: false, completedAt: null },
      { id: 'MS-4', title: 'Run follow-up pulse survey', completed: false, completedAt: null },
      { id: 'MS-5', title: 'Review outcomes with VPE', completed: false, completedAt: null },
    ],
    tags: ['sustainability', 'engineering', 'capacity'],
  },
  {
    id: 'AP-202',
    title: 'Finance Month-End Overtime Reduction',
    description: 'Reduce month-end overtime burden through process automation, shift-left reconciliation, and cross-training for critical close activities.',
    owner: 'Michael Torres',
    ownerAvatar: 'MT',
    departmentId: 'DEPT-FIN',
    departmentName: 'Finance & Accounting',
    status: 'NOT_STARTED',
    priority: 'HIGH',
    createdAt: '2026-08-14T09:00:00Z',
    dueDate: '2026-11-30T23:59:59Z',
    completedAt: null,
    relatedSurveyId: 'SRV-401',
    milestones: [
      { id: 'MS-6', title: 'Map month-end close process', completed: false, completedAt: null },
      { id: 'MS-7', title: 'Identify top 5 automation opportunities', completed: false, completedAt: null },
      { id: 'MS-8', title: 'Implement auto-reconciliation for top 3 workflows', completed: false, completedAt: null },
      { id: 'MS-9', title: 'Cross-train team on critical paths', completed: false, completedAt: null },
    ],
    tags: ['overtime', 'finance', 'automation'],
  },
  {
    id: 'AP-203',
    title: 'Operations Staffing & Resilience Program',
    description: 'Address critical burnout risk in Operations through targeted hiring, temporary staffing surge, and mandatory PTO enforcement.',
    owner: 'Lisa Park',
    ownerAvatar: 'LP',
    departmentId: 'DEPT-OPS',
    departmentName: 'Operations',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    createdAt: '2026-08-10T11:00:00Z',
    dueDate: '2026-09-30T23:59:59Z',
    completedAt: null,
    relatedSurveyId: 'SRV-401',
    milestones: [
      { id: 'MS-10', title: 'Post 3 operations specialist roles', completed: true, completedAt: '2026-08-12T16:00:00Z' },
      { id: 'MS-11', title: 'Engage temp staffing vendor', completed: true, completedAt: '2026-08-14T10:00:00Z' },
      { id: 'MS-12', title: 'Enforce mandatory PTO policy', completed: false, completedAt: null },
      { id: 'MS-13', title: 'Onboard 2 new hires', completed: false, completedAt: null },
    ],
    tags: ['staffing', 'burnout', 'critical'],
  },
  {
    id: 'AP-204',
    title: 'Customer Success Escalation Fatigue Mitigation',
    description: 'Reduce CS escalation fatigue through tiered support model, automated triage, and expanded knowledge base.',
    owner: 'David Kim',
    ownerAvatar: 'DK',
    departmentId: 'DEPT-CS',
    departmentName: 'Customer Success',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    createdAt: '2026-08-12T08:00:00Z',
    dueDate: '2026-10-15T23:59:59Z',
    completedAt: null,
    relatedSurveyId: 'SRV-401',
    milestones: [
      { id: 'MS-14', title: 'Define escalation tier framework', completed: true, completedAt: '2026-08-16T09:00:00Z' },
      { id: 'MS-15', title: 'Deploy automated triage rules', completed: false, completedAt: null },
      { id: 'MS-16', title: 'Publish 50 new KB articles', completed: false, completedAt: null },
    ],
    tags: ['escalation', 'customer-success', 'support'],
  },
  {
    id: 'AP-205',
    title: 'Company-Wide Recognition Program Launch',
    description: 'Launch peer-to-peer recognition program with kudos rewards, manager spotlights, and quarterly recognition ceremonies.',
    owner: 'Aisha Okafor',
    ownerAvatar: 'AO',
    departmentId: 'ALL',
    departmentName: 'All Departments',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    createdAt: '2026-06-15T10:00:00Z',
    dueDate: '2026-08-31T23:59:59Z',
    completedAt: '2026-08-18T16:00:00Z',
    relatedSurveyId: 'SRV-401',
    milestones: [
      { id: 'MS-17', title: 'Design recognition framework', completed: true, completedAt: '2026-07-01T12:00:00Z' },
      { id: 'MS-18', title: 'Build kudos platform integration', completed: true, completedAt: '2026-07-20T14:00:00Z' },
      { id: 'MS-19', title: 'Pilot with 3 departments', completed: true, completedAt: '2026-08-05T10:00:00Z' },
      { id: 'MS-20', title: 'Company-wide rollout', completed: true, completedAt: '2026-08-18T16:00:00Z' },
    ],
    tags: ['recognition', 'culture', 'company-wide'],
  },
];

export const SEED_ACTIVITIES: EngagementActivity[] = [
  { id: 'ACT-801', timestamp: '2026-08-20T14:30:00Z', type: 'THRESHOLD_ALERT', title: 'Burnout Risk Alert — Operations', description: 'Operations department crossed critical burnout threshold. PTO utilization dropped to 42% with overtime averaging 14 hrs/week.', actorName: 'System', actorRole: 'Automated', departmentName: 'Operations', severity: 'ALERT' },
  { id: 'ACT-802', timestamp: '2026-08-20T13:15:00Z', type: 'SURVEY_LAUNCHED', title: 'Engineering Wellbeing Survey Launched', description: '85 of 100 engineers invited to participate. Survey closes Aug 25.', actorName: 'Sarah Chen', actorRole: 'VP Engineering', departmentName: 'Engineering', severity: 'INFO' },
  { id: 'ACT-803', timestamp: '2026-08-20T11:45:00Z', type: 'MILESTONE_REACHED', title: 'Milestone: WIP Limits Implemented', description: 'Engineering sprint sustainability plan reached 2 of 5 milestones. WIP limits now active in Jira.', actorName: 'Sarah Chen', actorRole: 'VP Engineering', departmentName: 'Engineering', severity: 'SUCCESS' },
  { id: 'ACT-804', timestamp: '2026-08-20T10:00:00Z', type: 'ENPS_CHANGE', title: 'Finance eNPS Dropped Below 50', description: 'Finance eNPS declined from 52 to 45 over the past 30 days. Primary driver: month-end overtime concerns.', actorName: 'System', actorRole: 'Automated', departmentName: 'Finance & Accounting', severity: 'WARNING' },
  { id: 'ACT-805', timestamp: '2026-08-19T16:20:00Z', type: 'ACTION_PLAN_CREATED', title: 'New Action Plan: CS Escalation Fatigue', description: 'David Kim created action plan to address Customer Success escalation fatigue through tiered support.', actorName: 'David Kim', actorRole: 'Head of Customer Success', departmentName: 'Customer Success', severity: 'INFO' },
  { id: 'ACT-806', timestamp: '2026-08-18T16:00:00Z', type: 'ACTION_PLAN_COMPLETED', title: 'Recognition Program Fully Deployed', description: 'Company-wide peer recognition program launched. Kudos platform active for all 400 employees.', actorName: 'Aisha Okafor', actorRole: 'Chief People Officer', departmentName: 'All Departments', severity: 'SUCCESS' },
  { id: 'ACT-807', timestamp: '2026-08-18T09:00:00Z', type: 'SURVEY_CLOSED', title: 'Q2 Culture Pulse Closed', description: 'Final response rate: 78%. 312 of 400 employees participated. Avg score: 3.92/5.', actorName: 'Aisha Okafor', actorRole: 'Chief People Officer', departmentName: 'All Departments', severity: 'INFO' },
  { id: 'ACT-808', timestamp: '2026-08-17T14:30:00Z', type: 'DEPARTMENT_UPDATE', title: 'Operations Staffing Update', description: '2 of 3 open operations roles posted. Temp staffing vendor engaged for immediate coverage.', actorName: 'Lisa Park', actorRole: 'Director of Operations', departmentName: 'Operations', severity: 'INFO' },
  { id: 'ACT-809', timestamp: '2026-08-16T11:00:00Z', type: 'MILESTONE_REACHED', title: 'Milestone: Escalation Tier Framework Defined', description: 'CS team completed tier framework design. 3-tier model approved by leadership.', actorName: 'David Kim', actorRole: 'Head of Customer Success', departmentName: 'Customer Success', severity: 'SUCCESS' },
  { id: 'ACT-810', timestamp: '2026-08-15T09:30:00Z', type: 'THRESHOLD_ALERT', title: 'Engineering Pulse Score Dip', description: 'Engineering pulse score dropped from 3.5 to 3.2 over 2 surveys. Code review turnaround flagged as top concern.', actorName: 'System', actorRole: 'Automated', departmentName: 'Engineering', severity: 'WARNING' },
];

export const SEED_SENTIMENT_TRENDS: SentimentTrendPoint[] = [
  { date: '2026-03', score: 3.65, responses: 280 },
  { date: '2026-04', score: 3.72, responses: 295 },
  { date: '2026-05', score: 3.78, responses: 310 },
  { date: '2026-06', score: 3.81, responses: 320 },
  { date: '2026-07', score: 3.85, responses: 305 },
  { date: '2026-08', score: 3.92, responses: 312 },
];

export const SEED_BURNOUT_INDICATORS: BurnoutIndicator[] = [
  { departmentId: 'DEPT-OPS', departmentName: 'Operations', workloadScore: 88, overtimeHours: 14.2, ptoUtilization: 42, surveySentiment: 2.8, riskLevel: 'CRITICAL', riskFactors: ['High overtime', 'Low PTO usage', 'Understaffed', 'Declining sentiment'] },
  { departmentId: 'DEPT-ENG', departmentName: 'Engineering', workloadScore: 79, overtimeHours: 8.5, ptoUtilization: 58, surveySentiment: 3.2, riskLevel: 'HIGH', riskFactors: ['Sprint fatigue', 'Code review bottleneck', 'On-call burden'] },
  { departmentId: 'DEPT-CS', departmentName: 'Customer Success', workloadScore: 72, overtimeHours: 6.8, ptoUtilization: 55, surveySentiment: 3.3, riskLevel: 'HIGH', riskFactors: ['Escalation fatigue', 'Emotional labor'] },
  { departmentId: 'DEPT-FIN', departmentName: 'Finance & Accounting', workloadScore: 68, overtimeHours: 7.1, ptoUtilization: 61, surveySentiment: 3.0, riskLevel: 'MEDIUM', riskFactors: ['Month-end crunch', 'Repetitive close tasks'] },
  { departmentId: 'DEPT-SALES', departmentName: 'Sales', workloadScore: 65, overtimeHours: 5.4, ptoUtilization: 63, surveySentiment: 3.6, riskLevel: 'MEDIUM', riskFactors: ['Quota pressure', 'Travel fatigue'] },
  { departmentId: 'DEPT-MKTG', departmentName: 'Marketing', workloadScore: 48, overtimeHours: 3.2, ptoUtilization: 72, surveySentiment: 3.9, riskLevel: 'LOW', riskFactors: ['Campaign deadlines'] },
  { departmentId: 'DEPT-PROD', departmentName: 'Product', workloadScore: 42, overtimeHours: 2.8, ptoUtilization: 78, surveySentiment: 4.1, riskLevel: 'LOW', riskFactors: [] },
  { departmentId: 'DEPT-HR', departmentName: 'Human Resources', workloadScore: 38, overtimeHours: 2.1, ptoUtilization: 82, surveySentiment: 4.4, riskLevel: 'LOW', riskFactors: [] },
];

/* ─────────────────────── Utility Helpers ─────────────────────── */

export function sentimentColor(label: SentimentLabel): string {
  switch (label) {
    case 'VERY_POSITIVE': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'POSITIVE': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'NEUTRAL': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'NEGATIVE': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'VERY_NEGATIVE': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'DRAFT': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'CLOSED': return 'bg-slate-700/20 text-slate-500 border-slate-600/30';
    case 'ARCHIVED': return 'bg-slate-800/20 text-slate-600 border-slate-700/30';
    case 'IN_PROGRESS': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'NOT_STARTED': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'OVERDUE': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function priorityColor(priority: ActionPlanPriority): string {
  switch (priority) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function burnoutColor(level: EngagementRiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'MEDIUM': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'LOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function trendIcon(trend: TrendDirection): string {
  switch (trend) {
    case 'UP': return '↑';
    case 'DOWN': return '↓';
    case 'FLAT': return '→';
    default: return '→';
  }
}

export function trendColor(trend: TrendDirection): string {
  switch (trend) {
    case 'UP': return 'text-emerald-400';
    case 'DOWN': return 'text-red-400';
    case 'FLAT': return 'text-slate-400';
    default: return 'text-slate-400';
  }
}

export function activitySeverityColor(severity: EngagementActivity['severity']): string {
  switch (severity) {
    case 'ALERT': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'WARNING': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'SUCCESS': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'INFO': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
  }
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatRelativeTime(timestamp: string): string {
  const now = new Date('2026-08-20T15:00:00Z');
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
