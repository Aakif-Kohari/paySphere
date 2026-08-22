/* ═══════════════════════════════════════════════════════════════
   PulseSurveyCard — Interactive survey card with expandable
   details, response distribution bars, and action buttons.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState } from 'react';
import {
  ClipboardList,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingUp,
  ExternalLink,
  Download,
  Mail,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { PulseSurvey } from '../../services/engagement/engagementService';
import { statusColor, formatRelativeTime } from '../../services/engagement/engagementService';
import { formatDate } from '../../utils/formatLocale';

/* ─────────────── Sub-components ────────────────── */

function ResponseBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-slate-400 w-20 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-500 font-mono w-10 text-right">{percentage}%</span>
    </div>
  );
}

function ScoreRing({ score, maxScore = 5 }: { score: number; maxScore?: number }) {
  const pct = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;
  const color = score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgb(30 41 59)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-white font-mono">{score.toFixed(1)}</span>
        <span className="text-[9px] text-slate-500">/ {maxScore}</span>
      </div>
    </div>
  );
}

function ResponseRateGauge({ rate }: { rate: number }) {
  const circumference = 2 * Math.PI * 24;
  const offset = circumference - (rate / 100) * circumference;
  const color = rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-14 h-14">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="none" stroke="rgb(30 41 59)" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-white font-mono">{rate}%</span>
      </div>
    </div>
  );
}

/* ─────────────── Main Component ────────────────── */

interface PulseSurveyCardProps {
  survey: PulseSurvey;
  onExport?: (survey: PulseSurvey) => void;
  onRemind?: (survey: PulseSurvey) => void;
  onViewDetails?: (survey: PulseSurvey) => void;
}

export default function PulseSurveyCard({ survey, onExport, onRemind, onViewDetails }: PulseSurveyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalBreakdown =
    survey.sentimentBreakdown.veryPositive +
    survey.sentimentBreakdown.positive +
    survey.sentimentBreakdown.neutral +
    survey.sentimentBreakdown.negative +
    survey.sentimentBreakdown.veryNegative;

  const breakdownPcts = {
    veryPositive: totalBreakdown > 0 ? Math.round((survey.sentimentBreakdown.veryPositive / totalBreakdown) * 100) : 0,
    positive: totalBreakdown > 0 ? Math.round((survey.sentimentBreakdown.positive / totalBreakdown) * 100) : 0,
    neutral: totalBreakdown > 0 ? Math.round((survey.sentimentBreakdown.neutral / totalBreakdown) * 100) : 0,
    negative: totalBreakdown > 0 ? Math.round((survey.sentimentBreakdown.negative / totalBreakdown) * 100) : 0,
    veryNegative: totalBreakdown > 0 ? Math.round((survey.sentimentBreakdown.veryNegative / totalBreakdown) * 100) : 0,
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-all duration-300 group">
      {/* ──── Header ──── */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <ClipboardList className="w-4 h-4 text-violet-400 shrink-0" />
              <h3 className="text-sm font-bold text-white truncate">{survey.title}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor(survey.status)}`}>
                {survey.status}
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 ml-7">{survey.description}</p>
          </div>
          <ScoreRing score={survey.avgScore} />
        </div>

        {/* ──── Meta Row ──── */}
        <div className="flex flex-wrap items-center gap-4 ml-7 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {survey.totalResponses} / {survey.totalInvited} responses
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Closes {formatDate(survey.closesAt, { month: 'short', day: 'numeric' })}
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            {survey.departmentName}
          </span>
        </div>

        {/* ──── Response Rate Mini ──── */}
        <div className="flex items-center gap-3 mt-3 ml-7">
          <ResponseRateGauge rate={survey.responseRate} />
          <div className="flex-1">
            <div className="text-[11px] text-slate-500 mb-1">Response Rate</div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-violet-500 to-indigo-500"
                style={{ width: `${survey.responseRate}%` }}
              />
            </div>
          </div>
          {survey.responseRate >= 80 && (
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Target Met
            </span>
          )}
          {survey.responseRate < 60 && survey.status === 'ACTIVE' && (
            <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Low Response
            </span>
          )}
        </div>
      </div>

      {/* ──── Expand Toggle ──── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-2.5 border-t border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50 transition flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-300"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" /> Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" /> Show Sentiment Breakdown & Questions
          </>
        )}
      </button>

      {/* ──── Expanded Details ──── */}
      {expanded && (
        <div className="border-t border-slate-800/50 p-5 space-y-5 bg-slate-950/50">
          {/* Sentiment Breakdown */}
          {survey.totalResponses > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Sentiment Distribution
              </h4>
              <div className="space-y-2">
                <ResponseBar label="Very Positive" percentage={breakdownPcts.veryPositive} color="bg-emerald-500" />
                <ResponseBar label="Positive" percentage={breakdownPcts.positive} color="bg-green-500" />
                <ResponseBar label="Neutral" percentage={breakdownPcts.neutral} color="bg-slate-500" />
                <ResponseBar label="Negative" percentage={breakdownPcts.negative} color="bg-orange-500" />
                <ResponseBar label="Very Negative" percentage={breakdownPcts.veryNegative} color="bg-red-500" />
              </div>
            </div>
          )}

          {/* Questions */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Questions ({survey.questions.length})
            </h4>
            <div className="space-y-2">
              {survey.questions.map((q) => (
                <div key={q.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 leading-relaxed">{q.text}</p>
                      <span className="text-[10px] text-slate-500 mt-1 inline-block">{q.type.replace('_', ' ')}</span>
                    </div>
                    {q.avgScore !== undefined && (
                      <div className="text-right shrink-0">
                        <div className={`text-lg font-black font-mono ${q.avgScore >= 4 ? 'text-emerald-400' : q.avgScore >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                          {q.avgScore.toFixed(1)}
                        </div>
                        <div className="text-[9px] text-slate-500">avg</div>
                      </div>
                    )}
                  </div>
                  {/* Likert Distribution */}
                  {q.distribution && (
                    <div className="flex items-end gap-1 mt-2 h-8">
                      {q.distribution.map((count, i) => {
                        const maxVal = Math.max(...q.distribution!);
                        const heightPct = maxVal > 0 ? (count / maxVal) * 100 : 0;
                        const barColors = ['bg-red-500', 'bg-orange-500', 'bg-slate-500', 'bg-green-500', 'bg-emerald-500'];
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className={`w-full rounded-sm ${barColors[i]} transition-all duration-500`}
                              style={{ height: `${heightPct}%`, minHeight: count > 0 ? '2px' : '0' }}
                            />
                            <span className="text-[8px] text-slate-600">{i + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/50">
            <button
              onClick={() => onViewDetails?.(survey)}
              className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-violet-500/30"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full Report
            </button>
            <button
              onClick={() => onExport?.(survey)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            {survey.status === 'ACTIVE' && survey.responseRate < 70 && (
              <button
                onClick={() => onRemind?.(survey)}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 border border-amber-500/30"
              >
                <Mail className="w-3.5 h-3.5" /> Send Reminder
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
