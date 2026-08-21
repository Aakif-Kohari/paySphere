import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';

/**
 * The gratuity provision, as finance is asked for it (#1344).
 *
 * The page is built around one distinction that the API also makes and that is
 * easy to lose in a UI: previewing a valuation and committing one are not the
 * same act. A preview is run several times while the discount rate is argued
 * over; a commit produces the figure that goes into the accounts and becomes
 * next year's opening balance. So the assumptions here are always editable, the
 * result of changing them is always a preview, and committing is a separate
 * button that says what it is going to do.
 */

const ASSUMPTION_FIELDS = [
  {
    key: 'discountRate',
    label: 'Discount rate',
    hint: 'Yield on government securities of comparable term (Ind AS 19 para 83)',
    step: 0.0005,
  },
  {
    key: 'salaryEscalationRate',
    label: 'Salary escalation',
    hint: 'Expected long-term salary growth, compounded annually',
    step: 0.0025,
  },
  {
    key: 'attritionRate',
    label: 'Attrition',
    hint: 'Probability an employee leaves in any one year before retirement',
    step: 0.0025,
  },
  {
    key: 'expectedReturnOnPlanAssets',
    label: 'Return on plan assets',
    hint: 'Only meaningful for a funded scheme',
    step: 0.0025,
  },
  {
    key: 'gratuityWageRatio',
    label: 'Gratuity wage ratio',
    hint: 'Share of monthly pay that is basic + DA — section 2(s) wages',
    step: 0.01,
  },
];

const SENSITIVITY_LABELS = {
  discountRate: 'Discount rate',
  salaryEscalationRate: 'Salary escalation',
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
};

const formatPercent = (value, digits = 2) => {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN');
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';

  if (response.status === 403) {
    return 'You do not have permission to run a gratuity valuation.';
  }

  return response.data?.message || fallback;
};

/** The last day of the Indian financial year the given date falls in. */
const defaultValuationDate = () => {
  const today = new Date();
  const year =
    today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
  return `${year}-03-31`;
};

const GratuityProvisioning = () => {
  const [assumptions, setAssumptions] = useState(null);
  const [basisNote, setBasisNote] = useState('');
  const [valuationDate, setValuationDate] = useState(defaultValuationDate);
  const [planAssets, setPlanAssets] = useState({
    openingPlanAssets: '',
    contributions: '',
    benefitsPaid: '',
  });

  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const { toast } = useToast();

  const loadContext = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [assumptionRes, historyRes] = await Promise.all([
        api.get('/api/gratuity/assumptions'),
        api.get('/api/gratuity/valuations'),
      ]);

      setAssumptions(assumptionRes.data?.assumptions || null);
      setBasisNote(assumptionRes.data?.basisNote || '');
      setHistory(
        Array.isArray(historyRes.data?.valuations)
          ? historyRes.data.valuations
          : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the gratuity valuation.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const setAssumption = (key) => (event) => {
    const raw = event.target.value;
    setAssumptions((previous) => ({ ...previous, [key]: raw }));
  };

  const setPlanAsset = (key) => (event) => {
    const raw = event.target.value;
    setPlanAssets((previous) => ({ ...previous, [key]: raw }));
  };

  /**
   * The percentage inputs are held as strings while they are being typed —
   * otherwise "0.0" collapses to 0 mid-keystroke and the field fights the user
   * — and coerced once, here, on the way to the server.
   */
  const payload = useMemo(() => {
    const numeric = {};

    for (const field of ASSUMPTION_FIELDS) {
      const value = Number(assumptions?.[field.key]);
      if (Number.isFinite(value)) numeric[field.key] = value;
    }

    const retirementAge = Number(assumptions?.retirementAge);
    if (Number.isFinite(retirementAge)) numeric.retirementAge = retirementAge;

    return {
      valuationDate,
      assumptions: numeric,
      openingPlanAssets: Number(planAssets.openingPlanAssets) || 0,
      contributions: Number(planAssets.contributions) || 0,
      benefitsPaid: Number(planAssets.benefitsPaid) || 0,
    };
  }, [assumptions, valuationDate, planAssets]);

  const runPreview = async () => {
    setBusy(true);

    try {
      const res = await api.post('/api/gratuity/preview', payload);
      setReport(res.data?.report || null);
      toast.success('Valuation previewed. Nothing has been committed.');
    } catch (error) {
      setReport(null);
      toast.error(describeError(error, 'Could not run the valuation.'));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);

    try {
      await api.post('/api/gratuity/valuations', { ...payload, basisNote });
      toast.success(`Valuation committed as at ${formatDate(valuationDate)}.`);
      await loadContext();
    } catch (error) {
      toast.error(describeError(error, 'Could not commit the valuation.'));
    } finally {
      setBusy(false);
    }
  };

  const saveAssumptions = async () => {
    setBusy(true);

    try {
      await api.put('/api/gratuity/assumptions', {
        assumptions: payload.assumptions,
        basisNote,
      });
      toast.success('Assumptions saved.');
    } catch (error) {
      toast.error(describeError(error, 'Could not save the assumptions.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the gratuity valuation…
        </p>
      </div>
    );
  }

  const roll = report?.rollForward;
  const funded = report?.fundedStatus;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Gratuity Provisioning
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Defined benefit obligation measured by the Projected Unit Credit
            method, over every employee still accruing a benefit.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition"
          >
            {busy ? 'Working…' : 'Preview valuation'}
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={busy || !report}
            title={
              report
                ? 'Commit this valuation as the reported provision'
                : 'Preview a valuation first'
            }
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition"
          >
            Commit
          </button>
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* ── Assumptions ───────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Actuarial assumptions
          </h2>
          <button
            type="button"
            onClick={saveAssumptions}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Save as the tenant default
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Valuation date
            <input
              type="date"
              value={valuationDate}
              onChange={(event) => setValuationDate(event.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              The reporting date the provision is as at
            </span>
          </label>

          {ASSUMPTION_FIELDS.map((field) => (
            <label
              key={field.key}
              className="text-sm text-gray-700 dark:text-slate-300"
            >
              {field.label}
              <input
                type="number"
                step={field.step}
                value={assumptions?.[field.key] ?? ''}
                onChange={setAssumption(field.key)}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                {field.hint}
              </span>
            </label>
          ))}

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Retirement age
            <input
              type="number"
              step={1}
              value={assumptions?.retirementAge ?? ''}
              onChange={setAssumption('retirementAge')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>
        </div>

        <label className="block mt-4 text-sm text-gray-700 dark:text-slate-300">
          Basis of the discount rate
          <textarea
            rows={2}
            value={basisNote}
            onChange={(event) => setBasisNote(event.target.value)}
            placeholder="e.g. 10-year G-Sec yield as at the valuation date, 7.15%"
            className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
          />
          <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
            Carried onto every valuation run under these assumptions — “why this
            rate” has an answer and it belongs next to the number.
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Opening plan assets
            <input
              type="number"
              value={planAssets.openingPlanAssets}
              onChange={setPlanAsset('openingPlanAssets')}
              placeholder="0 for an unfunded scheme"
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Contributions in the year
            <input
              type="number"
              value={planAssets.contributions}
              onChange={setPlanAsset('contributions')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Benefits paid in the year
            <input
              type="number"
              value={planAssets.benefitsPaid}
              onChange={setPlanAsset('benefitsPaid')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>
        </div>
      </section>

      {report && (
        <>
          {/* ── Headline ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              [
                'Defined benefit obligation',
                formatCurrency(report.definedBenefitObligation),
              ],
              [
                'Current service cost',
                formatCurrency(report.currentServiceCost),
              ],
              [
                'Expense for the period',
                formatCurrency(report.expenseForPeriod),
              ],
              [
                funded?.status === 'surplus' ? 'Surplus' : 'Net liability',
                formatCurrency(Math.abs(funded?.netLiability || 0)),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              >
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  {label}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {report.recordsWithAssumedAge > 0 && (
            <p className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
              {report.recordsWithAssumedAge} of {report.headcountValued} records
              have no date of birth, so their retirement date was assumed. The
              obligation for those employees is an estimate on an estimate.
            </p>
          )}

          {report.headcountSkipped > 0 && (
            <p className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
              {report.headcountSkipped} employee record
              {report.headcountSkipped === 1 ? '' : 's'} could not be valued and{' '}
              {report.headcountSkipped === 1 ? 'is' : 'are'} excluded from the
              obligation — see the schedule below.
            </p>
          )}

          {/* ── Roll-forward ─────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Obligation roll-forward
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {[
                ['Opening obligation', roll.openingDbo],
                ['Current service cost', roll.currentServiceCost],
                ['Past service cost', roll.pastServiceCost],
                ['Interest cost', roll.interestCost],
                ['Benefits paid', -roll.benefitsPaid],
                [
                  roll.outcome === 'loss' ? 'Actuarial loss' : 'Actuarial gain',
                  roll.actuarialGainLoss,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-gray-100 dark:border-slate-800 py-1.5"
                >
                  <dt className="text-gray-600 dark:text-slate-400">{label}</dt>
                  <dd className="font-mono text-gray-900 dark:text-white">
                    {formatCurrency(value)}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between py-1.5 font-semibold sm:col-span-2">
                <dt className="text-gray-900 dark:text-white">
                  Closing obligation
                </dt>
                <dd className="font-mono text-gray-900 dark:text-white">
                  {formatCurrency(roll.closingDbo)}
                </dd>
              </div>
            </dl>

            {roll.assumptionChange !== null && (
              <p className="mt-4 text-sm text-gray-600 dark:text-slate-400">
                Of the actuarial movement,{' '}
                <span className="font-mono">
                  {formatCurrency(roll.assumptionChange)}
                </span>{' '}
                came from the change in assumptions and{' '}
                <span className="font-mono">
                  {formatCurrency(roll.experienceAdjustment)}
                </span>{' '}
                from experience differing from what was assumed.
              </p>
            )}
          </section>

          {/* ── Sensitivities ────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Sensitivity of the obligation
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
              A required disclosure. Raising the discount rate lowers the
              obligation; raising salary escalation raises it.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                    <th className="py-2 pr-4">Assumption</th>
                    <th className="py-2 pr-4">Shift</th>
                    <th className="py-2 pr-4 text-right">Obligation</th>
                    <th className="py-2 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sensitivities.map((row) => (
                    <tr
                      key={`${row.assumption}-${row.direction}`}
                      className="border-t border-gray-100 dark:border-slate-800"
                    >
                      <td className="py-2 pr-4 text-gray-900 dark:text-white">
                        {SENSITIVITY_LABELS[row.assumption] || row.assumption}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                        {row.shift > 0 ? '+' : ''}
                        {formatPercent(row.shift)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-gray-900 dark:text-white">
                        {formatCurrency(row.definedBenefitObligation)}
                      </td>
                      <td
                        className={`py-2 text-right font-mono ${
                          row.change > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {row.change > 0 ? '+' : ''}
                        {formatCurrency(row.change)} ({row.changePercent}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Per-employee schedule ────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Schedule ({report.headcountValued} employees)
              </h2>
              <button
                type="button"
                onClick={() => setShowSchedule((value) => !value)}
                aria-expanded={showSchedule}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {showSchedule ? 'Hide' : 'Show'}
              </button>
            </div>

            {showSchedule && (
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                      <th className="py-2 pr-4">Employee</th>
                      <th className="py-2 pr-4">Department</th>
                      <th className="py-2 pr-4 text-right">Service</th>
                      <th className="py-2 pr-4">Vested</th>
                      <th className="py-2 pr-4 text-right">Obligation</th>
                      <th className="py-2 text-right">Service cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.schedule.map((row) => (
                      <tr
                        key={String(row.employeeId)}
                        className="border-t border-gray-100 dark:border-slate-800"
                      >
                        <td className="py-2 pr-4 text-gray-900 dark:text-white">
                          {row.name || '—'}
                          {row.ceilingApplied && (
                            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                              ceiling
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                          {row.department || '—'}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-gray-600 dark:text-slate-400">
                          {row.pastServiceYears.toFixed(1)}y
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              row.vested
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {row.vested ? 'Vested' : 'Not yet'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-gray-900 dark:text-white">
                          {formatCurrency(row.definedBenefitObligation)}
                        </td>
                        <td className="py-2 text-right font-mono text-gray-600 dark:text-slate-400">
                          {formatCurrency(row.currentServiceCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {report.skipped.length > 0 && (
                  <ul className="mt-4 space-y-1 text-xs text-red-600 dark:text-red-400">
                    {report.skipped.map((row, index) => (
                      <li key={`${row.employeeId || 'unknown'}-${index}`}>
                        {row.name || 'Unnamed record'} — {row.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Committed valuations
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No valuation has been committed yet. Preview one above, then commit
            it to record the provision for a reporting date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="py-2 pr-4">As at</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Obligation</th>
                  <th className="py-2 pr-4 text-right">Discount rate</th>
                  <th className="py-2 text-right">Headcount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row._id}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {formatDate(row.valuationDate)}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {row.periodLabel || '—'}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-900 dark:text-white">
                      {formatCurrency(row.definedBenefitObligation)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-600 dark:text-slate-400">
                      {formatPercent(row.assumptions?.discountRate)}
                    </td>
                    <td className="py-2 text-right text-gray-600 dark:text-slate-400">
                      {row.headcountValued}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default GratuityProvisioning;
