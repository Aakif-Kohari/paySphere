/**
 * ComponentVersionHistory.jsx - Issue #1111
 *
 * Timeline view of salary structure version history. Each entry shows:
 *   - Effective date
 *   - Changed fields highlighted
 *   - Component values at that point
 *   - Diff against previous version
 *   - User who made the change
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const REASON_STYLES = {
  initial:       'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  revision:      'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  promotion:     'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  correction:    'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  annual_review: 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300',
  other:         'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
};

function formatCurrency(val) {
  if (val == null) return '-';
  return '\u20B9' + Number(val).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function ComponentVersionHistory({ employeeId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/api/employees/${employeeId}/salary-history`);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load salary history.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
        <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500 dark:text-slate-400 font-medium">No salary history</p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Version history will appear after the first salary revision</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Salary Version History</h3>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700" />

        <div className="space-y-4">
          {[...timeline].reverse().map((entry, idx) => {
            const isExpanded = expandedId === entry._id;
            const reasonStyle = REASON_STYLES[entry.reason] || REASON_STYLES.other;
            const hasDiff = entry.diff && (
              entry.diff.grossDelta !== 0 || entry.diff.componentDiffs?.length > 0
            );

            return (
              <div key={entry._id} className="relative pl-12">
                {/* Timeline dot */}
                <div className={`absolute left-3.5 top-4 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                  idx === 0 ? 'bg-blue-500' : 'bg-gray-400 dark:bg-slate-500'
                }`} />

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry._id)}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${reasonStyle}`}>
                          {entry.reason?.replace('_', ' ') || 'revision'}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatDate(entry.effectiveFrom)}
                        </span>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            CURRENT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency(entry.grossMonthly)}
                        </span>
                        {hasDiff && entry.diff.grossDelta !== 0 && (
                          <span className={`text-xs font-bold ${entry.diff.grossDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {entry.diff.grossDelta > 0 ? '+' : ''}{formatCurrency(entry.diff.grossDelta)}
                          </span>
                        )}
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-3 border-t border-gray-100 dark:border-slate-800 pt-3">
                      {/* Diff summary */}
                      {entry.diff && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] uppercase text-gray-400 dark:text-slate-500 font-bold">Change Summary</p>
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-gray-400 dark:text-slate-500">From</p>
                              <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(entry.diff.grossFrom)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 dark:text-slate-500">To</p>
                              <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(entry.diff.grossTo)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 dark:text-slate-500">Change</p>
                              <p className={`font-bold ${entry.diff.percentChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : entry.diff.percentChange < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                                {entry.diff.percentChange > 0 ? '+' : ''}{entry.diff.percentChange?.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          {entry.diff.componentDiffs && entry.diff.componentDiffs.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {entry.diff.componentDiffs.map((cd, ci) => (
                                <div key={ci} className="flex items-center gap-2 text-xs">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">{cd.code}</span>
                                  <span className="text-gray-400 dark:text-slate-500">{formatCurrency(cd.from)} &rarr; {formatCurrency(cd.to)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Component breakdown */}
                      {entry.breakdown && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase text-gray-400 dark:text-slate-500 font-bold">Component Values</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.values(entry.breakdown.lineItems || {}).map((item) => (
                              <div key={item.name} className="flex justify-between text-xs py-1 px-2 rounded-lg bg-gray-50 dark:bg-slate-800/40">
                                <span className="text-gray-600 dark:text-slate-400">{item.name}</span>
                                <span className={`font-semibold ${item.type === 'earning' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                  {formatCurrency(item.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Note */}
                      {entry.note && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                          {entry.note}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-[10px] text-gray-400 dark:text-slate-500 pt-1">
                        <span>CTC: {formatCurrency(entry.ctcAnnual)}/yr</span>
                        <span>Created: {formatDate(entry.createdAt)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
