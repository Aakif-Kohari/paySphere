import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import SystemHealthSkeleton from '../components/common/skeleton/SystemHealthSkeleton';
import api from "../services/api";

export default function SystemHealth() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/auth/health");
      setHealth(res.data);
      setError("");
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch system health status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 p-6 sm:p-10 font-sans text-slate-800 dark:text-slate-200">
      <Helmet>
        <title>System Health | PaySphere</title>
      </Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/settings")}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mb-1 inline-block"
            >
              ← Back to Settings
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform System Health</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Real-time backend performance metrics, memory usage, and database connection status.
            </p>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
          >
            <span>🔄</span>
            {loading ? "Refreshing..." : "Refresh Now"}
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        {health ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Database Card */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-400 tracking-wider">Database Status</span>
                <span className={`w-3 h-3 rounded-full ${health.database.readyState === 1 ? "bg-green-500" : "bg-red-500"}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{health.database.status}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">Host: {health.database.host}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">DB: {health.database.name}</p>
            </div>

            {/* Uptime Card */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-400 tracking-wider block mb-3">Server Uptime</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{health.uptime.formatted}</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">Node {health.environment.nodeVersion} ({health.environment.platform})</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">Process PID: {health.environment.pid}</p>
            </div>

            {/* Memory Card */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-bold uppercase text-gray-500 dark:text-slate-400 tracking-wider block mb-3">Heap Used / Total</span>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{health.memory.heapUsedMB} MB</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">Total Heap: {health.memory.heapTotalMB} MB</p>
              <p className="text-xs text-gray-500 dark:text-slate-500">RSS: {health.memory.rssMB} MB</p>
            </div>
          </div>
        ) : loading ? (
          <SystemHealthSkeleton />
        ) : null}

        <p className="text-xs text-gray-400 dark:text-slate-500 text-right">
          Last checked at: {lastRefreshed.toLocaleTimeString()} (Auto-refreshes every 15s)
        </p>
      </div>
    </div>
  );
}
