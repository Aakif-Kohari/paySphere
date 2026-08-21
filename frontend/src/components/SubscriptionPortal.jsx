/**
 * SubscriptionPortal.jsx - Issue #1113
 *
 * Shows the tenant's current subscription plan, usage gauges (employees,
 * report schedules), and an upgrade call-to-action. Fetches from
 * GET /api/tenant/subscription.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const PLAN_STYLES = {
  basic:      { color: 'blue',   label: 'Basic',      icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  pro:        { color: 'purple', label: 'Pro',        icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' },
  enterprise: { color: 'amber',  label: 'Enterprise', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
};

function UsageGauge({ label, current, limit, color }) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isWarning = pct > 80;
  const barColor = isWarning
    ? 'bg-amber-500 dark:bg-amber-400'
    : color === 'purple'
      ? 'bg-purple-500 dark:bg-purple-400'
      : color === 'amber'
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-blue-500 dark:bg-blue-400';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold">
          {current.toLocaleString()} / {limit.toLocaleString()}
        </p>
      </div>
      <div className="w-full h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: pct + '%' }} />
      </div>
      {isWarning && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-2">
          {pct >= 100 ? 'Limit reached' : 'Approaching limit'}
        </p>
      )}
    </div>
  );
}

export default function SubscriptionPortal() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get('/api/tenant/subscription');
      setSubscription(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subscription.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
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

  if (!subscription) return null;

  const planStyle = PLAN_STYLES[subscription.plan] || PLAN_STYLES.basic;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden`}>
        <div className={`px-6 py-5 bg-${planStyle.color}-50 dark:bg-${planStyle.color}-950/20 border-b border-${planStyle.color}-100 dark:border-${planStyle.color}-900/30`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${planStyle.color}-100 dark:bg-${planStyle.color}-900/40`}>
                <svg className={`w-5 h-5 text-${planStyle.color}-600 dark:text-${planStyle.color}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={planStyle.icon} />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{planStyle.label} Plan</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">
                  Status: {subscription.status}
                  {subscription.currentPeriodEnd && (
                    <span> &middot; Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN')}</span>
                  )}
                </p>
              </div>
            </div>
            {subscription.plan !== 'enterprise' && (
              <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md">
                Upgrade Plan
              </button>
            )}
          </div>
        </div>

        {/* Features list */}
        {subscription.features && subscription.features.length > 0 && (
          <div className="px-6 py-4">
            <p className="text-xs uppercase text-gray-400 dark:text-slate-500 font-bold mb-2">Included Features</p>
            <div className="flex flex-wrap gap-2">
              {subscription.features.map((f) => (
                <span key={f} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/30">
                  {f.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Gauges */}
      <div>
        <h4 className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase mb-3">Usage</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UsageGauge
            label="Employees"
            current={subscription.usage?.employees || 0}
            limit={subscription.limits?.employeeCount || 9999}
            color={planStyle.color}
          />
          <UsageGauge
            label="Report Schedules"
            current={subscription.usage?.reportSchedules || 0}
            limit={subscription.limits?.reportSchedules || 5}
            color={planStyle.color}
          />
        </div>
      </div>
    </div>
  );
}
