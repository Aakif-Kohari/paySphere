import React, { useState, useMemo } from 'react';
import {
  BookOpen, Award, TrendingUp, Users, Search, Filter, Download,
  ChevronRight, Clock, CheckCircle2, AlertTriangle, Target,
  GraduationCap, Sparkles, ShieldCheck, BarChart3, Calendar,
  Brain, Zap, Star, ArrowUpRight, X,
} from 'lucide-react';

/* ------------------------------------------------------------------ *
 *  PaySphere Enterprise Learning & Development Command Hub
 *  ------------------------------------------------------------------
 *  Five consoles for L&D programme oversight:
 *    1. Training Programs    - catalogue, enrolment & completion rates
 *    2. Certifications       - expiry tracking, renewal workflows
 *    3. Skill Gap Analysis   - competency mapping & gap identification
 *    4. Learning Paths       - role-based curricula & progress
 *    5. Compliance Training  - mandatory training adherence
 * ------------------------------------------------------------------ */

/* -- TypeScript Interfaces ------------------------------------------ */

interface TrainingProgram {
  id: string;
  title: string;
  category: string;
  instructor: string;
  duration: string;
  enrolled: number;
  completed: number;
  rating: number;
  status: 'Active' | 'Upcoming' | 'Archived';
  format: 'Live' | 'Self-paced' | 'Hybrid';
  department: string;
  startDate: string;
  skillTags: string[];
}

interface Certification {
  id: string;
  employeeName: string;
  employeeId: string;
  certification: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
  department: string;
  renewalCost: number;
}

interface SkillGap {
  id: string;
  competency: string;
  category: string;
  requiredLevel: number;
  currentLevel: number;
  gapPercent: number;
  employeesAffected: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendedCourse: string;
  department: string;
}

interface LearningPath {
  id: string;
  title: string;
  role: string;
  modules: number;
  completedModules: number;
  enrolled: number;
  avgCompletionDays: number;
  status: 'Active' | 'Draft' | 'Paused';
  targetCompletion: string;
  department: string;
}

interface ComplianceTraining {
  id: string;
  trainingName: string;
  category: string;
  requiredFor: number;
  completed: number;
  overdue: number;
  deadline: string;
  complianceRate: number;
  status: 'Compliant' | 'At Risk' | 'Non-Compliant';
  department: string;
}

/* -- Seed Data ------------------------------------------------------ */

const TRAINING_PROGRAMS: TrainingProgram[] = [
  { id: 'TP-001', title: 'Advanced TypeScript Patterns', category: 'Technical', instructor: 'Dr. Elena Vasquez', duration: '12 hrs', enrolled: 142, completed: 118, rating: 4.8, status: 'Active', format: 'Hybrid', department: 'Engineering', startDate: '2026-07-01', skillTags: ['TypeScript', 'Architecture', 'Design Patterns'] },
  { id: 'TP-002', title: 'Enterprise Security Awareness', category: 'Compliance', instructor: 'Marcus Chen', duration: '4 hrs', enrolled: 487, completed: 401, rating: 4.2, status: 'Active', format: 'Self-paced', department: 'All', startDate: '2026-06-15', skillTags: ['Cybersecurity', 'Phishing', 'Data Privacy'] },
  { id: 'TP-003', title: 'Leadership Foundations', category: 'Soft Skills', instructor: "Sarah O'Brien", duration: '8 hrs', enrolled: 64, completed: 52, rating: 4.6, status: 'Active', format: 'Live', department: 'Management', startDate: '2026-07-10', skillTags: ['Leadership', 'Communication', 'Decision-making'] },
  { id: 'TP-004', title: 'Cloud Infrastructure & DevOps', category: 'Technical', instructor: 'Raj Patel', duration: '20 hrs', enrolled: 89, completed: 34, rating: 4.9, status: 'Active', format: 'Self-paced', department: 'Engineering', startDate: '2026-07-20', skillTags: ['AWS', 'Kubernetes', 'CI/CD'] },
  { id: 'TP-005', title: 'Payroll Compliance Workshop', category: 'Compliance', instructor: 'Legal Team', duration: '6 hrs', enrolled: 210, completed: 198, rating: 4.4, status: 'Active', format: 'Live', department: 'Finance', startDate: '2026-06-01', skillTags: ['Payroll', 'Tax Law', 'Regulation'] },
  { id: 'TP-006', title: 'React Performance Optimization', category: 'Technical', instructor: 'Alex Kim', duration: '10 hrs', enrolled: 76, completed: 45, rating: 4.7, status: 'Active', format: 'Hybrid', department: 'Engineering', startDate: '2026-08-01', skillTags: ['React', 'Performance', 'Profiling'] },
  { id: 'TP-007', title: 'DEI in the Workplace', category: 'Soft Skills', instructor: 'Dr. Maya Johnson', duration: '3 hrs', enrolled: 487, completed: 312, rating: 4.5, status: 'Active', format: 'Self-paced', department: 'All', startDate: '2026-05-20', skillTags: ['DEI', 'Culture', 'Inclusion'] },
  { id: 'TP-008', title: 'Data Analytics with Python', category: 'Technical', instructor: 'Prof. Lin Wei', duration: '16 hrs', enrolled: 54, completed: 12, rating: 4.3, status: 'Upcoming', format: 'Self-paced', department: 'Data', startDate: '2026-09-01', skillTags: ['Python', 'Pandas', 'Visualization'] },
];

const CERTIFICATIONS: Certification[] = [
  { id: 'CT-001', employeeName: 'James Mitchell', employeeId: 'EMP-1042', certification: 'AWS Solutions Architect', issuingBody: 'Amazon Web Services', issueDate: '2024-08-15', expiryDate: '2026-08-15', status: 'Expiring Soon', department: 'Engineering', renewalCost: 300 },
  { id: 'CT-002', employeeName: 'Priya Sharma', employeeId: 'EMP-1078', certification: 'PMP', issuingBody: 'PMI', issueDate: '2023-11-20', expiryDate: '2026-11-20', status: 'Valid', department: 'Project Management', renewalCost: 150 },
  { id: 'CT-003', employeeName: 'Carlos Rodriguez', employeeId: 'EMP-1105', certification: 'CISA', issuingBody: 'ISACA', issueDate: '2023-03-10', expiryDate: '2026-03-10', status: 'Expired', department: 'Security', renewalCost: 450 },
  { id: 'CT-004', employeeName: 'Emily Watson', employeeId: 'EMP-1023', certification: 'SHRM-CP', issuingBody: 'SHRM', issueDate: '2024-06-01', expiryDate: '2026-06-01', status: 'Expired', department: 'HR', renewalCost: 200 },
  { id: 'CT-005', employeeName: 'David Park', employeeId: 'EMP-1091', certification: 'Kubernetes Administrator', issuingBody: 'CNCF', issueDate: '2025-01-15', expiryDate: '2027-01-15', status: 'Valid', department: 'DevOps', renewalCost: 395 },
  { id: 'CT-006', employeeName: 'Aisha Okafor', employeeId: 'EMP-1067', certification: 'CFA Level III', issuingBody: 'CFA Institute', issueDate: '2024-09-30', expiryDate: '2026-09-30', status: 'Valid', department: 'Finance', renewalCost: 250 },
  { id: 'CT-007', employeeName: 'Marcus Chen', employeeId: 'EMP-1034', certification: 'CISSP', issuingBody: 'ISC2', issueDate: '2023-07-22', expiryDate: '2026-07-22', status: 'Expired', department: 'Security', renewalCost: 700 },
  { id: 'CT-008', employeeName: 'Sarah Kim', employeeId: 'EMP-1112', certification: 'Google Cloud Professional', issuingBody: 'Google Cloud', issueDate: '2025-02-10', expiryDate: '2027-02-10', status: 'Valid', department: 'Engineering', renewalCost: 200 },
];

const SKILL_GAPS: SkillGap[] = [
  { id: 'SG-001', competency: 'Kubernetes & Container Orchestration', category: 'Technical', requiredLevel: 80, currentLevel: 42, gapPercent: 47, employeesAffected: 28, priority: 'Critical', recommendedCourse: 'Cloud Infrastructure & DevOps', department: 'Engineering' },
  { id: 'SG-002', competency: 'Advanced TypeScript Patterns', category: 'Technical', requiredLevel: 85, currentLevel: 55, gapPercent: 35, employeesAffected: 34, priority: 'High', recommendedCourse: 'Advanced TypeScript Patterns', department: 'Engineering' },
  { id: 'SG-003', competency: 'Data Privacy Regulations (GDPR/CCPA)', category: 'Compliance', requiredLevel: 90, currentLevel: 62, gapPercent: 31, employeesAffected: 120, priority: 'High', recommendedCourse: 'Enterprise Security Awareness', department: 'All' },
  { id: 'SG-004', competency: 'Leadership & Team Management', category: 'Soft Skills', requiredLevel: 75, currentLevel: 51, gapPercent: 32, employeesAffected: 45, priority: 'Medium', recommendedCourse: 'Leadership Foundations', department: 'Management' },
  { id: 'SG-005', competency: 'React Performance Optimization', category: 'Technical', requiredLevel: 80, currentLevel: 48, gapPercent: 40, employeesAffected: 22, priority: 'High', recommendedCourse: 'React Performance Optimization', department: 'Engineering' },
  { id: 'SG-006', competency: 'Payroll Tax Compliance', category: 'Compliance', requiredLevel: 95, currentLevel: 78, gapPercent: 18, employeesAffected: 15, priority: 'Medium', recommendedCourse: 'Payroll Compliance Workshop', department: 'Finance' },
  { id: 'SG-007', competency: 'Python Data Analytics', category: 'Technical', requiredLevel: 70, currentLevel: 35, gapPercent: 50, employeesAffected: 18, priority: 'Critical', recommendedCourse: 'Data Analytics with Python', department: 'Data' },
  { id: 'SG-008', competency: 'Cloud Security Best Practices', category: 'Technical', requiredLevel: 85, currentLevel: 52, gapPercent: 39, employeesAffected: 31, priority: 'High', recommendedCourse: 'Cloud Infrastructure & DevOps', department: 'Engineering' },
];

const LEARNING_PATHS: LearningPath[] = [
  { id: 'LP-001', title: 'Senior Frontend Engineer Track', role: 'Frontend Engineer', modules: 12, completedModules: 0, enrolled: 18, avgCompletionDays: 90, status: 'Active', targetCompletion: '2026-12-31', department: 'Engineering' },
  { id: 'LP-002', title: 'Engineering Manager Path', role: 'Engineering Manager', modules: 8, completedModules: 0, enrolled: 8, avgCompletionDays: 60, status: 'Active', targetCompletion: '2026-11-30', department: 'Engineering' },
  { id: 'LP-003', title: 'DevOps Specialist Certification', role: 'DevOps Engineer', modules: 15, completedModules: 0, enrolled: 12, avgCompletionDays: 120, status: 'Active', targetCompletion: '2027-03-31', department: 'DevOps' },
  { id: 'LP-004', title: 'HR Business Partner Essentials', role: 'HR Business Partner', modules: 10, completedModules: 0, enrolled: 22, avgCompletionDays: 75, status: 'Active', targetCompletion: '2026-10-31', department: 'HR' },
  { id: 'LP-005', title: 'Financial Analyst Certification', role: 'Financial Analyst', modules: 14, completedModules: 0, enrolled: 15, avgCompletionDays: 100, status: 'Draft', targetCompletion: '2027-01-31', department: 'Finance' },
  { id: 'LP-006', title: 'Cybersecurity Analyst Track', role: 'Security Analyst', modules: 18, completedModules: 0, enrolled: 10, avgCompletionDays: 150, status: 'Active', targetCompletion: '2027-06-30', department: 'Security' },
];

const COMPLIANCE_TRAINING: ComplianceTraining[] = [
  { id: 'CMP-001', trainingName: 'Workplace Safety (OSHA)', category: 'Safety', requiredFor: 487, completed: 462, overdue: 25, deadline: '2026-08-31', complianceRate: 95, status: 'Compliant', department: 'All' },
  { id: 'CMP-002', trainingName: 'Information Security Awareness', category: 'Security', requiredFor: 487, completed: 401, overdue: 86, deadline: '2026-09-30', complianceRate: 82, status: 'At Risk', department: 'All' },
  { id: 'CMP-003', trainingName: 'Anti-Harassment & Discrimination', category: 'HR', requiredFor: 487, completed: 478, overdue: 9, deadline: '2026-08-15', complianceRate: 98, status: 'Compliant', department: 'All' },
  { id: 'CMP-004', trainingName: 'Data Privacy & GDPR Compliance', category: 'Legal', requiredFor: 310, completed: 198, overdue: 112, deadline: '2026-10-31', complianceRate: 64, status: 'Non-Compliant', department: 'Engineering' },
  { id: 'CMP-005', trainingName: 'Anti-Money Laundering (AML)', category: 'Finance', requiredFor: 85, completed: 78, overdue: 7, deadline: '2026-09-15', complianceRate: 92, status: 'Compliant', department: 'Finance' },
  { id: 'CMP-006', trainingName: 'Code of Conduct Annual', category: 'Ethics', requiredFor: 487, completed: 445, overdue: 42, deadline: '2026-08-31', complianceRate: 91, status: 'Compliant', department: 'All' },
  { id: 'CMP-007', trainingName: 'Emergency Response Procedures', category: 'Safety', requiredFor: 487, completed: 320, overdue: 167, deadline: '2026-09-30', complianceRate: 66, status: 'Non-Compliant', department: 'All' },
  { id: 'CMP-008', trainingName: 'Insider Trading Policy', category: 'Finance', requiredFor: 120, completed: 115, overdue: 5, deadline: '2026-10-15', complianceRate: 96, status: 'Compliant', department: 'Finance' },
];

const TABS = [
  { key: 'programs', label: 'Training Programs', icon: BookOpen },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'skillGaps', label: 'Skill Gap Analysis', icon: Target },
  { key: 'learningPaths', label: 'Learning Paths', icon: GraduationCap },
  { key: 'compliance', label: 'Compliance Training', icon: ShieldCheck },
];

/* -- Helpers -------------------------------------------------------- */

const fmt = (n: number) => n.toLocaleString('en-US');
const statusColor = (s: string) => {
  if (s === 'Critical' || s === 'Non-Compliant' || s === 'Expired') return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  if (s === 'High' || s === 'At Risk' || s === 'Expiring Soon') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (s === 'Medium') return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
};
const formatBadge = (f: string) => {
  if (f === 'Live') return 'text-violet-400 bg-violet-500/10 border-violet-500/30';
  if (f === 'Hybrid') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
};

/* -- Stat Card ------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string | number; sub: string; tone: string }) {
  const toneMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-white tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{sub}</p>
        </div>
        <div className={`rounded-xl border p-2.5 ${toneMap[tone]}`}><Icon size={20} /></div>
      </div>
    </div>
  );
}

/* -- Tab 1: Training Programs --------------------------------------- */

function TrainingProgramsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState<TrainingProgram | null>(null);
  const filters = ['All', 'Technical', 'Compliance', 'Soft Skills'];

  const filtered = useMemo(() =>
    TRAINING_PROGRAMS.filter(p => {
      const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.instructor.toLowerCase().includes(search.toLowerCase()) || p.department.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || p.category === filter;
      return matchSearch && matchFilter;
    }), [search, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search programs, instructors..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
        <button className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:border-emerald-500/50 transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => {
          const completionRate = Math.round((p.completed / p.enrolled) * 100);
          return (
            <div key={p.id} onClick={() => setModal(p)} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-emerald-500/30 transition group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.id} · {p.instructor}</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${formatBadge(p.format)}`}>{p.format}</span>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Completion</span>
                  <span className={`text-sm font-bold ${completionRate >= 80 ? 'text-emerald-400' : completionRate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{completionRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${completionRate >= 80 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${completionRate}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="text-center"><p className="text-slate-500">Enrolled</p><p className="font-bold text-slate-300">{fmt(p.enrolled)}</p></div>
                <div className="text-center"><p className="text-slate-500">Duration</p><p className="font-bold text-slate-300">{p.duration}</p></div>
                <div className="text-center"><p className="text-slate-500">Rating</p><p className="font-bold text-amber-400 flex items-center justify-center gap-0.5"><Star className="w-3 h-3 fill-current" />{p.rating}</p></div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {p.skillTags.slice(0, 3).map(tag => (
                  <span key={tag} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{tag}</span>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor(p.status)}`}>{p.status}</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">Details <ChevronRight size={13} /></span>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{modal.title}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Instructor</p><p className="text-slate-200 font-medium mt-1">{modal.instructor}</p></div>
                <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Duration</p><p className="text-slate-200 font-medium mt-1">{modal.duration}</p></div>
                <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Enrolled</p><p className="text-slate-200 font-medium mt-1">{modal.enrolled} employees</p></div>
                <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Completed</p><p className="text-slate-200 font-medium mt-1">{modal.completed} ({Math.round((modal.completed / modal.enrolled) * 100)}%)</p></div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Skill Tags</p><div className="flex flex-wrap gap-1 mt-1">{modal.skillTags.map(t => <span key={t} className="rounded-md bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{t}</span>)}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Tab 2: Certifications ------------------------------------------ */

function CertificationsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState<Certification | null>(null);
  const filters = ['All', 'Valid', 'Expiring Soon', 'Expired'];

  const filtered = useMemo(() =>
    CERTIFICATIONS.filter(c => {
      const matchSearch = !search || c.employeeName.toLowerCase().includes(search.toLowerCase()) || c.certification.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || c.status === filter;
      return matchSearch && matchFilter;
    }), [search, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees, certifications..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} onClick={() => setModal(c)} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-amber-500/30 transition group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition">{c.certification}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.employeeName} · {c.employeeId}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status)}`}>{c.status}</span>
            </div>
            <div className="bg-slate-950/50 rounded-xl p-3 mb-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-slate-500">Issued</p><p className="font-medium text-slate-300 mt-0.5">{c.issueDate}</p></div>
                <div><p className="text-slate-500">Expires</p><p className={`font-medium mt-0.5 ${c.status === 'Expired' ? 'text-rose-400' : c.status === 'Expiring Soon' ? 'text-amber-400' : 'text-slate-300'}`}>{c.expiryDate}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-slate-800 rounded-lg p-2 text-center"><p className="text-slate-500">Body</p><p className="font-medium text-slate-300 text-[11px]">{c.issuingBody}</p></div>
              <div className="bg-slate-800 rounded-lg p-2 text-center"><p className="text-slate-500">Renewal</p><p className="font-medium text-slate-300">${fmt(c.renewalCost)}</p></div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <span className="text-[10px] text-slate-500">{c.department}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">Manage <ChevronRight size={13} /></span>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{modal.certification}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Employee</p><p className="text-slate-200 font-medium mt-1">{modal.employeeName}</p></div>
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Issuing Body</p><p className="text-slate-200 font-medium mt-1">{modal.issuingBody}</p></div>
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Issue Date</p><p className="text-slate-200 font-medium mt-1">{modal.issueDate}</p></div>
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Expiry Date</p><p className={`font-medium mt-1 ${modal.status === 'Expired' ? 'text-rose-400' : 'text-slate-200'}`}>{modal.expiryDate}</p></div>
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Renewal Cost</p><p className="text-slate-200 font-medium mt-1">${fmt(modal.renewalCost)}</p></div>
              <div className="bg-slate-800 rounded-xl p-3"><p className="text-[10px] text-slate-500 uppercase">Department</p><p className="text-slate-200 font-medium mt-1">{modal.department}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Tab 3: Skill Gap Analysis -------------------------------------- */

function SkillGapTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Critical', 'High', 'Medium', 'Low'];

  const filtered = useMemo(() =>
    SKILL_GAPS.filter(s => {
      const matchSearch = !search || s.competency.toLowerCase().includes(search.toLowerCase()) || s.department.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || s.priority === filter;
      return matchSearch && matchFilter;
    }), [search, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search competencies, departments..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-sky-500/30 transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-100">{s.competency}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.category} · {s.department}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor(s.priority)}`}>{s.priority}</span>
            </div>
            <div className="bg-slate-950/50 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-500">Current: <span className="text-slate-300 font-bold">{s.currentLevel}%</span></span>
                <span className="text-slate-500">Required: <span className="text-slate-300 font-bold">{s.requiredLevel}%</span></span>
              </div>
              <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="absolute h-full bg-sky-500 rounded-full" style={{ width: `${s.currentLevel}%` }} />
                <div className="absolute h-full border-r-2 border-dashed border-white/40" style={{ left: `${s.requiredLevel}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-500">Gap: <span className="text-rose-400 font-bold">{s.gapPercent}%</span></span>
                <span className="text-[10px] text-slate-500">{s.employeesAffected} employees affected</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">→ {s.recommendedCourse}</span>
              <span className="text-[11px] text-sky-400 font-semibold flex items-center gap-1">Enroll <ArrowUpRight size={12} /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -- Tab 4: Learning Paths ------------------------------------------ */

function LearningPathsTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Active', 'Draft', 'Paused'];

  const filtered = useMemo(() =>
    LEARNING_PATHS.filter(l => {
      const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.role.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || l.status === filter;
      return matchSearch && matchFilter;
    }), [search, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search paths, roles..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(l => (
          <div key={l.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-violet-500/30 transition group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-100 group-hover:text-violet-400 transition">{l.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{l.role} · {l.department}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor(l.status)}`}>{l.status}</span>
            </div>
            <div className="bg-slate-950/50 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-500">Modules</span>
                <span className="text-slate-300 font-bold">{l.completedModules}/{l.modules}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(l.completedModules / l.modules) * 100}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div className="text-center"><p className="text-slate-500">Enrolled</p><p className="font-bold text-slate-300">{l.enrolled}</p></div>
              <div className="text-center"><p className="text-slate-500">Avg Days</p><p className="font-bold text-slate-300">{l.avgCompletionDays}</p></div>
              <div className="text-center"><p className="text-slate-500">Target</p><p className="font-bold text-slate-300 text-[11px]">{l.targetCompletion}</p></div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-400">Manage <ChevronRight size={13} /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -- Tab 5: Compliance Training ------------------------------------- */

function ComplianceTrainingTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Compliant', 'At Risk', 'Non-Compliant'];

  const filtered = useMemo(() =>
    COMPLIANCE_TRAINING.filter(c => {
      const matchSearch = !search || c.trainingName.toLowerCase().includes(search.toLowerCase()) || c.department.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'All' || c.status === filter;
      return matchSearch && matchFilter;
    }), [search, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search training, departments..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-sm text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition" />
        </div>
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-rose-500/20 transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-100">{c.trainingName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.category} · {c.department}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status)}`}>{c.status}</span>
            </div>
            <div className="bg-slate-950/50 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Compliance Rate</span>
                <span className={`text-sm font-bold ${c.complianceRate >= 90 ? 'text-emerald-400' : c.complianceRate >= 75 ? 'text-amber-400' : 'text-rose-400'}`}>{c.complianceRate}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${c.complianceRate >= 90 ? 'bg-emerald-500' : c.complianceRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${c.complianceRate}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
              <div className="text-center"><p className="text-slate-500">Required</p><p className="font-bold text-slate-300">{c.requiredFor}</p></div>
              <div className="text-center"><p className="text-slate-500">Done</p><p className="font-bold text-emerald-400">{c.completed}</p></div>
              <div className="text-center"><p className="text-slate-500">Overdue</p><p className={`font-bold ${c.overdue > 50 ? 'text-rose-400' : 'text-amber-400'}`}>{c.overdue}</p></div>
              <div className="text-center"><p className="text-slate-500">Deadline</p><p className="font-bold text-slate-300 text-[11px]">{c.deadline}</p></div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              {c.overdue > 50 && <AlertTriangle className="w-4 h-4 text-rose-400" />}
              {c.overdue <= 50 && c.overdue > 0 && <Clock className="w-4 h-4 text-amber-400" />}
              {c.overdue === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">Manage <ChevronRight size={13} /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -- Main Hub Component --------------------------------------------- */

export default function EnterpriseLearningDevelopmentPage() {
  const [activeTab, setActiveTab] = useState('programs');

  const stats = useMemo(() => {
    const totalEnrolled = TRAINING_PROGRAMS.reduce((a, p) => a + p.enrolled, 0);
    const expiringCerts = CERTIFICATIONS.filter(c => c.status === 'Expiring Soon').length + CERTIFICATIONS.filter(c => c.status === 'Expired').length;
    const criticalGaps = SKILL_GAPS.filter(s => s.priority === 'Critical').length;
    const avgCompliance = Math.round(COMPLIANCE_TRAINING.reduce((a, c) => a + c.complianceRate, 0) / COMPLIANCE_TRAINING.length);
    return { totalEnrolled, expiringCerts, criticalGaps, avgCompliance };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Executive Header */}
      <header className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 border border-violet-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -top-10 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-violet-500/20 text-violet-300 text-xs px-3 py-1 rounded-full font-semibold border border-violet-500/30 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> PaySphere Executive Suite
              </span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SOC-2 Type II Certified Pipeline
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-violet-200 bg-clip-text text-transparent">
              Enterprise Learning & Development
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Training programme oversight, certification lifecycle management, competency gap analysis, role-based learning paths, and regulatory compliance tracking.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-violet-600/30 transition flex items-center gap-2 border border-violet-400/20 text-sm">
              <Download className="w-4 h-4" /> Export L&D Report
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
          <StatCard icon={Users} label="Total Enrolled" value={fmt(stats.totalEnrolled)} sub="Across all active programmes" tone="violet" />
          <StatCard icon={AlertTriangle} label="Cert Alerts" value={stats.expiringCerts} sub="Expiring or expired certifications" tone="rose" />
          <StatCard icon={Target} label="Critical Skill Gaps" value={stats.criticalGaps} sub="Competencies needing immediate attention" tone="amber" />
          <StatCard icon={ShieldCheck} label="Avg Compliance" value={`${stats.avgCompliance}%`} sub="Mandatory training adherence rate" tone="emerald" />
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${activeTab === t.key ? 'border-violet-500/50 bg-violet-500/10 text-violet-300 shadow-lg shadow-violet-500/10' : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}>
                  <Icon size={16} />{t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'programs' && <TrainingProgramsTab />}
          {activeTab === 'certifications' && <CertificationsTab />}
          {activeTab === 'skillGaps' && <SkillGapTab />}
          {activeTab === 'learningPaths' && <LearningPathsTab />}
          {activeTab === 'compliance' && <ComplianceTrainingTab />}
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 border-t border-slate-800 px-6 py-4 text-center text-[10px] text-slate-600">
        PaySphere Enterprise L&D Command Hub · Learning & Development Suite · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
