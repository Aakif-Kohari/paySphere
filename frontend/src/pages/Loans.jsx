import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import api from '../services/api';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const INTEREST_METHODS = [
  { value: 'none', label: 'Interest free' },
  { value: 'flat', label: 'Flat rate' },
  { value: 'reducing', label: 'Reducing balance (EMI)' },
];

const STATUS_STYLES = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABELS = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
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

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';

  if (response.status === 403) {
    return 'You do not have permission to manage salary advances.';
  }

  const data = response.data || {};
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return `${data.message || fallback}: ${data.errors.join('; ')}`;
  }

  return data.message || fallback;
};

const Loans = () => {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    type: 'advance',
    principal: '',
    tenureMonths: '',
    interestMethod: 'none',
    interestRatePercent: '',
    reason: '',
  });

  // The preview endpoint writes nothing, so the admin can model the instalment
  // before committing to a deduction that runs for months.
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');

  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });

  const notify = useCallback((severity, message) => {
    setToast({ open: true, severity, message });
  }, []);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const [listRes, summaryRes] = await Promise.all([
        api.get('/api/loans', { params }),
        api.get('/api/loans/summary'),
      ]);

      setLoans(Array.isArray(listRes.data?.loans) ? listRes.data.loans : []);
      setSummary(summaryRes.data || null);
    } catch (error) {
      setLoans([]);
      setLoadError(describeError(error, 'Could not load salary advances.'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    // Only needed for the issue form's employee picker.
    if (!showForm || employees.length > 0) return;

    api
      .get('/api/employees', { params: { limit: 100 } })
      .then((res) => setEmployees(res.data?.employees || []))
      .catch(() => setEmployees([]));
  }, [showForm, employees.length]);

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setPreview(null);
  };

  const canPreview = useMemo(
    () => Number(form.principal) > 0 && Number(form.tenureMonths) >= 1,
    [form.principal, form.tenureMonths],
  );

  const handlePreview = async () => {
    if (!canPreview || busy) return;

    setPreviewError('');
    try {
      const res = await api.post('/api/loans/preview', {
        principal: Number(form.principal),
        tenureMonths: Number(form.tenureMonths),
        interestMethod: form.interestMethod,
        interestRatePercent: Number(form.interestRatePercent) || 0,
      });
      setPreview(res.data);
    } catch (error) {
      setPreview(null);
      setPreviewError(describeError(error, 'Could not build a schedule.'));
    }
  };

  const handleIssue = async (event) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      await api.post('/api/loans', {
        employeeId: form.employeeId,
        type: form.type,
        principal: Number(form.principal),
        tenureMonths: Number(form.tenureMonths),
        interestMethod: form.interestMethod,
        interestRatePercent: Number(form.interestRatePercent) || 0,
        reason: form.reason,
      });

      notify('success', 'Advance issued. It will be recovered from the next payroll run.');
      setShowForm(false);
      setPreview(null);
      setForm({
        employeeId: '',
        type: 'advance',
        principal: '',
        tenureMonths: '',
        interestMethod: 'none',
        interestRatePercent: '',
        reason: '',
      });
      await fetchLoans();
    } catch (error) {
      notify('error', describeError(error, 'Could not issue the advance.'));
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (loanId, status) => {
    if (busy) return;

    setBusy(true);
    try {
      await api.patch(`/api/loans/${loanId}/status`, { status });
      notify('success', `Advance ${STATUS_LABELS[status]?.toLowerCase() || status}.`);
      await fetchLoans();
    } catch (error) {
      notify('error', describeError(error, 'Could not update the advance.'));
    } finally {
      setBusy(false);
    }
  };

  const progressFor = (loan) => {
    const total = Number(loan.totalPayable) || 0;
    if (total <= 0) return 0;
    return Math.min(100, Math.round(((Number(loan.totalRepaid) || 0) / total) * 100));
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Salary Advances &amp; Loans
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Instalments are recovered automatically during each payroll run.
          </p>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition"
        >
          {showForm ? 'Close' : 'Issue an advance'}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Total outstanding
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(summary.totalOutstanding)}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Active
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {summary.byStatus?.active?.count || 0}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Completed
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {summary.byStatus?.completed?.count || 0}
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleIssue}
          className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl grid gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm text-gray-700 dark:text-slate-300">
              Employee
              <select
                required
                value={form.employeeId}
                onChange={setField('employeeId')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                <option value="">Select an employee…</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Type
              <select
                value={form.type}
                onChange={setField('type')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                <option value="advance">Salary advance</option>
                <option value="loan">Loan</option>
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Principal
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={form.principal}
                onChange={setField('principal')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Tenure (months)
              <input
                required
                type="number"
                min="1"
                max="120"
                value={form.tenureMonths}
                onChange={setField('tenureMonths')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Interest
              <select
                value={form.interestMethod}
                onChange={setField('interestMethod')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {INTEREST_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            {form.interestMethod !== 'none' && (
              <label className="text-sm text-gray-700 dark:text-slate-300">
                Annual rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.interestRatePercent}
                  onChange={setField('interestRatePercent')}
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
            )}
          </div>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Reason (optional)
            <input
              type="text"
              maxLength={500}
              value={form.reason}
              onChange={setField('reason')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!canPreview}
              className="px-4 py-2 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 disabled:opacity-50"
            >
              Preview schedule
            </button>
            <button
              type="submit"
              disabled={busy || !form.employeeId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
            >
              {busy ? 'Issuing…' : 'Issue'}
            </button>
          </div>

          {previewError && <Alert severity="error">{previewError}</Alert>}

          {preview && (
            <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex flex-wrap gap-6 mb-3 text-sm">
                <span className="text-gray-700 dark:text-slate-300">
                  Monthly instalment:{' '}
                  <strong>{formatCurrency(preview.installmentAmount)}</strong>
                </span>
                <span className="text-gray-700 dark:text-slate-300">
                  Total payable: <strong>{formatCurrency(preview.totalPayable)}</strong>
                </span>
                <span className="text-gray-700 dark:text-slate-300">
                  Interest: <strong>{formatCurrency(preview.totalInterest)}</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-gray-500 dark:text-slate-400">
                    <tr>
                      <th className="py-1 pr-4">#</th>
                      <th className="py-1 pr-4">Period</th>
                      <th className="py-1 pr-4">Amount</th>
                      <th className="py-1 pr-4">Principal</th>
                      <th className="py-1 pr-4">Interest</th>
                      <th className="py-1">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-slate-200">
                    {preview.schedule.map((row) => (
                      <tr key={row.installmentNumber}>
                        <td className="py-1 pr-4">{row.installmentNumber}</td>
                        <td className="py-1 pr-4">
                          {MONTH_NAMES[row.month - 1]} {row.year}
                        </td>
                        <td className="py-1 pr-4">{formatCurrency(row.amount)}</td>
                        <td className="py-1 pr-4">
                          {formatCurrency(row.principalComponent)}
                        </td>
                        <td className="py-1 pr-4">
                          {formatCurrency(row.interestComponent)}
                        </td>
                        <td className="py-1">{formatCurrency(row.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </form>
      )}

      <div className="flex gap-2 mb-4">
        {['', 'active', 'on_hold', 'completed', 'cancelled'].map((status) => (
          <button
            key={status || 'all'}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
            }`}
          >
            {status ? STATUS_LABELS[status] : 'All'}
          </button>
        ))}
      </div>

      {loadError && (
        <Alert
          severity="error"
          className="mb-4"
          action={
            <button onClick={fetchLoans} className="px-3 py-1 text-sm font-semibold underline">
              Retry
            </button>
          }
        >
          {loadError}
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-gray-100 dark:bg-slate-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : loans.length === 0 && !loadError ? (
        <div className="p-10 text-center border border-dashed border-gray-300 dark:border-slate-700 rounded-xl">
          <p className="text-gray-500 dark:text-slate-400">
            No salary advances recorded yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {loans.map((loan) => (
            <div
              key={loan._id}
              className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
            >
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg text-gray-900 dark:text-white">
                      {loan.employeeName}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        STATUS_STYLES[loan.status] || STATUS_STYLES.cancelled
                      }`}
                    >
                      {STATUS_LABELS[loan.status] || loan.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {formatCurrency(loan.principal)} over {loan.tenureMonths} months ·{' '}
                    {formatCurrency(loan.installmentAmount)}/month
                  </p>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mt-1">
                    Outstanding: {formatCurrency(loan.outstanding)}
                  </p>
                </div>

                {(loan.status === 'active' || loan.status === 'on_hold') && (
                  <div className="flex gap-2">
                    {loan.status === 'active' ? (
                      <button
                        disabled={busy}
                        onClick={() => handleStatusChange(loan._id, 'on_hold')}
                        className="px-3 py-1.5 border border-amber-500 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => handleStatusChange(loan._id, 'active')}
                        className="px-3 py-1.5 border border-green-500 text-green-600 dark:text-green-400 rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => handleStatusChange(loan._id, 'cancelled')}
                      className="px-3 py-1.5 border border-red-500 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${progressFor(loan)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {formatCurrency(loan.totalRepaid)} of{' '}
                  {formatCurrency(loan.totalPayable)} repaid ({progressFor(loan)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Loans;
