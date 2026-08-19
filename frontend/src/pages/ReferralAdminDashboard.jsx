import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

export default function ReferralAdminDashboard() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchPipeline(); }, []);

    const fetchPipeline = async () => {
        try {
            const res = await api.get('/api/referrals/pipeline');
            setCandidates(res.data.candidates);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleStatusUpdate = async (id, status) => {
        // In a real app, you'd prompt for the hiredEmployeeId if status is 'Hired'
        const hiredEmployeeId = status === 'Hired' ? prompt('Enter Hired Employee ID:') : null;
        if (status === 'Hired' && !hiredEmployeeId) return;

        try {
            await api.patch(`/api/referrals/candidates/${id}/status`, { status, hiredEmployeeId });
            alert('Status updated!');
            fetchPipeline();
        } catch (err) { alert('Update failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="ReferralAdmin" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ManageAccountsIcon /> Referral Admin Pipeline
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Candidate</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Referrer</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Program</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : candidates.map(c => (
                                    <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.candidateName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.referrerId?.fullName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.programId?.title}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === 'Hired' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                }`}>{c.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {c.status !== 'Hired' && c.status !== 'Rejected' && (
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleStatusUpdate(c._id, 'Hired')} className="text-xs font-bold text-green-600 hover:underline">Hire</button>
                                                    <button onClick={() => handleStatusUpdate(c._id, 'Rejected')} className="text-xs font-bold text-red-600 hover:underline">Reject</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
