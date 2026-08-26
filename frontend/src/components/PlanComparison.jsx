/**
 * PlanComparison.jsx - Issue #1113
 *
 * Feature matrix table comparing plan tiers. Rows are features,
 * columns are plans. Tick/cross cells show availability.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const PLAN_ORDER = ['basic', 'pro', 'enterprise'];

const PLAN_LABELS = {
  basic:      { label: 'Basic',      color: 'blue' },
  pro:        { label: 'Pro',        color: 'purple' },
  enterprise: { label: 'Enterprise', color: 'amber' },
};

// Default feature matrix when API data is unavailable
const DEFAULT_FEATURES = [
  { slug: 'EMPLOYEE_DIRECTORY',    label: 'Employee Directory',      basic: true,  pro: true,  enterprise: true },
  { slug: 'PAYSLIP_GENERATION',    label: 'Payslip Generation',      basic: true,  pro: true,  enterprise: true },
  { slug: 'LEAVE_MANAGEMENT',      label: 'Leave Management',        basic: true,  pro: true,  enterprise: true },
  { slug: 'ATTENDANCE_TRACKING',   label: 'Attendance Tracking',     basic: true,  pro: true,  enterprise: true },
  { slug: 'BULK_IMPORT',           label: 'Bulk Employee Import',    basic: false, pro: true,  enterprise: true },
  { slug: 'VARIANCE_REPORT',       label: 'Variance Reports',        basic: false, pro: true,  enterprise: true },
  { slug: 'BUDGET_PLANNING',       label: 'Budget Planning',         basic: false, pro: true,  enterprise: true },
  { slug: 'RECURRING_REPORTS',     label: 'Scheduled Reports',       basic: false, pro: true,  enterprise: true },
  { slug: 'MULTI_ENTITY',          label: 'Multi-Entity Support',    basic: false, pro: false, enterprise: true },
  { slug: 'ADVANCED_ANALYTICS',    label: 'Advanced Analytics',      basic: false, pro: false, enterprise: true },
  { slug: 'CUSTOM_ROLES',          label: 'Custom Roles & RBAC',     basic: false, pro: false, enterprise: true },
  { slug: 'API_ACCESS',            label: 'API Access',              basic: false, pro: false, enterprise: true },
  { slug: 'PRIORITY_SUPPORT',      label: 'Priority Support',        basic: false, pro: false, enterprise: true },
  { slug: 'SSO_INTEGRATION',       label: 'SSO Integration',         basic: false, pro: false, enterprise: true },
];

export default function PlanComparison({ currentPlan }) {
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await api.get('/api/tenant/subscription');
      // If we get plan data, use it to inform the comparison
      if (res.data.plan) {
        setFeatures(DEFAULT_FEATURES);
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" />)}
      </div>
    );
  }

  const colorMap = {
    blue:   'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber:  'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Plan Comparison</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">Compare features across all plans</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-slate-800">
              <th className="py-3 px-4 text-xs uppercase text-gray-400 dark:text-slate-500 font-bold">Feature</th>
              {PLAN_ORDER.map((plan) => {
                const style = PLAN_LABELS[plan];
                const isCurrent = currentPlan === plan;
                return (
                  <th key={plan} className={`py-3 px-4 text-center ${isCurrent ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                    <span className={`text-xs font-bold uppercase ${colorMap[style.color]}`}>
                      {style.label}
                    </span>
                    {isCurrent && (
                      <span className="block text-[10px] text-blue-500 dark:text-blue-400 font-semibold mt-0.5">
                        Current
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
            {features.map((feature) => (
              <tr key={feature.slug} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                  {feature.label}
                </td>
                {PLAN_ORDER.map((plan) => (
                  <td key={plan} className={`py-3 px-4 text-center ${currentPlan === plan ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
                    {feature[plan] ? (
                      <svg className="w-5 h-5 mx-auto text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mx-auto text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
