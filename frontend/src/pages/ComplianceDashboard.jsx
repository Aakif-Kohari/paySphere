import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { formatDate } from '../utils/formatLocale';

export default function ComplianceDashboard() {
    const [stats, setStats] = useState({ complianceRate: 100, expiringSoon: 0, nonCompliant: 0 });
    const [expiringRecords, setExpiringRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchStats(); }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/api/training/dashboard/stats');
            setStats(res.data.stats);
            setExpiringRecords(res.data.expiringRecords);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Compliance" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <VerifiedUserIcon /> Compliance & Expiration Dashboard
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Compliance Rate</p>
                                <TrendingUpIcon className="text-green-500" />
                            </div>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.complianceRate}%</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Expiring in 30 Days</p>
                                <WarningAmberIcon className="text-amber-500" />
                            </div>
                            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{stats.expiringSoon}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase">Non-Compliant</p>
                                <WarningAmberIcon className="text-red-500" />
                            </div>
                            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{stats.nonCompliant}</p>
                        </div>
                    </div>

                    {/* Expiring Soon Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Expiration Risk (Next 30 Days)</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Course</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Expires On</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Days Left</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading risks...</td></tr>
                                    ) : expiringRecords.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No certifications expiring in the next 30 days.</td></tr>
                                    ) : (
                                        expiringRecords.map(rec => {
                                            const daysLeft = Math.ceil((new Date(rec.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                                            return (
                                                <tr key={rec._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{rec.employeeId?.fullName}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{rec.courseId?.title}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{formatDate(rec.expiresAt)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${daysLeft <= 7 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                            {daysLeft} Days
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
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
