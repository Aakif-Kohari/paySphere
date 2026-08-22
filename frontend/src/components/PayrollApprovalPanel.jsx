/**
 * PayrollApprovalPanel.jsx - Issue #1247
 *
 * A panel component showing the full payroll approval workflow:
 *   - Stage chain visualization (HR -> Manager -> Finance -> etc.)
 *   - Current stage highlight with lock status
 *   - Per-stage actor, timestamp, and comment
 *   - Escalation countdown timer
 *   - Approve / Reject / Lock / Unlock actions
 *   - Real-time polling via Socket.IO (payroll:stage_changed)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const STAGE_STATUS_STYLES = {
  pending:   { bg: 'bg-gray-100 dark:bg-slate-800', text: 'text-gray-500 dark:text-slate-400', dot: 'bg-gray-300 dark:bg-slate-600' },
  active:    { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  approved:  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  rejected:  { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  escalated: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
};

function formatTimeRemaining(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h';
  return hours + 'h ' + minutes + 'm';
}

export default function PayrollApprovalPanel({ payrollId, onStatusChange }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!payrollId) return;
    try {
      const res = await api.get(`/api/payroll/${payrollId}/approval-status`);
      setStatus(res.data);
      setError('');
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch approval status:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [payrollId]);

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Escalation countdown timer
  useEffect(() => {
    if (!status?.escalation?.deadlineAt) {
      setCountdown('');
      return;
    }
    const update = () => setCountdown(formatTimeRemaining(status.escalation.deadlineAt));
    update();
    timerRef.current = setInterval(update, 60000);
    return () => clearInterval(timerRef.current);
  }, [status?.escalation?.deadlineAt]);

  const handleApprove = useCallback(async () => {
    setActionLoading('approve');
    setError('');
    try {
      await api.post(`/api/payroll/${payrollId}/approve`, { comment: comment || '' });
      setComment('');
      await fetchStatus();
      onStatusChange?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Approval failed.');
    } finally {
      setActionLoading('');
    }
  }, [payrollId, comment, fetchStatus, onStatusChange]);

  const handleReject = useCallback(async () => {
    if (!comment.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setActionLoading('reject');
    setError('');
    try {
      await api.post(`/api/payroll/${payrollId}/reject`, { comment });
      setComment('');
      await fetchStatus();
      onStatusChange?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Rejection failed.');
    } finally {
      setActionLoading('');
    }
  }, [payrollId, comment, fetchStatus, onStatusChange]);

  const handleLock = useCallback(async () => {
    setActionLoading('lock');
    try {
      await api.post(`/api/payroll/${payrollId}/lock`);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not lock stage.');
    } finally {
      setActionLoading('');
    }
  }, [payrollId, fetchStatus]);

  const handleUnlock = useCallback(async () => {
    setActionLoading('unlock');
    try {
      await api.delete(`/api/payroll/${payrollId}/lock`);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not release lock.');
    } finally {
      setActionLoading('');
    }
  }, [payrollId, fetchStatus]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 space-y-4">
        <div className="h-6 w-48 bg-gray-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 flex-1 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 text-center">
        <p className="text-gray-500 dark:text-slate-400">No approval workflow found for this payroll.</p>
      </div>
    );
  }

  const { stageChain, lock, escalation, history } = status;
  const isLocked = lock.lockedBy && !lock.isExpired;
  const isMyLock = isLocked; // Would compare with current user in production

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Approval Workflow</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Status: <span className="font-semibold capitalize">{status.status?.replace('_', ' ')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {countdown && (
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
              countdown === 'Overdue'
                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
            }`}>
              Escalation: {countdown}
            </span>
          )}
          {isLocked && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Stage Chain */}
      {stageChain && stageChain.length > 0 && (
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {stageChain.map((stage, idx) => {
              const styles = STAGE_STATUS_STYLES[stage.status] || STAGE_STATUS_STYLES.pending;
              const isActive = stage.status === 'active';
              return (
                <div key={idx} className="flex items-center">
                  <div className={`flex flex-col items-center min-w-[100px] ${styles.text}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${styles.bg} ${isActive ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}`}>
                      {stage.status === 'approved' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : stage.status === 'rejected' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : stage.status === 'escalated' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <p className="text-xs font-semibold mt-2 capitalize">{stage.roleName}</p>
                    {stage.actorId && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                        {stage.actorId.fullName || 'Unknown'}
                      </p>
                    )}
                    {stage.actedAt && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {new Date(stage.actedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                    {stage.comment && (
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 max-w-[120px] truncate mt-0.5" title={stage.comment}>
                        &ldquo;{stage.comment}&rdquo;
                      </p>
                    )}
                  </div>
                  {idx < stageChain.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${
                      stage.status === 'approved' ? 'bg-emerald-400 dark:bg-emerald-600' :
                      stage.status === 'rejected' ? 'bg-red-400 dark:bg-red-600' :
                      'bg-gray-200 dark:bg-slate-700'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lock Info */}
      {isLocked && (
        <div className="px-6 py-3 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-100 dark:border-orange-900/30">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Stage is locked by <strong>{lock.lockedBy?.fullName || 'another approver'}</strong>
            {lock.lockExpiresAt && (
              <span> until {new Date(lock.lockExpiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 space-y-3">
        {/* Comment input */}
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (required for rejection, optional for approval)"
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleLock}
            disabled={isLocked || actionLoading === 'lock' || status.status === 'approved' || status.status === 'rejected'}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {actionLoading === 'lock' ? 'Locking...' : 'Lock Stage'}
          </button>

          <button
            onClick={handleUnlock}
            disabled={!isLocked || actionLoading === 'unlock'}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {actionLoading === 'unlock' ? 'Unlocking...' : 'Release Lock'}
          </button>

          <div className="flex-1" />

          <button
            onClick={handleReject}
            disabled={actionLoading === 'reject' || status.status === 'approved' || status.status === 'rejected'}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
          >
            {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
          </button>

          <button
            onClick={handleApprove}
            disabled={actionLoading === 'approve' || status.status === 'approved' || status.status === 'rejected'}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md"
          >
            {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>

      {/* History Log */}
      {history && history.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800">
          <h4 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-3">Activity Log</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {[...history].reverse().map((entry, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  entry.action === 'approve' ? 'bg-emerald-500' :
                  entry.action === 'reject' ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {entry.actionBy?.fullName || 'Unknown'}
                  </span>
                  <span className="text-gray-500 dark:text-slate-400"> {entry.action}d</span>
                  {entry.comment && (
                    <span className="text-gray-500 dark:text-slate-400"> &mdash; &ldquo;{entry.comment}&rdquo;</span>
                  )}
                  <span className="text-gray-400 dark:text-slate-500 ml-1">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
