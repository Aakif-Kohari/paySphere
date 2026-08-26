import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * The Payment of Bonus Act register (#1346).
 *
 * Organised in the order the Act computes in — the accounts, then the surplus,
 * then the allocation, then who gets what — because the middle two steps are
 * where every question comes from. "Why is the rate 11.4% and not 20%" is
 * answered by the allocable surplus falling between the section 10 minimum and
 * the section 11 maximum, and that has to be visible rather than derivable.
 *
 * The set-on / set-off ledger gets its own panel for the same reason: it is a
 * four-year running balance, it is the part nobody maintains correctly, and a
 * number that came out of it needs to show its working.
 */

const PRIOR_CHARGES = [
  ['depreciation', 'Depreciation', 'Section 6(a)'],
  ['developmentRebate', 'Development rebate / allowance', 'Section 6(b)'],
  ['directTax', 'Direct tax payable', 'Section 6(c)'],
  ['otherPriorCharges', 'Other prescribed sums', 'Section 6(d)'],
];

const EXCLUSION_LABELS = {
  WAGE_CEILING: 'Over the wage ceiling',
  INSUFFICIENT_DAYS: 'Under thirty working days',
  DISQUALIFIED: 'Disqualified under section 9',
  NO_WAGE_DATA: 'No wage data',
};


const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to run the statutory bonus computation.';
  }
  return response.data?.message || fallback;
};

const defaultAccountingYear = () => {
  const today = new Date();
  return today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
};

const StatutoryBonusRegister = () => {
  const [form, setForm] = useState({
    accountingYear: defaultAccountingYear(),
    grossProfit: '',
    depreciation: '',
    developmentRebate: '',
    directTax: '',
    otherPriorCharges: '',
    employerType: 'COMPANY',
    minimumWage: '',
  });

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showExclusions, setShowExclusions] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [historyRes, ledgerRes] = await Promise.all([
        api.get('/api/statutory-bonus/computations'),
        api.get('/api/statutory-bonus/ledger'),
      ]);

      setHistory(
        Array.isArray(historyRes.data?.computations)
          ? historyRes.data.computations
          : [],
      );
      setLedger(ledgerRes.data || null);
    } catch (error) {
      setLoadError(describeError(error, 'Could not load the bonus register.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key) => (event) => {
    setForm((previous) => ({ ...previous, [key]: event.target.value }));
    setResult(null);
  };

  const payload = useMemo(
    () => ({
      accountingYear: Number(form.accountingYear) || defaultAccountingYear(),
      grossProfit: Number(form.grossProfit) || 0,
      depreciation: Number(form.depreciation) || 0,
      developmentRebate: Number(form.developmentRebate) || 0,
      directTax: Number(form.directTax) || 0,
      otherPriorCharges: Number(form.otherPriorCharges) || 0,
      employerType: form.employerType,
      minimumWage: Number(form.minimumWage) || 0,
    }),
    [form],
  );

  const preview = async () => {
    setBusy(true);

    try {
      const res = await api.post('/api/statutory-bonus/preview', payload);
      setResult(res.data?.result || null);
    } catch (error) {
      setResult(null);
      toast.error(describeError(error, 'Could not compute the bonus.'));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);

    try {
      const res = await api.post('/api/statutory-bonus/computations', payload);
      toast.success(res.data?.message || 'Computation committed.');
      await load();
    } catch (error) {
      toast.error(describeError(error, 'Could not commit the computation.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the statutory bonus register…
        </p>
      </div>
    );
  }

  const allocation = result?.allocation;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Statutory Bonus
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Payment of Bonus Act, 1965. Between 8.33% and 20% of qualifying
            wages — not the discretionary bonus on a payroll run.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={preview}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            {busy ? 'Working…' : 'Compute'}
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={busy || !result?.applicable}
            title={
              result?.applicable
                ? 'Commit this computation for the accounting year'
                : 'Compute first'
            }
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
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

      {/* ── The accounts ─────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          The accounts
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
          Gross profit and the section 6 prior charges come out of the audited
          accounts. Everything below is computed from them.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Accounting year
            <input
              type="number"
              value={form.accountingYear}
              onChange={setField('accountingYear')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              Named for the calendar year it ends in
            </span>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Gross profit
            <input
              type="number"
              value={form.grossProfit}
              onChange={setField('grossProfit')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          {PRIOR_CHARGES.map(([key, label, section]) => (
            <label
              key={key}
              className="text-sm text-gray-700 dark:text-slate-300"
            >
              {label}
              <input
                type="number"
                value={form[key]}
                onChange={setField(key)}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                {section}
              </span>
            </label>
          ))}

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Employer type
            <select
              value={form.employerType}
              onChange={setField('employerType')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              <option value="COMPANY">Company — 67% allocable</option>
              <option value="OTHER">Any other case — 60% allocable</option>
            </select>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Scheduled minimum wage
            <input
              type="number"
              value={form.minimumWage}
              onChange={setField('minimumWage')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              Section 12 computes on the higher of ₹7,000 and this
            </span>
          </label>
        </div>
      </section>

      {result && !result.applicable && (
        <p className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
          The Act does not apply to this establishment:{' '}
          {result.coverage?.reason}
        </p>
      )}

      {result && allocation && (
        <>
          {/* ── The allocation ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              ['Qualifying wages', formatCurrency(result.totalQualifyingWages)],
              [
                'Allocable surplus',
                formatCurrency(result.allocable?.allocableSurplus),
              ],
              ['Bonus payable', formatCurrency(allocation.payableBonus)],
              ['Rate', `${allocation.bonusPercent}%`],
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

          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              How the rate was arrived at
            </h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {[
                ['Gross profit', result.surplus?.grossProfit],
                [
                  'Less: section 6 prior charges',
                  -(result.surplus?.priorCharges || 0),
                ],
                ['Available surplus', result.surplus?.availableSurplus],
                [
                  `Allocable surplus (${Math.round((result.allocable?.share || 0) * 100)}%)`,
                  result.allocable?.allocableSurplus,
                ],
                ['Section 10 minimum — 8.33%', allocation.minimumBonus],
                ['Section 11 maximum — 20%', allocation.maximumBonus],
                [
                  'Drawn from set on carried forward',
                  allocation.drawnFromSetOn,
                ],
                ['Set on this year', allocation.setOn],
                ['Set off this year', allocation.setOff],
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
            </dl>

            <p className="mt-4 text-sm text-gray-700 dark:text-slate-300">
              {allocation.basis}
            </p>

            {result.paymentDueBy && (
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                Section 19 requires payment by{' '}
                <strong>{formatDate(result.paymentDueBy)}</strong>.
              </p>
            )}
          </section>

          {/* ── Form C ─────────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Form C — {result.eligibleCount} eligible employees
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Designation</th>
                    <th className="py-2 pr-4 text-right">Days</th>
                    <th className="py-2 pr-4 text-right">Monthly wage</th>
                    <th className="py-2 pr-4 text-right">Wages u/s 12</th>
                    <th className="py-2 text-right">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {result.register.map((row) => (
                    <tr
                      key={String(row.employeeId)}
                      className="border-t border-gray-100 dark:border-slate-800"
                    >
                      <td className="py-2 pr-4 text-gray-900 dark:text-white">
                        {row.name || '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                        {row.designation || '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-600 dark:text-slate-400">
                        {row.daysWorked}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-gray-600 dark:text-slate-400">
                        {formatCurrency(row.monthlyWage)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-gray-600 dark:text-slate-400">
                        {formatCurrency(row.qualifyingWages)}
                      </td>
                      <td className="py-2 text-right font-mono text-gray-900 dark:text-white">
                        {formatCurrency(row.bonusPayable)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Exclusions ─────────────────────────────────────────── */}
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Not in the register ({result.excludedCount})
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  “Why did this person not get a bonus” is an inspection
                  question, so every exclusion carries its section.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExclusions((value) => !value)}
                aria-expanded={showExclusions}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {showExclusions ? 'Hide' : 'Show'}
              </button>
            </div>

            {showExclusions && (
              <ul className="mt-4 space-y-2">
                {result.excluded.map((row) => (
                  <li
                    key={String(row.employeeId)}
                    className="flex flex-wrap items-baseline gap-2 text-sm"
                  >
                    <span className="text-gray-900 dark:text-white">
                      {row.name || '—'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400">
                      {EXCLUSION_LABELS[row.code] || row.code}
                    </span>
                    <span className="text-gray-600 dark:text-slate-400">
                      {row.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* ── Ledger ───────────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Set on / set off
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
          Section 15 carries each amount into the four succeeding accounting
          years. An entry that ages out is spent whether it was used or not.
        </p>

        {!ledger?.entries?.length ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Nothing carried forward.
          </p>
        ) : (
          <>
            <div className="flex gap-6 mb-4 text-sm">
              <span className="text-gray-600 dark:text-slate-400">
                Set on available:{' '}
                <span className="font-mono text-gray-900 dark:text-white">
                  {formatCurrency(ledger.totalSetOn)}
                </span>
              </span>
              <span className="text-gray-600 dark:text-slate-400">
                Set off outstanding:{' '}
                <span className="font-mono text-gray-900 dark:text-white">
                  {formatCurrency(ledger.totalSetOff)}
                </span>
              </span>
            </div>

            <ul className="space-y-1 text-sm">
              {ledger.entries.map((entry) => (
                <li
                  key={`${entry.accountingYear}-${entry.type}`}
                  className="flex justify-between border-b border-gray-100 dark:border-slate-800 py-1.5"
                >
                  <span className="text-gray-600 dark:text-slate-400">
                    {entry.accountingYear} —{' '}
                    {entry.type === 'set_on' ? 'set on' : 'set off'}
                    <span className="ml-2 text-xs text-gray-400 dark:text-slate-600">
                      lapses after {entry.accountingYear + 4}
                    </span>
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white">
                    {formatCurrency(entry.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── History ──────────────────────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Committed years
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No accounting year has been committed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="py-2 pr-4">Year</th>
                  <th className="py-2 pr-4 text-right">Payable</th>
                  <th className="py-2 pr-4 text-right">Rate</th>
                  <th className="py-2 pr-4 text-right">Eligible</th>
                  <th className="py-2 pr-4">Due by</th>
                  <th className="py-2">Form C</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row._id}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {row.accountingYear}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-900 dark:text-white">
                      {formatCurrency(row.payableBonus)}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-600 dark:text-slate-400">
                      {row.bonusPercent}%
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-600 dark:text-slate-400">
                      {row.eligibleCount}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {formatDate(row.paymentDueBy)}
                      {row.paidOn && (
                        <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                          paid {formatDate(row.paidOn)}
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <a
                        href={`/api/statutory-bonus/computations/${row._id}/form-c`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Download
                      </a>
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

export default StatutoryBonusRegister;
