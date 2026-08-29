import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * The mobility desk (#1348).
 *
 * The roster leads with the day count rather than with the assignment details,
 * because "who is close to 183 days" is the question this page is opened for
 * and it is the one with a deadline attached. Everything else about an
 * assignment can wait a week; a day count that crosses the treaty threshold
 * unnoticed creates a filing obligation the employer did not plan for.
 *
 * The settlement panel spells out the direction of the figure in words. The
 * sign on an equalization settlement is the single most misread number in the
 * whole arrangement, and "₹1,80,000" on its own does not say who pays whom.
 */

const ASSIGNMENT_TYPES = [
  { value: 'short_term', label: 'Short term' },
  { value: 'long_term', label: 'Long term' },
  { value: 'commuter', label: 'Commuter' },
  { value: 'permanent_transfer', label: 'Permanent transfer' },
];

const TAX_APPROACHES = [
  {
    value: 'equalization',
    label: 'Equalization',
    hint: 'Employee held to their home tax position exactly; the employer keeps any saving',
  },
  {
    value: 'protection',
    label: 'Protection',
    hint: 'Employee held no worse off than home, and keeps any windfall',
  },
  {
    value: 'laissez_faire',
    label: 'None',
    hint: 'Employee carries their actual tax wherever it falls',
  },
];

const EXPOSURE_STYLES = {
  within:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  approaching:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  exceeded: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_STYLES = {
  proposed: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  active:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  completed: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};


const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403) {
    return 'You do not have permission to manage international assignments.';
  }
  return response.data?.message || fallback;
};

const emptyForm = () => ({
  employeeId: '',
  assignmentType: 'long_term',
  homeCountry: '',
  hostCountry: '',
  homeCurrency: 'INR',
  hostCurrency: 'USD',
  startDate: '',
  endDate: '',
  taxApproach: 'equalization',
  hostPayrollPercent: 0,
  homeBaseSalary: '',
  homeBonus: '',
  treatyDayThreshold: 183,
});

const GlobalMobilityDesk = () => {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [trip, setTrip] = useState({ arrival: '', departure: '', purpose: '' });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const res = await api.get('/api/assignments');
      setAssignments(
        Array.isArray(res.data?.assignments) ? res.data.assignments : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load the assignment roster.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(
    async (assignmentId) => {
      setSelected(assignmentId);
      setDetail(null);

      try {
        const res = await api.get(`/api/assignments/${assignmentId}`);
        setDetail(res.data || null);
      } catch (error) {
        toast.error(describeError(error, 'Could not load the assignment.'));
      }
    },
    [toast],
  );

  const setField = (key) => (event) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.post('/api/assignments', {
        ...form,
        homeBaseSalary: Number(form.homeBaseSalary) || 0,
        homeBonus: Number(form.homeBonus) || 0,
        hostPayrollPercent: Number(form.hostPayrollPercent) || 0,
        treatyDayThreshold: Number(form.treatyDayThreshold) || 183,
        endDate: form.endDate || null,
      });

      toast.success('Assignment created.');
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (error) {
      toast.error(describeError(error, 'Could not create the assignment.'));
    } finally {
      setBusy(false);
    }
  };

  const logTrip = async (event) => {
    event.preventDefault();
    if (!selected) return;

    setBusy(true);

    try {
      const res = await api.post(`/api/assignments/${selected}/presence`, trip);

      const exposure = res.data?.exposure;

      if (exposure?.status === 'exceeded') {
        toast.error(exposure.message);
      } else if (exposure?.status === 'approaching') {
        toast.warning(exposure.message);
      } else {
        toast.success(`Recorded. ${exposure?.message || ''}`);
      }

      setTrip({ arrival: '', departure: '', purpose: '' });
      await Promise.all([load(), openDetail(selected)]);
    } catch (error) {
      toast.error(describeError(error, 'Could not record the trip.'));
    } finally {
      setBusy(false);
    }
  };

  const atRisk = useMemo(
    () => assignments.filter((row) => row.exposure?.status !== 'within'),
    [assignments],
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading the assignment roster…
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
            Global Mobility
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            International assignments, their treaty day counts and their tax
            equalization settlements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
        >
          {showForm ? 'Close' : 'Open an assignment'}
        </button>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300"
        >
          {loadError}
        </p>
      )}

      {atRisk.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
            {atRisk.length} assignment{atRisk.length === 1 ? '' : 's'} at or
            near a treaty threshold
          </h2>
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
            {atRisk.map((row) => (
              <li key={row._id}>
                {row.employeeId?.fullName || 'Unnamed'} — {row.exposure.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={create}
          className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl grid gap-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            New assignment
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="text-sm text-gray-700 dark:text-slate-300">
              Employee id
              <input
                type="text"
                required
                value={form.employeeId}
                onChange={setField('employeeId')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Type
              <select
                value={form.assignmentType}
                onChange={setField('assignmentType')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {ASSIGNMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Home country
              <input
                type="text"
                required
                value={form.homeCountry}
                onChange={setField('homeCountry')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Host country
              <input
                type="text"
                required
                value={form.hostCountry}
                onChange={setField('hostCountry')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Start
              <input
                type="date"
                required
                value={form.startDate}
                onChange={setField('startDate')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              End
              <input
                type="date"
                value={form.endDate}
                onChange={setField('endDate')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Home base salary
              <input
                type="number"
                required
                min="0"
                value={form.homeBaseSalary}
                onChange={setField('homeBaseSalary')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Home bonus
              <input
                type="number"
                min="0"
                value={form.homeBonus}
                onChange={setField('homeBonus')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300 sm:col-span-2">
              Tax approach
              <select
                value={form.taxApproach}
                onChange={setField('taxApproach')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              >
                {TAX_APPROACHES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                {
                  TAX_APPROACHES.find(
                    (option) => option.value === form.taxApproach,
                  )?.hint
                }
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Treaty day threshold
              <input
                type="number"
                min="1"
                max="366"
                value={form.treatyDayThreshold}
                onChange={setField('treatyDayThreshold')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
              <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
                Treaty-specific — 183 is usual, not universal
              </span>
            </label>

            <label className="text-sm text-gray-700 dark:text-slate-300">
              Host payroll %
              <input
                type="number"
                min="0"
                max="100"
                value={form.hostPayrollPercent}
                onChange={setField('hostPayrollPercent')}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
              />
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
            >
              {busy ? 'Working…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {/* ── Roster ───────────────────────────────────────────────────── */}
      <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Assignments
        </h2>

        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            No assignments on record.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="py-2 pr-4">Employee</th>
                  <th className="py-2 pr-4">Route</th>
                  <th className="py-2 pr-4">Approach</th>
                  <th className="py-2 pr-4">Dates</th>
                  <th className="py-2 pr-4 text-right">Days present</th>
                  <th className="py-2 pr-4">Treaty</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => openDetail(row._id)}
                    className={`border-t border-gray-100 dark:border-slate-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                      selected === row._id
                        ? 'bg-gray-50 dark:bg-slate-800/50'
                        : ''
                    }`}
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {row.employeeId?.fullName || '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {row.homeCountry} → {row.hostCountry}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {
                        TAX_APPROACHES.find(
                          (option) => option.value === row.taxApproach,
                        )?.label
                      }
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {formatDate(row.startDate)} – {formatDate(row.endDate)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-900 dark:text-white">
                      {row.presenceDays}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          EXPOSURE_STYLES[row.exposure?.status] ||
                          EXPOSURE_STYLES.within
                        }`}
                      >
                        {row.exposure?.remaining} left
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          STATUS_STYLES[row.status] || STATUS_STYLES.proposed
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Detail ───────────────────────────────────────────────────── */}
      {detail && (
        <>
          <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Physical presence
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-500 mb-4">
              Every part of a day counts, including the day of arrival and the
              day of departure. {detail.exposure?.message}
            </p>

            <form
              onSubmit={logTrip}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <label className="text-sm text-gray-700 dark:text-slate-300">
                Arrival
                <input
                  type="date"
                  required
                  value={trip.arrival}
                  onChange={(event) =>
                    setTrip((previous) => ({
                      ...previous,
                      arrival: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-slate-300">
                Departure
                <input
                  type="date"
                  value={trip.departure}
                  onChange={(event) =>
                    setTrip((previous) => ({
                      ...previous,
                      departure: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-slate-300">
                Purpose
                <input
                  type="text"
                  value={trip.purpose}
                  onChange={(event) =>
                    setTrip((previous) => ({
                      ...previous,
                      purpose: event.target.value,
                    }))
                  }
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
              >
                Log trip
              </button>
            </form>

            {detail.assignment?.presencePeriods?.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {detail.assignment.presencePeriods.map((period, index) => (
                  <li
                    key={`${period.arrival}-${index}`}
                    className="flex justify-between border-b border-gray-100 dark:border-slate-800 py-1.5"
                  >
                    <span className="text-gray-700 dark:text-slate-300">
                      {formatDate(period.arrival)} –{' '}
                      {formatDate(period.departure)}
                    </span>
                    <span className="text-gray-500 dark:text-slate-500">
                      {period.purpose || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {detail.assignment?.approvedCost?.totalCost > 0 && (
            <section className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Approved cost
              </h2>
              <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(
                  detail.assignment.approvedCost.totalCost,
                  detail.assignment.homeCurrency,
                )}
                <span className="text-sm font-normal text-gray-500 dark:text-slate-500 ml-2">
                  ×{detail.assignment.approvedCost.costMultiple} base salary
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                Approved {formatDate(detail.assignment.approvedCost.approvedAt)}
                . Net of a hypothetical tax credit of{' '}
                {formatCurrency(
                  detail.assignment.approvedCost.hypotheticalTaxCredit,
                  detail.assignment.homeCurrency,
                )}
                .
              </p>
            </section>
          )}

          {detail.settlements?.length > 0 && (
            <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Equalization settlements
              </h2>

              <ul className="space-y-4">
                {detail.settlements.map((settlement) => (
                  <li
                    key={settlement._id}
                    className="border-b border-gray-100 dark:border-slate-800 pb-4 last:border-0"
                  >
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Tax year {settlement.taxYear}
                      </span>
                      <span
                        className={`font-mono ${
                          settlement.settlement > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {settlement.settlementDirection ===
                        'employee_owes_company'
                          ? `Employee owes the company ${formatCurrency(Math.abs(settlement.settlement))}`
                          : settlement.settlementDirection ===
                              'company_owes_employee'
                            ? `Company owes the employee ${formatCurrency(Math.abs(settlement.settlement))}`
                            : 'Settled'}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {[
                        ['Hypo tax', settlement.hypotheticalTax],
                        ['Withheld', settlement.hypoTaxWithheld],
                        ['Actual tax', settlement.actualTotalTax],
                        ['Employer bore', settlement.employerBears],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-gray-500 dark:text-slate-500">
                            {label}
                          </dt>
                          <dd className="font-mono text-gray-900 dark:text-white">
                            {formatCurrency(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <p className="mt-2 text-xs text-gray-600 dark:text-slate-400">
                      {settlement.note}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default GlobalMobilityDesk;
