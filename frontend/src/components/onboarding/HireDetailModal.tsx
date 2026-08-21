/* ═══════════════════════════════════════════════════════════════
   HireDetailModal — Full onboarding profile for a new hire
   with completion, risk factors, buddy info, and milestones.
   ═══════════════════════════════════════════════════════════════ */

import React from 'react';
import {
  User, X, Mail, MapPin, Calendar, Briefcase, Star,
  AlertTriangle, CheckCircle2, Clock, Users, Building2,
} from 'lucide-react';
import type { NewHire, OnboardingMilestone } from '../../services/onboarding/onboardingService';
import { statusColor, riskColor, categoryColor } from '../../services/onboarding/onboardingService';
import { SEED_MILESTONES } from '../../services/onboarding/onboardingService';

interface HireDetailModalProps {
  hire: NewHire;
  onClose: () => void;
}

export default function HireDetailModal({ hire, onClose }: HireDetailModalProps) {
  const initials = hire.name.split(' ').map((w) => w[0]).join('');
  const relevantMilestones = SEED_MILESTONES.filter((m) => m.dayNumber <= hire.daysSinceStart + 30);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{hire.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(hire.status)}`}>{hire.status.replace(/_/g, ' ')}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${riskColor(hire.riskLevel)}`}>{hire.riskLevel} RISK</span>
                <span className="text-[10px] text-slate-500 font-mono">{hire.id}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Briefcase, label: 'Role', value: hire.role },
              { icon: Building2, label: 'Department', value: hire.department },
              { icon: User, label: 'Manager', value: hire.manager },
              { icon: Users, label: 'Buddy', value: hire.buddy ?? 'Unassigned' },
              { icon: MapPin, label: 'Location', value: hire.location },
              { icon: Calendar, label: 'Start Date', value: hire.startDate },
              { icon: Clock, label: 'Days Active', value: String(hire.daysSinceStart) },
              { icon: Star, label: 'NPS', value: hire.npsScore !== null ? String(hire.npsScore) : 'Pending' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <item.icon className="w-2.5 h-2.5" /> {item.label}
                </div>
                <div className="text-xs text-white font-medium truncate">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Completion Progress */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400">Onboarding Progress</span>
              <span className="text-sm font-black font-mono text-white">{hire.completionPct}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${hire.completionPct === 100 ? 'bg-emerald-500' : hire.completionPct >= 60 ? 'bg-blue-500' : hire.completionPct >= 30 ? 'bg-amber-500' : 'bg-slate-500'}`}
                style={{ width: `${hire.completionPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
              <span>{hire.tasksCompleted}/{hire.tasksTotal} tasks completed</span>
              <span>{hire.employmentType.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Risk Factors */}
          {hire.riskFactors.length > 0 && (
            <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
              <h4 className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Risk Factors
              </h4>
              <div className="space-y-1">
                {hire.riskFactors.map((rf, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {rf}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Milestones Timeline</h4>
            <div className="space-y-2">
              {relevantMilestones.map((ms) => {
                const isAchieved = ms.dayNumber <= hire.daysSinceStart;
                return (
                  <div key={ms.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                    isAchieved ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/30 border-slate-800'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      isAchieved ? 'bg-emerald-500 text-white' : 'bg-slate-800 border border-slate-700'
                    }`}>
                      {isAchieved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[9px] text-slate-500">{ms.dayNumber}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isAchieved ? 'text-white' : 'text-slate-400'}`}>{ms.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${categoryColor(ms.category)}`}>{ms.category}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Day {ms.dayNumber} · Target: {ms.targetCompletionPct}%</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold font-mono ${ms.actualCompletionPct >= ms.targetCompletionPct ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {ms.actualCompletionPct}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-5 flex justify-end">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium transition border border-slate-700">Close</button>
        </div>
      </div>
    </div>
  );
}
