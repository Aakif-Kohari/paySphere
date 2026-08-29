/* ═══════════════════════════════════════════════════════════════
   ActionPlanModal — Create / View / Edit engagement action plans
   with milestones, priority, department, and status management.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useCallback } from 'react';
import {
  Target,
  X,
  Plus,
  Check,
  Clock,
  Calendar,
  User,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  Flag,
} from 'lucide-react';
import type { EngagementActionPlan, ActionPlanPriority, ActionPlanStatus, ActionMilestone } from '../../services/engagement/engagementService';
import { priorityColor, statusColor, generateId } from '../../services/engagement/engagementService';
import { SEED_DEPARTMENTS } from '../../services/engagement/engagementService';
import { formatDate } from '../../utils/formatLocale';

/* ─────────────── Types ────────────────── */

interface ActionPlanModalProps {
  mode: 'view' | 'create';
  plan?: EngagementActionPlan | null;
  onClose: () => void;
  onSave: (plan: EngagementActionPlan) => void;
}

/* ─────────────── Helper ────────────────── */

function progressPercent(milestones: ActionMilestone[]): number {
  if (milestones.length === 0) return 0;
  return Math.round((milestones.filter((m) => m.completed).length / milestones.length) * 100);
}

function daysUntil(dateStr: string): number {
  const now = new Date('2026-08-20T15:00:00Z');
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─────────────── View Mode ────────────────── */

function ViewPlan({ plan, onClose }: { plan: EngagementActionPlan; onClose: () => void }) {
  const progress = progressPercent(plan.milestones);
  const daysLeft = daysUntil(plan.dueDate);
  const isOverdue = daysLeft < 0 && plan.status !== 'COMPLETED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ──── Header ──── */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{plan.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(plan.status)}`}>
                  {plan.status.replace('_', ' ')}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColor(plan.priority)}`}>
                  {plan.priority}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{plan.id}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed">{plan.description}</p>

          {/* Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Owner
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                  {plan.ownerAvatar}
                </div>
                <span className="text-xs text-white font-medium">{plan.owner}</span>
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Due Date
              </div>
              <div className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : daysLeft <= 14 ? 'text-amber-400' : 'text-white'}`}>
                {formatDate(plan.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div className={`text-[10px] mt-0.5 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                {plan.status === 'COMPLETED' ? 'Completed' : isOverdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Department
              </div>
              <div className="text-xs text-white font-medium">{plan.departmentName}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Progress
              </div>
              <div className="text-xs text-white font-bold font-mono">{progress}%</div>
              <div className="h-1 bg-slate-700 rounded-full mt-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress === 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tags */}
          {plan.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {plan.tags.map((tag) => (
                <span key={tag} className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full border border-slate-700">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Milestones */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Milestones ({plan.milestones.filter((m) => m.completed).length}/{plan.milestones.length})
            </h4>
            <div className="space-y-2">
              {plan.milestones.map((ms, idx) => (
                <div
                  key={ms.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                    ms.completed
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-slate-800/50 border-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    ms.completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}>
                    {ms.completed && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${ms.completed ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {ms.title}
                    </p>
                    {ms.completedAt && (
                      <span className="text-[10px] text-emerald-400/70 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        Completed {formatDate(ms.completedAt, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono">{idx + 1}/{plan.milestones.length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Create Mode ────────────────── */

function CreatePlan({ onClose, onSave }: { onClose: () => void; onSave: (plan: EngagementActionPlan) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [departmentId, setDepartmentId] = useState(SEED_DEPARTMENTS[0].id);
  const [priority, setPriority] = useState<ActionPlanPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [milestones, setMilestones] = useState<{ title: string }[]>([{ title: '' }]);
  const [tags, setTags] = useState('');
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);

  const selectedDept = SEED_DEPARTMENTS.find((d) => d.id === departmentId);

  const addMilestone = useCallback(() => {
    setMilestones((prev) => [...prev, { title: '' }]);
  }, []);

  const removeMilestone = useCallback((idx: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateMilestoneTitle = useCallback((idx: number, value: string) => {
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, title: value } : m)));
  }, []);

  const canSave = title.trim() && description.trim() && owner.trim() && dueDate && milestones.some((m) => m.title.trim());

  const handleSave = () => {
    if (!canSave) return;
    const initials = owner
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const plan: EngagementActionPlan = {
      id: generateId('AP'),
      title: title.trim(),
      description: description.trim(),
      owner: owner.trim(),
      ownerAvatar: initials,
      departmentId,
      departmentName: selectedDept?.name ?? 'All Departments',
      status: 'NOT_STARTED',
      priority,
      createdAt: new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      completedAt: null,
      relatedSurveyId: '',
      milestones: milestones
        .filter((m) => m.title.trim())
        .map((m, i) => ({
          id: generateId('MS'),
          title: m.title.trim(),
          completed: false,
          completedAt: null,
        })),
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    };
    onSave(plan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ──── Header ──── */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-white">New Action Plan</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Engineering Sprint Sustainability Initiative"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the action plan objectives and approach..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition resize-none"
            />
          </div>

          {/* Owner & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Owner *</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. Sarah Chen"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition"
              />
            </div>
          </div>

          {/* Department & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Department</label>
              <button
                onClick={() => setShowDeptDropdown(!showDeptDropdown)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white text-left flex items-center justify-between focus:outline-none focus:border-violet-500 transition"
              >
                <span>{selectedDept?.name ?? 'All Departments'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
              {showDeptDropdown && (
                <div className="absolute z-20 top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  <button
                    onClick={() => { setDepartmentId('ALL'); setShowDeptDropdown(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-slate-700 transition"
                  >
                    All Departments
                  </button>
                  {SEED_DEPARTMENTS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => { setDepartmentId(d.id); setShowDeptDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${
                        departmentId === d.id ? 'bg-violet-500/20 text-violet-300' : 'text-white hover:bg-slate-700'
                      }`}
                    >
                      {d.name}
                      <span className="text-[10px] text-slate-500 ml-2">({d.headcount})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Priority</label>
              <div className="flex gap-1.5">
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as ActionPlanPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 px-2 py-2 rounded-lg text-[10px] font-bold border transition ${
                      priority === p ? priorityColor(p) + ' ring-1 ring-current' : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. sustainability, engineering, burnout"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Milestones</label>
              <button
                onClick={addMilestone}
                className="text-violet-400 hover:text-violet-300 text-[11px] font-medium flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" /> Add Milestone
              </button>
            </div>
            <div className="space-y-2">
              {milestones.map((ms, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex items-center justify-center shrink-0">
                    <span className="text-[9px] text-slate-500">{idx + 1}</span>
                  </div>
                  <input
                    type="text"
                    value={ms.title}
                    onChange={(e) => updateMilestoneTitle(idx, e.target.value)}
                    placeholder={`Milestone ${idx + 1}`}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition"
                  />
                  {milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(idx)}
                      className="text-slate-600 hover:text-red-400 transition p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`px-5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border ${
              canSave
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-violet-400/20 shadow-lg shadow-violet-600/20'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" /> Create Plan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Exported Wrapper ────────────────── */

export default function ActionPlanModal({ mode, plan, onClose, onSave }: ActionPlanModalProps) {
  if (mode === 'view' && plan) {
    return <ViewPlan plan={plan} onClose={onClose} />;
  }
  return <CreatePlan onClose={onClose} onSave={onSave} />;
}
