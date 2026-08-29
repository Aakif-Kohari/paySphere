import { useCallback, useEffect, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Pay equity (#1347).
 *
 * The page leads with the distinction the whole feature turns on, because a
 * reader who misses it will draw the wrong conclusion from either number: the
 * headline gap mostly measures *where people sit*, and the cohort gap measures
 * *what they are paid for the same work*. A company with women concentrated in
 * lower grades shows a large headline gap and no cohort gap. A company that
 * pays one grade less shows the reverse. Both are findings; they are not the
 * same finding.
 *
 * Suppressed cohorts are shown as suppressed rather than hidden. A reader who
 * cannot see that eleven of nineteen cohorts were too small to report on does
 * not know how much of their workforce the analysis actually covered.
 */


const formatGap = (value) => {
  const gap = Number(value);
  if (!Number.isFinite(gap)) return '—';
  return `${gap > 0 ? '' : '+'}${(-gap * 100).toFixed(1)}%`;
};

const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to view the pay equity analysis.';
  }
  return response.data?.message || fallback;
};

const PayEquityDashboard = () => {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [minimumCohortSize, setMinimumCohortSize] = useState(5);
  const [referenceGroup, setReferenceGroup] = useState('male');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSuppressed, setShowSuppressed] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [previewRes, historyRes] = await Promise.all([
        api.get('/api/pay-equity/preview', {
          params: { minimumCohortSize, referenceGroup },
        }),
        api.get('/api/pay-equity/reports'),
      ]);

      setReport(previewRes.data?.report || null);
      setHistory(
        Array.isArray(historyRes.data?.reports) ? historyRes.data.reports : [],
      );
    } catch (error) {
      setReport(null);
      setLoadError(
        describeError(error, 'Could not load the pay equity analysis.'),
      );
    } finally {
      setLoading(false);
    }
  }, [minimumCohortSize, referenceGroup]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = async () => {
    setBusy(true);

    try {
      await api.post('/api/pay-equity/reports', {
        minimumCohortSize,
        referenceGroup,
      });
      toast.success('Report committed.');
      await load();
    } catch (error) {
      toast.error(describeError(error, 'Could not commit the report.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the pay equity analysis…
        </p>
      </div>
    );
  }

  const reportedCohorts = (report?.cohorts || []).filter(
    (cohort) => !cohort.suppressed,
  );
  const suppressedCohorts = (report?.cohorts || []).filter(
    (cohort) => cohort.suppressed,
  );

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Pay Equity
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            The headline gap measures where people sit. The cohort gap measures
            what they are paid for the same work. They routinely disagree, and
            both are findings.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Suppress below
            <input
              type="number"
              min="3"
              value={minimumCohortSize}
              onChange={(event) =>
                setMinimumCohortSize(Number(event.target.value) || 5)
              }
              className="mt-1 w-20 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Reference group
            <input
              type="text"
              value={referenceGroup}
              onChange={(event) => setReferenceGroup(event.target.value)}
              className="mt-1 w-32 p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={commit}
            disabled={busy || !report}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            Commit report
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

      {report && !report.demographics.usable && (
        <p className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
          <strong>No gap analysis.</strong> {report.demographics.message}.{' '}
          {report.demographics.undisclosed} of {report.headcount} employees have
          not declared a gender. The compa-ratio analysis below does not need it
          and is unaffected.
        </p>
      )}

      {report?.demographics.usable && (
        <>
          {/* ── Headline ─────────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Headline gap
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
              Across the whole workforce, against the{' '}
              {report.options.referenceGroup} group. A positive figure means
              paid less.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(report.headline).map(([group, gap]) => (
                <div
                  key={group}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/40"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                    {group} — {gap.headcount} people
                  </p>
                  {gap.suppressed ? (
                    <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">
                      Suppressed — group too small to report on
                    </p>
                  ) : (
                    <>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatGap(gap.medianGap)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                        median · mean {formatGap(gap.meanGap)}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Quartiles ────────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Pay quartiles
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
              Everyone ordered by hourly pay and split into four groups of equal
              size — not four equal pay bands, which is a different and much
              less useful picture.
            </p>

            <div className="space-y-3">
              {report.quartiles.map((quartile) => (
                <div key={quartile.quartile}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-900 dark:text-white">
                      {quartile.label} ({quartile.headcount})
                    </span>
                    <span className="text-gray-500 dark:text-slate-500 font-mono text-xs">
                      {formatCurrency(quartile.lowestPay)}–
                      {formatCurrency(quartile.highestPay)} / hour
                    </span>
                  </div>
                  <div className="flex h-6 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800">
                    {Object.entries(quartile.proportions).map(
                      ([group, proportion]) => (
                        <div
                          key={group}
                          style={{ width: `${proportion * 100}%` }}
                          title={`${group}: ${(proportion * 100).toFixed(0)}%`}
                          className={`flex items-center justify-center text-[10px] font-semibold text-white ${
                            group === report.options.referenceGroup
                              ? 'bg-blue-500'
                              : group === 'undisclosed'
                                ? 'bg-gray-400 dark:bg-slate-600'
                                : 'bg-violet-500'
                          }`}
                        >
                          {proportion >= 0.12
                            ? `${group} ${(proportion * 100).toFixed(0)}%`
                            : ''}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Cohorts ──────────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Like-for-like gaps
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  Job level × department × tenure band. {report.materialCohorts}{' '}
                  cohort{report.materialCohorts === 1 ? '' : 's'} above the{' '}
                  {(report.options.materialGapThreshold * 100).toFixed(0)}%
                  threshold, {report.suppressedCohorts} suppressed as too small
                  to report on.
                </p>
              </div>
            </div>

            {reportedCohorts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-500">
                No cohort is large enough on both sides to compare.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                      <th className="py-2 pr-4">Level</th>
                      <th className="py-2 pr-4">Department</th>
                      <th className="py-2 pr-4">Tenure</th>
                      <th className="py-2 pr-4 text-right">People</th>
                      <th className="py-2 pr-4">Group</th>
                      <th className="py-2 text-right">Median gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportedCohorts.flatMap((cohort) =>
                      cohort.comparisons.map((comparison) => (
                        <tr
                          key={`${cohort.cohortKey}-${comparison.group}`}
                          className="border-t border-gray-100 dark:border-slate-800"
                        >
                          <td className="py-2 pr-4 text-gray-900 dark:text-white">
                            {cohort.jobLevel}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                            {cohort.department}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                            {cohort.tenureBandLabel}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-600 dark:text-slate-400">
                            {cohort.headcount}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                            {comparison.group}
                          </td>
                          <td className="py-2 text-right">
                            {comparison.suppressed ? (
                              <span className="text-xs text-gray-500 dark:text-slate-500">
                                suppressed
                              </span>
                            ) : (
                              <span
                                className={`font-mono ${
                                  comparison.material
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}
                              >
                                {formatGap(comparison.medianGap)}
                              </span>
                            )}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {suppressedCohorts.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowSuppressed((value) => !value)}
                  aria-expanded={showSuppressed}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showSuppressed ? 'Hide' : 'Show'} the{' '}
                  {suppressedCohorts.length} suppressed cohort
                  {suppressedCohorts.length === 1 ? '' : 's'}
                </button>

                {showSuppressed && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-slate-500">
                    {suppressedCohorts.map((cohort) => (
                      <li key={cohort.cohortKey}>
                        {cohort.jobLevel} · {cohort.department} ·{' '}
                        {cohort.tenureBandLabel} ({cohort.headcount}) —{' '}
                        {cohort.suppressionMessage}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ── Remediation ──────────────────────────────────────────── */}
          {report.remediation.actions.length > 0 && (
            <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                What closing the gaps would cost
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
                Raises to the{' '}
                {(report.options.materialGapThreshold * 100).toFixed(0)}%
                threshold, not to parity — and applied to the under-paid group
                only.
              </p>

              <p className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
                {formatCurrency(report.remediation.annualCost)}
                <span className="text-sm font-normal text-gray-500 dark:text-slate-500 ml-2">
                  a year, across {report.remediation.employeesAffected} people
                </span>
              </p>

              <ul className="space-y-2 text-sm">
                {report.remediation.actions.map((action) => (
                  <li
                    key={`${action.cohortKey}-${action.group}`}
                    className="flex flex-wrap justify-between gap-2 border-b border-gray-100 dark:border-slate-800 py-1.5"
                  >
                    <span className="text-gray-700 dark:text-slate-300">
                      {action.jobLevel} · {action.department} ·{' '}
                      {action.tenureBandLabel} — {action.group},{' '}
                      {action.employeesAffected} people
                    </span>
                    <span className="font-mono text-gray-900 dark:text-white">
                      {formatCurrency(action.annualCost)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* ── Compa-ratio ──────────────────────────────────────────────── */}
      {report && (
        <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Compa-ratio
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
            Pay against the band midpoint. Needs no demographic data at all, and
            works for every tenant that has set salary bands.
          </p>

          {report.compaSummary.covered === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-500">
              No salary bands are configured, so there is nothing to measure
              against. Set a band per job level to turn this on.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  ['Median compa-ratio', report.compaSummary.medianCompaRatio],
                  ['Below band', report.compaSummary.belowBand],
                  ['Above band', report.compaSummary.aboveBand],
                  [
                    'Under 0.8 of midpoint',
                    report.compaSummary.underMidpointBy20Percent,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/40"
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

              {report.compaOutliers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                        <th className="py-2 pr-4">Employee</th>
                        <th className="py-2 pr-4">Level</th>
                        <th className="py-2 pr-4">Department</th>
                        <th className="py-2 pr-4 text-right">Salary</th>
                        <th className="py-2 text-right">Compa-ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.compaOutliers.map((row) => (
                        <tr
                          key={String(row.employeeId)}
                          className="border-t border-gray-100 dark:border-slate-800"
                        >
                          <td className="py-2 pr-4 text-gray-900 dark:text-white">
                            {row.name}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                            {row.jobLevel}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                            {row.department}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-gray-600 dark:text-slate-400">
                            {formatCurrency(row.monthlySalary)}
                          </td>
                          <td className="py-2 text-right font-mono text-red-600 dark:text-red-400">
                            {row.compaRatio}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Trend ────────────────────────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Committed reports
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No report has been committed yet. The point of committing one is the
            year-on-year comparison — a gap figure means little on its own.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((row) => (
              <li
                key={row._id}
                className="flex flex-wrap justify-between gap-2 border-b border-gray-100 dark:border-slate-800 py-1.5"
              >
                <span className="text-gray-900 dark:text-white">
                  {formatDate(row.asOf)}
                  {row.periodLabel ? ` · ${row.periodLabel}` : ''}
                </span>
                <span className="text-gray-600 dark:text-slate-400">
                  {row.headcount} people · {row.materialCohorts} material cohort
                  {row.materialCohorts === 1 ? '' : 's'} ·{' '}
                  {formatCurrency(row.remediation?.annualCost)} to close
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default PayEquityDashboard;
