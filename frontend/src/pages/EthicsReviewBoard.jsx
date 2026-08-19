import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import GavelIcon from '@mui/icons-material/Gavel';
import LockOpenIcon from '@mui/icons-material/LockOpen';

export default function EthicsReviewBoard() {
    const [queue, setQueue] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchQueue(); }, []);

    const fetchQueue = async () => {
        try {
            const res = await api.get('/api/grievances/committee');
            setQueue(res.data.queue);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleDecrypt = async (id) => {
        try {
            const res = await api.get(`/api/grievances/${id}/decrypt`);
            setSelectedReport(res.data);
        } catch (err) { alert('Failed to decrypt. Access denied or key error.'); }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await api.patch(`/api/grievances/${id}/status`, { status });
            alert('Status updated.');
            setSelectedReport(null);
            fetchQueue();
        } catch (err) { alert('Failed to update status.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Ethics" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <GavelIcon /> Ethics Review Board
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Queue List */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Encrypted Queue</h2>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                            {loading ? (
                                <p className="p-4 text-center text-gray-500 text-sm">Loading...</p>
                            ) : queue.map(r => (
                                <button key={r._id} onClick={() => handleDecrypt(r._id)} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{r.title}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-500 dark:text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === 'Submitted' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                            r.status === 'Resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                            }`}>{r.status}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Decrypted View */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 min-h-[400px]">
                        {!selectedReport ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                                <LockOpenIcon fontSize="large" />
                                <p className="mt-2 text-sm">Select a report from the queue to decrypt and review.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedReport.title}</h2>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${selectedReport.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                        }`}>{selectedReport.status}</span>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 whitespace-pre-wrap text-sm text-gray-800 dark:text-slate-200">
                                    {selectedReport.body}
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Update Resolution Status</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleStatusUpdate(selectedReport._id, 'Under Investigation')} className="px-3 py-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg text-xs font-bold">Start Investigation</button>
                                        <button onClick={() => handleStatusUpdate(selectedReport._id, 'Resolved')} className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-lg text-xs font-bold">Mark Resolved</button>
                                        <button onClick={() => handleStatusUpdate(selectedReport._id, 'Dismissed')} className="px-3 py-1.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded-lg text-xs font-bold">Dismiss</button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Decryption Audit Trail</h3>
                                    <ul className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
                                        {selectedReport.accessLogs.map((log, i) => (
                                            <li key={i}>• {log.action} by User {log.accessedBy || 'System'} on {new Date(log.accessedAt).toLocaleString()}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
