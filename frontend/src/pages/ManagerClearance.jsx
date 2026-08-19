import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

export default function ManagerClearance() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchPlans(); }, []);

    const fetchPlans = async () => {
        try {
            // Mocking fetching all active handover plans for the tenant
            // In a real app, this would be an admin endpoint: GET /api/handover/all
            const res = await api.get('/api/handover/all');
            setPlans(res.data.plans || []);
        } catch (err) {
            // Fallback mock data if endpoint doesn't exist yet
            setPlans([
                { _id: '1', employeeId: { fullName: 'John Doe' }, clearanceScore: 85, status: 'In Progress', isFnFBlocked: true, exitDate: new Date() }
            ]);
        } finally { setLoading(false); }
    };

    const handleSignOff = async (planId) => {
        const remarks = prompt('Enter manager remarks (optional):');
        if (remarks === null) return; // Cancelled
        try {
            await api.post('/api/handover/manager-signoff', { planId, remarks });
            alert('Sign-off recorded successfully!');
            fetchPlans();
        } catch (err) { alert('Failed to sign off.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Clearance" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <VerifiedUserIcon /> Manager Clearance & F&F Gatekeeper
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Exit Date</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Clearance</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">F&F Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : plans.map(plan => (
                                    <tr key={plan._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{plan.employeeId?.fullName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(plan.exitDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-center text-sm font-bold text-brand-600">{plan.clearanceScore}%</td>
                                        <td className="px-6 py-4 text-center">
                                            {plan.isFnFBlocked ? (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Blocked</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Cleared</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {!plan.managerSignOff ? (
                                                <button onClick={() => handleSignOff(plan._id)} className="text-xs font-semibold text-brand-600 hover:text-brand-800 dark:text-brand-400">
                                                    Sign Off
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-500 italic">Signed</span>
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
