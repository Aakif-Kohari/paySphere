import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';

const RESOURCE_TYPES = [
  'User',
  'Employee',
  'Payroll',
  'Attendance',
  'Expense',
  'Settlement',
  'Loan',
  'Workflow',
  'Webhook',
  'OfficeLocation',
];

const PRESET_DAYS = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last 90 Days', value: '90' },
  { label: 'All Time', value: '' },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [metadata, setMetadata] = useState({ totalRecords: 0, totalPages: 1, currentPage: 1, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const { showNotification } = useAppStore();

  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [daysPreset, setDaysPreset] = useState('30');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Inspector modal
  const [selectedDetails, setSelectedDetails] = useState(null);

  useEffect(() => {
    fetchAuditLogs();
  }, [page, limit, daysPreset, action, resourceType, resultFilter]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);

      if (search.trim()) params.append('search', search.trim());
      if (action) params.append('action', action);
      if (resourceType) params.append('resourceType', resourceType);
      if (resultFilter) params.append('result', resultFilter);
      if (daysPreset) params.append('days', daysPreset);

      const res = await api.get(`/api/audit-logs?${params.toString()}`);
      const payload = res.data?.data || res.data;
      setLogs(payload.logs || []);
      if (payload.metadata) {
        setMetadata(payload.metadata);
      }
    } catch (err) {
      showNotification({
        message: err.response?.data?.message || 'Failed to fetch audit logs',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAuditLogs();
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (action) params.append('action', action);
      if (resourceType) params.append('resourceType', resourceType);
      if (resultFilter) params.append('result', resultFilter);
      if (daysPreset) params.append('days', daysPreset);

      const response = await api.get(`/api/audit-logs/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification({ message: 'Audit logs exported to CSV', severity: 'success' });
    } catch (err) {
      showNotification({ message: 'Export failed', severity: 'error' });
    }
  };

  const getActionBadgeColor = (actionName) => {
    if (!actionName) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    if (actionName.includes('DELETE') || actionName.includes('REJECT')) {
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
    }
    if (actionName.includes('CREATE') || actionName.includes('APPROVE') || actionName.includes('FINALIZE')) {
      return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
    }
    if (actionName.includes('IMPERSONATE')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <Helmet>
        <title>Audit Trail & System Logs - PaySphere</title>
      </Helmet>

      <Sidebar activePage="Audit logs" isSidebarOpen={false} onClose={() => {}} />

      <div className="lg:ml-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit Trail & System Logs</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Track user mutations, security events, and system changes with full audit history.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-xl space-y-4 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by keyword, actor, IP address..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
                />
              </div>

              <select
                value={resourceType}
                onChange={(e) => {
                  setResourceType(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
              >
                <option value="">All Resource Types</option>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={resultFilter}
                onChange={(e) => {
                  setResultFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
              >
                <option value="">All Status Results</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>

              <select
                value={daysPreset}
                onChange={(e) => {
                  setDaysPreset(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-gray-900 dark:text-white"
              >
                {PRESET_DAYS.map((p) => (
                  <option key={p.label} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition"
              >
                Filter Logs
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-lg transition ml-auto"
              >
                Export CSV
              </button>
            </form>
          </div>

          {/* Audit Logs Data Grid */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-slate-400">
                        Loading audit log entries...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-slate-400">
                        No audit log records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-gray-500 dark:text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium">
                          {log.userId?.fullName || 'System / User'}
                          {log.userId?.email && (
                            <span className="block text-[10px] text-gray-400 dark:text-slate-500">
                              {log.userId.email}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-[11px] font-bold ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-gray-600 dark:text-slate-300">
                          {log.resourceType}{' '}
                          {Array.isArray(log.resourceIds) && log.resourceIds.length > 0 && (
                            <span className="text-[10px] text-gray-400">({log.resourceIds[0]})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.result === 'failure'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                                : 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                            }`}
                          >
                            {log.result || 'success'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-gray-500 dark:text-slate-400">
                          {log.ipAddress || log.ip || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setSelectedDetails(log.details || {})}
                            className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded hover:bg-indigo-100 transition"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 bg-gray-50 dark:bg-slate-800/40 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs">
              <span className="text-gray-600 dark:text-slate-400">
                Showing Page {metadata.currentPage} of {metadata.totalPages} ({metadata.totalRecords} records)
              </span>

              <div className="flex items-center gap-2">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>

                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white font-bold disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={page >= metadata.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Inspector Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 max-w-xl w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Log Event Payload Details</h3>
              <button
                onClick={() => setSelectedDetails(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-80 font-mono">
              {JSON.stringify(selectedDetails, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDetails(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-white font-semibold text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
