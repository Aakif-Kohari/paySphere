import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function BiometricSyncDashboard() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [filter, setFilter] = useState('Flagged');

    useEffect(() => { fetchLogs(); }, [selectedDate, filter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/biometric/logs?date=${selectedDate}&status=${filter}`);
            setLogs(res.data.logs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleReconcile = async () => {
        try {
            const res = await api.post('/api/biometric/reconcile', { date: selectedDate });
            alert(`Reconciliation complete. Flagged: ${res.data.result.flagged} logs.`);
            fetchLogs();
        } catch (err) { alert('Reconciliation failed'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Biometric Sync" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FingerprintIcon /> Biometric Sync & Anomaly Dashboard
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {/* Controls */}
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Date</label>
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">Status Filter</label>
                            <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm">
                                <option value="">All</option>
                                <option value="Unprocessed">Unprocessed</option>
                                <option value="Flagged">Flagged (Anomalies)</option>
                                <option value="Reconciled">Reconciled (Clean)</option>
                            </select>
                        </div>
                        <button onClick={handleReconcile} className="mt-auto px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2 text-sm">
                            <SyncIcon fontSize="small" /> Run Reconciliation Daemon
                        </button>
                    </div>

                    {/* Logs Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Device</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Timestamp</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Type</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Anomalies</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading punch logs...</td></tr>
                                    ) : logs.length === 0 ? (
                                        <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No logs found for the selected criteria.</td></tr>
                                    ) : (
                                        logs.map(log => (
                                            <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{log.externalEmployeeId}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{log.deviceId?.deviceName || 'Unknown'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.punchType === 'IN' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                                                        {log.punchType}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {log.status === 'Flagged' ? (
                                                        <WarningAmberIcon className="text-amber-500" fontSize="small" />
                                                    ) : log.status === 'Reconciled' ? (
                                                        <CheckCircleIcon className="text-green-500" fontSize="small" />
                                                    ) : (
                                                        <span className="text-xs text-gray-500">{log.status}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-red-600 dark:text-red-400">
                                                    {log.anomalyFlags?.length > 0 ? log.anomalyFlags.join(', ') : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
