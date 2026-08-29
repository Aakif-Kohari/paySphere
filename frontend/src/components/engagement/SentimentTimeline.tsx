/* ═══════════════════════════════════════════════════════════════
   SentimentTimeline — Real-time activity feed showing engagement
   events with severity indicators, timestamps, and actor info.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Megaphone,
  Target,
  TrendingUp,
  TrendingDown,
  Clock,
  Filter,
  ChevronRight,
  X,
} from 'lucide-react';
import type { EngagementActivity } from '../../services/engagement/engagementService';
import { formatRelativeTime, activitySeverityColor } from '../../services/engagement/engagementService';

/* ─────────────── Helper: icon per activity type ─────────────── */

function activityIcon(type: EngagementActivity['type']) {
  switch (type) {
    case 'SURVEY_LAUNCHED':
      return { icon: Megaphone, color: 'text-blue-400', bg: 'bg-blue-500/10' };
    case 'SURVEY_CLOSED':
      return { icon: CheckCircle2, color: 'text-slate-400', bg: 'bg-slate-500/10' };
    case 'ACTION_PLAN_CREATED':
      return { icon: Target, color: 'text-violet-400', bg: 'bg-violet-500/10' };
    case 'ACTION_PLAN_COMPLETED':
      return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    case 'MILESTONE_REACHED':
      return { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    case 'THRESHOLD_ALERT':
      return { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' };
    case 'DEPARTMENT_UPDATE':
      return { icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    case 'ENPS_CHANGE':
      return { icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10' };
    default:
      return { icon: Info, color: 'text-slate-400', bg: 'bg-slate-500/10' };
  }
}

/* ─────────────── Detail Modal ────────────────── */

function ActivityDetailModal({ activity, onClose }: { activity: EngagementActivity; onClose: () => void }) {
  const { icon: Icon, color, bg } = activityIcon(activity.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{activity.title}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block mt-1 ${activitySeverityColor(activity.severity)}`}>
                {activity.severity}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-slate-300 text-sm leading-relaxed mb-4">{activity.description}</p>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Actor</div>
            <div className="text-xs text-white font-semibold">{activity.actorName}</div>
            <div className="text-[10px] text-slate-400">{activity.actorRole}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Department</div>
            <div className="text-xs text-white font-semibold">{activity.departmentName ?? 'Company-wide'}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Timestamp</div>
            <div className="text-xs text-white font-mono">{new Date(activity.timestamp).toLocaleString()}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Type</div>
            <div className="text-xs text-white font-mono">{activity.type.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="mt-3 bg-slate-800/50 rounded-xl p-3 border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase mb-2">Metadata</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(activity.metadata).map(([key, val]) => (
                <span key={key} className="bg-slate-700/50 text-slate-300 text-[10px] px-2 py-1 rounded-lg">
                  {key}: <span className="font-mono">{String(val)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Close */}
        <div className="mt-5 flex justify-end">
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

/* ─────────────── Main Component ────────────────── */

interface SentimentTimelineProps {
  activities: EngagementActivity[];
  maxItems?: number;
}

export default function SentimentTimeline({ activities, maxItems = 20 }: SentimentTimelineProps) {
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedActivity, setSelectedActivity] = useState<EngagementActivity | null>(null);

  const filteredActivities = activities
    .filter((a) => filter === 'ALL' || a.severity === filter)
    .slice(0, maxItems);

  const severityCounts = {
    ALL: activities.length,
    ALERT: activities.filter((a) => a.severity === 'ALERT').length,
    WARNING: activities.filter((a) => a.severity === 'WARNING').length,
    SUCCESS: activities.filter((a) => a.severity === 'SUCCESS').length,
    INFO: activities.filter((a) => a.severity === 'INFO').length,
  };

  return (
    <>
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        {/* ──── Header ──── */}
        <div className="p-5 pb-3 border-b border-slate-800/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Activity Feed</h3>
              <span className="text-[10px] text-slate-500 font-mono">{activities.length} events</span>
            </div>
            <Bell className="w-4 h-4 text-slate-500" />
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl">
            {(['ALL', 'ALERT', 'WARNING', 'SUCCESS', 'INFO'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition ${
                  filter === sev
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                {sev === 'ALL' ? 'All' : sev}
                <span className="ml-1 opacity-60">{severityCounts[sev]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ──── Timeline ──── */}
        <div className="p-5 max-h-[500px] overflow-y-auto scrollbar-thin">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No activities match this filter.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />

              <div className="space-y-1">
                {filteredActivities.map((activity, idx) => {
                  const { icon: Icon, color, bg } = activityIcon(activity.type);
                  return (
                    <div
                      key={activity.id}
                      onClick={() => setSelectedActivity(activity)}
                      className="relative flex items-start gap-4 pl-1 pr-2 py-2.5 rounded-xl hover:bg-slate-800/30 transition cursor-pointer group"
                    >
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0 border border-slate-800`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-white truncate">{activity.title}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${activitySeverityColor(activity.severity)}`}>
                            {activity.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{activity.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatRelativeTime(activity.timestamp)}
                          </span>
                          <span>{activity.actorName}</span>
                          {activity.departmentName && (
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">{activity.departmentName}</span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 transition shrink-0 mt-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ──── Detail Modal ──── */}
      {selectedActivity && (
        <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
      )}
    </>
  );
}
