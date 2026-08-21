/**
 * FeatureGate.jsx - Issue #1113
 *
 * React component wrapper that conditionally renders children based on
 * the tenant's plan features. If the feature is not included, shows
 * an "Upgrade to Pro" banner instead.
 *
 * Usage:
 *   <FeatureGate feature="VARIANCE_REPORT">
 *     <VarianceReport />
 *   </FeatureGate>
 *
 * The feature list is fetched from /api/tenant/subscription and cached
 * for 60 seconds (matching the server-side cache TTL).
 */
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import api from '../services/api';

// Context for sharing feature data across multiple FeatureGate instances
const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await api.get('/api/tenant/subscription');
      setPlanData(res.data);
    } catch {
      // Fail-open: if we can't fetch the plan, let everything through
      setPlanData({ features: [], plan: 'basic' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
    const interval = setInterval(fetchPlan, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [fetchPlan]);

  return (
    <PlanContext.Provider value={{ planData, loading, refresh: fetchPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}

/**
 * FeatureGate component.
 *
 * @param {string} feature - The feature slug to check (e.g. 'VARIANCE_REPORT')
 * @param {React.ReactNode} children - Content to render if feature is available
 * @param {React.ReactNode} [fallback] - Optional custom fallback UI
 */
export default function FeatureGate({ feature, children, fallback }) {
  const { planData, loading } = usePlan();

  // Loading state: show a subtle skeleton
  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 dark:bg-slate-800 rounded-xl h-32" />
    );
  }

  // If plan data couldn't be fetched, fail-open (show the content)
  if (!planData) {
    return children;
  }

  const hasFeature = (planData.features || []).includes(feature);

  if (hasFeature) {
    return children;
  }

  // Feature not available — show upgrade banner
  if (fallback) {
    return fallback;
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/20 rounded-2xl border border-gray-200 dark:border-slate-800 p-8 text-center">
      <div className="w-14 h-14 mx-auto bg-blue-100 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
        Upgrade Required
      </h3>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          {feature.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        {' '}is available on the Pro plan or above.
      </p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
        Your current plan: <span className="font-semibold capitalize">{planData.plan}</span>
      </p>
      <a
        href="/settings/subscription"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-md"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
        Upgrade to Pro
      </a>
    </div>
  );
}
