import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
  ipAddress?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  onFilterChange?: (filters: { query: string; action: string; status: string }) => void;
  onExportCSV?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  logs = [],
  onFilterChange,
  onExportCSV,
  onRefresh,
  isLoading = false,
  totalCount,
  currentPage = 1,
  onPageChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onFilterChange?.({ query, action: selectedAction, status: selectedStatus });
  };

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const action = e.target.value;
    setSelectedAction(action);
    onFilterChange?.({ query: searchQuery, action, status: selectedStatus });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value;
    setSelectedStatus(status);
    onFilterChange?.({ query: searchQuery, action: selectedAction, status });
  };

  const filteredLogs = logs.filter((log) => {
    const matchesQuery =
      !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    const matchesStatus = selectedStatus === 'ALL' || log.status === selectedStatus;

    return matchesQuery && matchesAction && matchesStatus;
  });

  const getStatusIcon = (status: AuditLogEntry['status']) => {
    switch (status) {
      case 'SUCCESS':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'FAILURE':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: AuditLogEntry['status']) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'FAILURE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-700';
    }
  };

  return (
    <div
      data-testid="audit-log-viewer"
      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl text-slate-100 max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            Enterprise Audit Trail & Security Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable timeline of user actions, permission alterations, and financial modifications
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 transition"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-500/30 transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-6">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, actor email, or resource..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div>
          <select
            value={selectedAction}
            onChange={handleActionChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="ALL">All Actions</option>
            <option value="PAYROLL_FINALIZED">PAYROLL_FINALIZED</option>
            <option value="DISBURSEMENT_INITIATED">DISBURSEMENT_INITIATED</option>
            <option value="REVERSAL_APPROVED">REVERSAL_APPROVED</option>
            <option value="USER_ROLE_CHANGED">USER_ROLE_CHANGED</option>
            <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={handleStatusChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="FAILURE">Failure</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden font-mono">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching audit records found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-900/50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getStatusBadge(log.status)}`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">{log.action}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200">{log.actorName}</div>
                      <div className="text-[10px] text-slate-500">{log.actorEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{log.resourceType}</td>
                    <td className="py-3 px-4 text-slate-400">{log.timestamp}</td>
                    <td className="py-3 px-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-500 inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100">Audit Record Detail</h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Close ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Record ID:</span>
                <span className="text-slate-200">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Action:</span>
                <span className="text-indigo-400 font-bold">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Actor:</span>
                <span className="text-slate-200">{selectedLog.actorName} ({selectedLog.actorEmail})</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Role:</span>
                <span className="text-slate-200">{selectedLog.actorRole}</span>
              </div>
              {selectedLog.ipAddress && (
                <div className="flex justify-between text-slate-400">
                  <span>IP Address:</span>
                  <span className="text-slate-200">{selectedLog.ipAddress}</span>
                </div>
              )}
              {selectedLog.details && (
                <div className="mt-4">
                  <span className="text-slate-400 block mb-1">Payload Details:</span>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
