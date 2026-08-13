/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const EVENT_LABELS = {
  EMPLOYEE_CREATE: 'Employee Created',
  EMPLOYEE_UPDATE: 'Employee Updated',
  EMPLOYEE_DELETE: 'Employee Deleted',
  PAYROLL_FINALIZE: 'Payroll Finalized',
  PAYROLL_APPROVE: 'Payroll Approved',
  PAYROLL_REJECT: 'Payroll Rejected',
  PAYROLL_PAID: 'Payroll Paid',
};
const EVENT_KEYS = Object.keys(EVENT_LABELS);

const getErrorMessage = (err) =>
  err.response?.data?.message || 'Something went wrong. Please try again.';

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : '—';

export default function WebhooksSection() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [revealedSecret, setRevealedSecret] = useState(null); // { id, secret, url }
  const [showDeliveriesFor, setShowDeliveriesFor] = useState(null); // webhook id
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Secret copied to clipboard.');
    } catch {
      toast.error('Could not copy automatically. Please copy it manually.');
    }
  };

  const loadWebhooks = () => {
    setLoading(true);
    api
      .get('/api/webhooks')
      .then((res) => setWebhooks(res.data || []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setUrl('');
    setDescription('');
    setSelectedEvents([]);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (webhook) => {
    setEditingId(webhook._id);
    setUrl(webhook.url);
    setDescription(webhook.description || '');
    setSelectedEvents([...(webhook.subscribedEvents || [])]);
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const toggleEvent = (event) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const saveWebhook = async () => {
    setFormError('');
    if (!/^https?:\/\/.+/i.test(url.trim())) {
      setFormError('Please enter a valid HTTP(S) URL.');
      return;
    }
    if (selectedEvents.length === 0) {
      setFormError('Select at least one event to subscribe to.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        url: url.trim(),
        description: description.trim(),
        subscribedEvents: selectedEvents,
      };
      if (editingId) {
        await api.patch(`/api/webhooks/${editingId}`, payload);
        toast.success('Webhook endpoint updated successfully!');
      } else {
        const res = await api.post('/api/webhooks', payload);
        setRevealedSecret({
          id: res.data._id,
          secret: res.data.secret,
          url: res.data.url,
        });
        toast.success('Webhook endpoint created successfully!');
      }
      closeForm();
      loadWebhooks();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (webhook) => {
    try {
      await api.patch(`/api/webhooks/${webhook._id}`, {
        isActive: !webhook.isActive,
      });
      loadWebhooks();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const regenerateSecret = async (webhook) => {
    if (
      !window.confirm(
        `Regenerate the signing secret for ${webhook.url}?\n\nThe old secret will stop working immediately.`,
      )
    )
      return;
    try {
      const res = await api.post(`/api/webhooks/${webhook._id}/regenerate-secret`);
      setRevealedSecret({
        id: webhook._id,
        secret: res.data.secret,
        url: webhook.url,
      });
      toast.success('Signing secret regenerated successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const deleteWebhook = async (webhook) => {
    if (
      !window.confirm(
        `Delete the webhook for ${webhook.url}?\n\nPaySphere will stop sending events to this URL immediately.`,
      )
    )
      return;
    try {
      await api.delete(`/api/webhooks/${webhook._id}`);
      if (showDeliveriesFor === webhook._id) {
        setShowDeliveriesFor(null);
        setDeliveries([]);
      }
      toast.success('Webhook endpoint deleted successfully.');
      loadWebhooks();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleDeliveries = async (webhook) => {
    if (showDeliveriesFor === webhook._id) {
      setShowDeliveriesFor(null);
      setDeliveries([]);
      return;
    }
    setShowDeliveriesFor(webhook._id);
    setDeliveriesLoading(true);
    setDeliveries([]);
    try {
      const res = await api.get(`/api/webhooks/${webhook._id}/deliveries`);
      setDeliveries(res.data || []);
    } catch (err) {
      setShowDeliveriesFor(null);
      toast.error(getErrorMessage(err));
    } finally {
      setDeliveriesLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Webhooks
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
            Send payroll and employee events to external services like
            accounting or HR platforms.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          Add Webhook
        </button>
      </div>

      {/* ── Create / Edit Form ── */}
      {formOpen && (
        <div className="p-6 border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-5">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              {editingId ? 'Edit Webhook Endpoint' : 'New Webhook Endpoint'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
              The URL will receive an HMAC-signed JSON POST for each subscribed
              event.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
              Endpoint URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.mycompany.com/webhook/payroll"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 outline-none text-sm text-gray-900 dark:text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="e.g. Sync to QuickBooks"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 outline-none text-sm text-gray-900 dark:text-white transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-500 dark:text-slate-500 tracking-wider mb-2 block">
              Events
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENT_KEYS.map((event) => (
                <label
                  key={event}
                  className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition ${
                    selectedEvents.includes(event)
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                      : 'bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    {EVENT_LABELS[event]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500 font-medium">{formError}</p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={closeForm}
              className="px-5 py-2.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-bold transition hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={saveWebhook}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                saving
                  ? 'bg-blue-300 dark:bg-blue-900/50 text-white/70 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 dark:shadow-none'
              }`}
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Webhook'}
            </button>
          </div>
        </div>
      )}

      {/* ── Reveal-once secret box ── */}
      {revealedSecret && (
        <div className="p-6 border border-amber-200 dark:border-amber-900/40 rounded-2xl bg-amber-50 dark:bg-amber-950/20 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-amber-900 dark:text-amber-400">
            Copy your signing secret — it is shown only once
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-500">
            PaySphere signs every webhook POST with this secret using HMAC-SHA256.
            The receiver verifies the{' '}
            <span className="font-mono">X-PaySphere-Signature</span> header to
            confirm the payload came from PaySphere. It will not be shown again;
            use &quot;Regenerate secret&quot; if you lose it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <code className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/40 text-xs font-mono break-all text-gray-900 dark:text-white">
              {revealedSecret.secret}
            </code>
            <button
              onClick={() => copyToClipboard(revealedSecret.secret)}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Copy Secret
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setRevealedSecret(null)}
              className="text-xs font-semibold text-amber-700 dark:text-amber-500 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Webhook list ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="p-12 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-center">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1">
            No webhooks yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-500 mb-4">
            Connect an external service to receive paySphere events.
          </p>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none transition"
          >
            Add your first webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div
              key={webhook._id}
              className="border border-gray-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
            >
              <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white break-all">
                        {webhook.url}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          webhook.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {webhook.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {webhook.description && (
                      <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                        {webhook.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">
                      Created {formatDate(webhook.createdAt)} · Secret{' '}
                      <span className="font-mono">{webhook.secret}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label
                      title={webhook.isActive ? 'Pause delivery' : 'Resume delivery'}
                      className="relative inline-flex items-center cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="sr-only peer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                        checked={webhook.isActive}
                        onChange={() => toggleActive(webhook)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <button
                      onClick={openEdit.bind(null, webhook)}
                      className="px-3 py-1.5 text-sm font-semibold text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(webhook.subscribedEvents || []).map((event) => (
                    <span
                      key={event}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900"
                    >
                      {EVENT_LABELS[event] || event}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => toggleDeliveries(webhook)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showDeliveriesFor === webhook._id
                      ? 'Hide deliveries'
                      : 'View deliveries'}
                  </button>
                  <button
                    onClick={() => regenerateSecret(webhook)}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-500 hover:underline"
                  >
                    Regenerate secret
                  </button>
                  <button
                    onClick={() => deleteWebhook(webhook)}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* ── Deliveries ── */}
              {showDeliveriesFor === webhook._id && (
                <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950/50 px-5 py-4">
                  {deliveriesLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : deliveries.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-500 text-center py-4">
                      No deliveries recorded yet. PaySphere logs every attempt,
                      including retries, once an event fires.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-500 border-b border-gray-200 dark:border-slate-800">
                            <th className="py-2 pr-4 font-bold">Event</th>
                            <th className="py-2 pr-4 font-bold">Status</th>
                            <th className="py-2 pr-4 font-bold">HTTP</th>
                            <th className="py-2 pr-4 font-bold">Attempts</th>
                            <th className="py-2 font-bold">Sent at</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveries.map((delivery) => (
                            <tr
                              key={delivery._id}
                              className="border-b border-gray-100 dark:border-slate-800 last:border-0"
                            >
                              <td className="py-2.5 pr-4 text-gray-900 dark:text-white font-semibold">
                                {EVENT_LABELS[delivery.eventName] ||
                                  delivery.eventName}
                              </td>
                              <td className="py-2.5 pr-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    delivery.isSuccess
                                      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                  }`}
                                >
                                  {delivery.isSuccess ? 'Delivered' : 'Failed'}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 text-gray-600 dark:text-slate-400">
                                {delivery.httpStatus ?? '—'}
                              </td>
                              <td className="py-2.5 pr-4 text-gray-600 dark:text-slate-400">
                                {delivery.attemptCount}
                              </td>
                              <td className="py-2.5 text-gray-600 dark:text-slate-400">
                                {formatDate(delivery.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {deliveries.some(
                        (d) => d.errorMessage || d.responseBody,
                      ) && (
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-3">
                          {deliveries
                            .filter((d) => d.errorMessage)
                            .map((d) => d.errorMessage)
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
