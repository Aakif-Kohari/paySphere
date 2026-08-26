import { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatLocale';

/**
 * Filing a Leave Travel Allowance journey (#1345).
 *
 * The page is organised around the entitlement rather than around the form,
 * because the entitlement is the thing employees do not know and cannot work
 * out. "You have one journey left in the 2026-2029 block, plus one carried
 * forward that expires at the end of 2026" is the answer to the question they
 * actually have; the form is secondary.
 *
 * The preview call exists for the same reason: an employee about to book
 * business class should find out that only the economy fare is exempt before
 * they book it.
 */

const TRAVEL_MODES = [
  { value: 'air', label: 'Air', ceiling: 'economyAirFare' },
  { value: 'rail', label: 'Rail', ceiling: 'acFirstClassRailFare' },
  {
    value: 'public_transport',
    label: 'Bus / other public transport',
    ceiling: 'deluxeBusFare',
  },
  {
    value: 'other',
    label: 'No rail or air connection',
    ceiling: 'acFirstClassRailFare',
  },
];

const CEILING_LABELS = {
  economyAirFare: 'Economy air fare, shortest route',
  acFirstClassRailFare: 'AC first class rail fare, shortest route',
  deluxeBusFare: 'Deluxe / first class bus fare',
};

const RELATIONSHIPS = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent (dependent)' },
  { value: 'sibling', label: 'Sibling (dependent)' },
];

const DEPENDENCY_REQUIRED = new Set(['parent', 'sibling']);

const STATUS_STYLES = {
  approved:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};


const describeError = (error, fallback) => {
  const response = error?.response;
  if (!response) return 'Could not reach the server. Check your connection.';
  if (response.status === 403)
    return 'You do not have permission to file an LTA claim.';
  return response.data?.message || fallback;
};

const emptyTraveller = () => ({
  name: '',
  relationship: 'self',
  dateOfBirth: '',
  dependent: false,
  birthGroupId: '',
});

const emptyForm = () => ({
  journeyDate: '',
  returnDate: '',
  origin: '',
  destination: '',
  mode: 'air',
  travelClass: '',
  international: false,
  claimedFare: '',
  ceiling: '',
  ltaComponentPaid: '',
});

const LtaClaimPortal = () => {
  const [entitlement, setEntitlement] = useState(null);
  const [claims, setClaims] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [travellers, setTravellers] = useState([
    { ...emptyTraveller(), name: 'Self' },
  ]);
  const [assessment, setAssessment] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [entitlementRes, claimsRes] = await Promise.all([
        api.get('/api/lta/entitlement'),
        api.get('/api/lta/my-claims'),
      ]);

      setEntitlement(entitlementRes.data || null);
      setClaims(
        Array.isArray(claimsRes.data?.claims) ? claimsRes.data.claims : [],
      );
    } catch (error) {
      setLoadError(
        describeError(error, 'Could not load your LTA entitlement.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key) => (event) => {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    setForm((previous) => ({ ...previous, [key]: value }));
    setAssessment(null);
  };

  const setTraveller = (index, key) => (event) => {
    const value =
      event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;

    setTravellers((previous) =>
      previous.map((traveller, position) =>
        position === index ? { ...traveller, [key]: value } : traveller,
      ),
    );
    setAssessment(null);
  };

  const ceilingKey = useMemo(
    () =>
      TRAVEL_MODES.find((mode) => mode.value === form.mode)?.ceiling ||
      'acFirstClassRailFare',
    [form.mode],
  );

  const payload = useMemo(() => {
    const ceilingValue = Number(form.ceiling);
    const ltaPaid = Number(form.ltaComponentPaid);

    return {
      journeyDate: form.journeyDate,
      returnDate: form.returnDate || null,
      origin: form.origin,
      destination: form.destination,
      mode: form.mode,
      travelClass: form.travelClass,
      international: form.international,
      claimedFare: Number(form.claimedFare) || 0,
      fareCeilings:
        Number.isFinite(ceilingValue) && form.ceiling !== ''
          ? { [ceilingKey]: ceilingValue }
          : {},
      travellers: travellers
        .filter((traveller) => traveller.name.trim() !== '')
        .map((traveller) => ({
          name: traveller.name.trim(),
          relationship: traveller.relationship,
          dateOfBirth: traveller.dateOfBirth || null,
          dependent: Boolean(traveller.dependent),
          birthGroupId: traveller.birthGroupId.trim() || null,
        })),
      ...(form.ltaComponentPaid !== '' && Number.isFinite(ltaPaid)
        ? { ltaComponentPaid: ltaPaid }
        : {}),
    };
  }, [form, travellers, ceilingKey]);

  const preview = async () => {
    setBusy(true);

    try {
      const res = await api.post('/api/lta/preview', payload);
      setAssessment(res.data?.assessment || null);
    } catch (error) {
      setAssessment(null);
      toast.error(describeError(error, 'Could not assess this journey.'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);

    try {
      const res = await api.post('/api/lta/claims', payload);
      toast.success(res.data?.message || 'Claim filed.');
      setForm(emptyForm());
      setTravellers([{ ...emptyTraveller(), name: 'Self' }]);
      setAssessment(null);
      await load();
    } catch (error) {
      toast.error(describeError(error, 'Could not file this claim.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Loading your LTA entitlement…
        </p>
      </div>
    );
  }

  const carriedForward = entitlement?.carryForwardAvailable > 0;
  const remaining = Math.max(
    0,
    (entitlement?.baseEntitlement || 0) - (entitlement?.availedInBlock || 0),
  );

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-serif text-gray-900 dark:text-white">
          Leave Travel Allowance
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
          Two journeys per four-year block are exempt under section 10(5). Only
          the travel fare — hotels, food and local transport are not exempt at
          any amount.
        </p>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300"
        >
          {loadError}
        </p>
      )}

      {/* ── Entitlement ──────────────────────────────────────────────── */}
      {entitlement && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
              Current block
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {entitlement.block?.label}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
              Journeys left in the block
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {remaining} of {entitlement.baseEntitlement}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
              Carried forward
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {entitlement.carryForwardAvailable || 0}
            </p>
          </div>
        </div>
      )}

      {carriedForward && (
        <p className="mb-6 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300">
          One unavailed journey from the {entitlement.previousBlock?.label}{' '}
          block carries forward — but it can only be taken in{' '}
          <strong>{entitlement.carryForwardExpiresAfter}</strong>, the first
          year of this block. After that it lapses.
        </p>
      )}

      {/* ── The claim form ───────────────────────────────────────────── */}
      <form
        onSubmit={submit}
        className="mb-6 p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl grid gap-4"
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          File a journey
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-sm text-gray-700 dark:text-slate-300">
            Journey date
            <input
              type="date"
              required
              value={form.journeyDate}
              onChange={setField('journeyDate')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              The calendar year of travel decides the block
            </span>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Return date
            <input
              type="date"
              value={form.returnDate}
              onChange={setField('returnDate')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            From
            <input
              type="text"
              required
              value={form.origin}
              onChange={setField('origin')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            To
            <input
              type="text"
              required
              value={form.destination}
              onChange={setField('destination')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Mode
            <select
              value={form.mode}
              onChange={setField('mode')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            >
              {TRAVEL_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Class travelled
            <input
              type="text"
              value={form.travelClass}
              onChange={setField('travelClass')}
              placeholder="e.g. Economy, 2A"
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            Fare claimed
            <input
              type="number"
              required
              min="0"
              value={form.claimedFare}
              onChange={setField('claimedFare')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            {CEILING_LABELS[ceilingKey]}
            <input
              type="number"
              min="0"
              value={form.ceiling}
              onChange={setField('ceiling')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              The exemption is capped at this
            </span>
          </label>

          <label className="text-sm text-gray-700 dark:text-slate-300">
            LTA paid in your salary
            <input
              type="number"
              min="0"
              value={form.ltaComponentPaid}
              onChange={setField('ltaComponentPaid')}
              className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-slate-500">
              The exemption cannot exceed what was paid
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.international}
              onChange={setField('international')}
              className="rounded border-gray-300 dark:border-slate-700"
            />
            This journey includes a leg outside India
          </label>
        </div>

        {/* ── Travellers ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Who travelled
            </h3>
            <button
              type="button"
              onClick={() =>
                setTravellers((previous) => [...previous, emptyTraveller()])
              }
              className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Add traveller
            </button>
          </div>

          <div className="space-y-3">
            {travellers.map((traveller, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end p-3 rounded-lg bg-gray-50 dark:bg-slate-800/40"
              >
                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Name
                  <input
                    type="text"
                    value={traveller.name}
                    onChange={setTraveller(index, 'name')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Relationship
                  <select
                    value={traveller.relationship}
                    onChange={setTraveller(index, 'relationship')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  >
                    {RELATIONSHIPS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-700 dark:text-slate-300">
                  Date of birth
                  <input
                    type="date"
                    value={traveller.dateOfBirth}
                    onChange={setTraveller(index, 'dateOfBirth')}
                    className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                  />
                </label>

                {traveller.relationship === 'child' ? (
                  <label className="text-sm text-gray-700 dark:text-slate-300">
                    Multiple birth ref.
                    <input
                      type="text"
                      value={traveller.birthGroupId}
                      onChange={setTraveller(index, 'birthGroupId')}
                      placeholder="Same for twins"
                      className="mt-1 w-full p-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-transparent text-gray-900 dark:text-white"
                    />
                  </label>
                ) : (
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={traveller.dependent}
                      onChange={setTraveller(index, 'dependent')}
                      disabled={
                        !DEPENDENCY_REQUIRED.has(traveller.relationship)
                      }
                      className="rounded border-gray-300 dark:border-slate-700"
                    />
                    Dependent on me
                  </label>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setTravellers((previous) =>
                      previous.filter((_, position) => position !== index),
                    )
                  }
                  disabled={travellers.length === 1}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-400 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={preview}
            disabled={busy || !form.journeyDate}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 text-sm font-semibold"
          >
            Check what is exempt
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm"
          >
            {busy ? 'Working…' : 'File claim'}
          </button>
        </div>
      </form>

      {/* ── Assessment ───────────────────────────────────────────────── */}
      {assessment && (
        <section
          className={`mb-6 p-5 rounded-xl border ${
            assessment.allowed
              ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-900/40'
              : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-900/40'
          }`}
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {assessment.allowed
              ? `Exempt: ${formatCurrency(assessment.exemptAmount)}`
              : 'Not allowable'}
          </h2>

          {assessment.refusals?.length > 0 && (
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
              {assessment.refusals.map((refusal) => (
                <li key={refusal.code}>{refusal.message}</li>
              ))}
            </ul>
          )}

          {assessment.notes?.length > 0 && (
            <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-slate-300">
              {assessment.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}

          {assessment.travellers?.ineligible?.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {assessment.travellers.ineligible.map((traveller) => (
                <li key={traveller.name}>
                  {traveller.name}: {traveller.reason}
                </li>
              ))}
            </ul>
          )}

          {assessment.taxableBalance !== null &&
            assessment.taxableBalance !== undefined && (
              <p className="mt-3 text-sm text-gray-700 dark:text-slate-300">
                Taxable balance of the LTA paid:{' '}
                <span className="font-mono">
                  {formatCurrency(assessment.taxableBalance)}
                </span>
              </p>
            )}
        </section>
      )}

      {/* ── History ──────────────────────────────────────────────────── */}
      <section className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your journeys
        </h2>

        {claims.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-500">
            You have not filed an LTA journey yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Route</th>
                  <th className="py-2 pr-4">Block</th>
                  <th className="py-2 pr-4 text-right">Fare</th>
                  <th className="py-2 pr-4 text-right">Exempt</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr
                    key={claim._id}
                    className="border-t border-gray-100 dark:border-slate-800"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {formatDate(claim.journeyDate)}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {claim.origin} → {claim.destination}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-slate-400">
                      {claim.blockLabel}
                      {claim.usesCarryForward && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                          carried forward
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-600 dark:text-slate-400">
                      {formatCurrency(claim.claimedFare)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-gray-900 dark:text-white">
                      {formatCurrency(claim.exemptAmount)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          STATUS_STYLES[claim.status] || STATUS_STYLES.pending
                        }`}
                      >
                        {claim.status}
                      </span>
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

export default LtaClaimPortal;
