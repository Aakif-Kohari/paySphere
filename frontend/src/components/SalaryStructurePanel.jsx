import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import api from '../services/api';

const REVISION_REASONS = [
  { value: 'revision', label: 'Revision' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'correction', label: 'Correction' },
];

const REASON_STYLES = {
  initial: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-300',
  revision: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  promotion: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  correction: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

const formatCurrency = (value, currency = 'INR') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server.';

  const data = response.data || {};
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return `${data.message || fallback}: ${data.errors.join('; ')}`;
  }
  if (response.status === 409 && data.conflictingPeriod) {
    return data.message;
  }
  return data.message || fallback;
};

/**
 * Salary package and revision timeline for one employee (#461).
 *
 * Revisions are append-only on the server — a correction is a new entry, never
 * an edit — so this panel only ever adds to the timeline.
 */
const SalaryStructurePanel = ({ employeeId, employeeName, currency = 'INR' }) => {
  const [structure, setStructure] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    grossMonthly: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    reason: 'revision',
    note: '',
  });

  // The preview endpoint writes nothing, so the delta can be checked before
  // committing to an entry that cannot be edited away.
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    if (!employeeId) return;

    setLoading(true);
    setLoadError('');

    try {
      const [structureRes, historyRes] = await Promise.all([
        api.get(`/api/employees/${employeeId}/salary-structure`),
        api.get(`/api/employees/${employeeId}/salary-history`),
      ]);

      setStructure(structureRes.data || null);
      setTimeline(historyRes.data?.timeline || []);
    } catch (error) {
      setStructure(null);
      setTimeline([]);
      setLoadError(describeError(error, 'Could not load the salary structure.'));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setPreview(null);
    setFormError('');
  };

  const handlePreview = async () => {
    if (!Number(form.grossMonthly)) return;

    try {
      const res = await api.post(
        `/api/employees/${employeeId}/salary-structure/preview`,
        {
          grossMonthly: Number(form.grossMonthly),
          effectiveFrom: form.effectiveFrom,
          reason: form.reason,
        },
      );
      setPreview(res.data);
      setFormError('');
    } catch (error) {
      setPreview(null);
      setFormError(describeError(error, 'Could not preview the structure.'));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setFormError('');

    try {
      const res = await api.post(`/api/employees/${employeeId}/salary-revision`, {
        grossMonthly: Number(form.grossMonthly),
        effectiveFrom: form.effectiveFrom,
        reason: form.reason,
        note: form.note,
      });

      setSuccessMessage(
        res.data?.appliedImmediately
          ? 'Revision recorded and applied.'
          : 'Revision recorded. It takes effect on the date you set.',
      );
      setShowForm(false);
      setPreview(null);
      setForm((prev) => ({ ...prev, grossMonthly: '', note: '' }));
      await load();
    } catch (error) {
      setFormError(describeError(error, 'Could not record the revision.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-gray-100 dark:bg-slate-800/60 animate-pulse" />
        <div className="h-16 rounded-xl bg-gray-100 dark:bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  const breakdown = structure?.breakdown;

  return (
    <div className="space-y-5">
      {loadError && (
        <Alert
          severity="error"
          action={
            <button onClick={load} className="px-3 py-1 text-sm font-semibold underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
              Retry
            </button>
          }
        >
          {loadError}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {breakdown && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                Current package{employeeName ? ` — ${employeeName}` : ''}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(breakdown.grossMonthly, currency)}
                <span className="text-sm font-normal text-gray-500 dark:text-slate-500">
                  {' '}
                  / month
                </span>
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-500">
                {formatCurrency(breakdown.grossMonthly * 12, currency)} annual CTC
              </p>
              {structure.isSynthesised && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Derived from the stored salary — no revision recorded yet.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
            >
              {showForm ? 'Cancel' : 'Revise salary'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="py-2">Component</th>
                  <th className="py-2">Type</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-slate-200">
                {breakdown.components.map((c) => (
                  <tr key={c.code} className="border-b border-gray-100 dark:border-slate-800/60">
                    <td className="py-2">{c.label}</td>
                    <td className="py-2 capitalize text-gray-500 dark:text-slate-500">
                      {c.type}
                    </td>
                    <td className="py-2 text-right">{formatCurrency(c.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold text-gray-900 dark:text-white">
                <tr>
                  <td className="py-2" colSpan={2}>
                    Gross
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(breakdown.totalEarnings, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl grid gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="text-sm text-gray-700 dark:text-slate-300">
              New gross / month
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={form.grossMonthly}
                onChange={setField('grossMonthly')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Effective from
              <input
                required
                type="date"
                value={form.effectiveFrom}
                onChange={setField('effectiveFrom')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Reason
              <select
                value={form.reason}
                onChange={setField('reason')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {REVISION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Note (optional)
            <input
              type="text"
              maxLength={500}
              value={form.note}
              onChange={setField('note')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            />
          </label>

          <p className="text-xs text-gray-500 dark:text-slate-500">
            Revisions are append-only. A correction is recorded as a new entry so
            the history stays intact.
          </p>

          {formError && <Alert severity="error">{formError}</Alert>}

          {preview && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {formatCurrency(preview.diff.grossFrom, currency)} →{' '}
                {formatCurrency(preview.diff.grossTo, currency)}{' '}
                <span
                  className={
                    preview.diff.grossDelta >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  ({preview.diff.grossDelta >= 0 ? '+' : ''}
                  {preview.diff.percentChange}%)
                </span>
              </p>
              <div className="grid gap-1 text-xs text-gray-600 dark:text-slate-500">
                {preview.diff.components
                  .filter((c) => c.change !== 'unchanged')
                  .map((c) => (
                    <div key={c.code} className="flex justify-between">
                      <span>{c.label}</span>
                      <span>
                        {formatCurrency(c.fromAmount, currency)} →{' '}
                        {formatCurrency(c.toAmount, currency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!Number(form.grossMonthly)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Preview
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {busy ? 'Saving…' : 'Record revision'}
            </button>
          </div>
        </form>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Revision history
        </h3>

        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No revisions recorded yet.
          </p>
        ) : (
          <ol className="relative border-l border-gray-200 dark:border-slate-800 ml-2">
            {[...timeline].reverse().map((entry) => (
              <li key={entry._id} className="mb-5 ml-5">
                <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-600" />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(entry.grossMonthly, currency)}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      REASON_STYLES[entry.reason] || REASON_STYLES.revision
                    }`}
                  >
                    {entry.reason}
                  </span>
                  {entry.diff && entry.diff.grossDelta !== 0 && (
                    <span
                      className={`text-xs font-semibold ${
                        entry.diff.grossDelta > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {entry.diff.grossDelta > 0 ? '+' : ''}
                      {formatCurrency(entry.diff.grossDelta, currency)} (
                      {entry.diff.percentChange}%)
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                  Effective {formatDate(entry.effectiveFrom)}
                </p>
                {entry.note && (
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1 italic">
                    {entry.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default SalaryStructurePanel;
