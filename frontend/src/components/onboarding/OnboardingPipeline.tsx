/* ═══════════════════════════════════════════════════════════════
   OnboardingPipeline — Kanban-style pipeline showing new hires
   across onboarding stages with risk indicators.
   ═══════════════════════════════════════════════════════════════ */

import React from 'react';
import { User, AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import type { NewHire, OnboardingStatus } from '../../services/onboarding/onboardingService';
import { statusColor, riskColor } from '../../services/onboarding/onboardingService';

const PIPELINE_STAGES: { key: OnboardingStatus; label: string; color: string }[] = [
  { key: 'PRE_BOARDING', label: 'Pre-boarding', color: 'border-blue-500' },
  { key: 'DAY_ONE', label: 'Day 1', color: 'border-violet-500' },
  { key: 'WEEK_1', label: 'Week 1', color: 'border-cyan-500' },
  { key: 'MONTH_1', label: 'Month 1', color: 'border-amber-500' },
  { key: 'MONTH_3', label: 'Month 3', color: 'border-orange-500' },
  { key: 'COMPLETED', label: 'Completed', color: 'border-emerald-500' },
  { key: 'DROPPED', label: 'Dropped', color: 'border-red-500' },
];

function HireCard({ hire, onClick }: { hire: NewHire; onClick: () => void }) {
  const initials = hire.name.split(' ').map((w) => w[0]).join('');
  return (
    <div onClick={onClick} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600 transition cursor-pointer group">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-white truncate">{hire.name}</div>
          <div className="text-[9px] text-slate-500 truncate">{hire.role}</div>
        </div>
        {hire.riskLevel !== 'LOW' && (
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${hire.riskLevel === 'CRITICAL' ? 'text-red-400' : hire.riskLevel === 'HIGH' ? 'text-orange-400' : 'text-amber-400'}`} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-500">{hire.department}</span>
        <span className="text-[9px] text-slate-400 font-mono">{hire.completionPct}%</span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${hire.completionPct === 100 ? 'bg-emerald-500' : hire.completionPct >= 60 ? 'bg-blue-500' : hire.completionPct >= 30 ? 'bg-amber-500' : 'bg-slate-500'}`}
          style={{ width: `${hire.completionPct}%` }}
        />
      </div>
    </div>
  );
}

interface OnboardingPipelineProps {
  hires: NewHire[];
  onHireClick?: (hire: NewHire) => void;
}

export default function OnboardingPipeline({ hires, onHireClick }: OnboardingPipelineProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-5 pb-4 border-b border-slate-800/50">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-400" /> Onboarding Pipeline
        </h3>
        <p className="text-[11px] text-slate-400 mt-1">New hires tracked across onboarding stages</p>
      </div>
      <div className="p-5 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {PIPELINE_STAGES.map((stage) => {
            const stageHires = hires.filter((h) => h.status === stage.key);
            return (
              <div key={stage.key} className="w-52 shrink-0">
                <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${stage.color}`}>
                  <span className="text-[11px] font-semibold text-white">{stage.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono bg-slate-800 px-1.5 py-0.5 rounded">{stageHires.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {stageHires.length === 0 && (
                    <div className="text-center py-8 text-[10px] text-slate-600">No hires</div>
                  )}
                  {stageHires.map((h) => (
                    <HireCard key={h.id} hire={h} onClick={() => onHireClick?.(h)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
