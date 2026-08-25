import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function CommissionDashboard() {
    const [data, setData] = useState({ attainments: [], drawBalance: 0, clawbacks: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/commission/my-dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const totalYTD = data.attainments.reduce((sum, a) => sum + a.calculatedCommission, 0);
    const avgAttainment = data.attainments.length > 0
        ? data.attainments.reduce((sum, a) => sum + a.attainmentPercentage, 0) / data.attainments.length
        : 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Commission" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUpIcon className="text-green-500" /> Sales Commission & Quota Tracker
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200 uppercase">YTD Earned Commission</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">₹{totalYTD.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 uppercase">Avg. Attainment</p>
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{avgAttainment.toFixed(1)}%</p>
                        </div>
                        <div className={`p-6 rounded-xl border ${data.drawBalance > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                            <p className={`text-sm font-semibold uppercase ${data.drawBalance > 0 ? 'text-red-800 dark:text-red-200' : 'text-gray-600 dark:text-slate-400'}`}>
                                Draw Balance (Owed)
                            </p>
                            <p className={`text-3xl font-bold mt-2 ${data.drawBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                ₹{data.drawBalance.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {data.clawbacks.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                            <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Active Clawbacks ({data.clawbacks.length})</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    You have pending commission clawbacks due to cancelled/refunded deals. These will be recovered from future commissions or payroll.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Monthly Attainment History</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Period</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Plan</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Revenue</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Attainment</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                ) : data.attainments.map(a => (
                                    <tr key={a._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{a.periodMonth}/{a.periodYear}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{a.planId?.name}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">₹{a.revenueBooked.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${a.attainmentPercentage >= 100 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                {a.attainmentPercentage.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono font-bold text-green-600 dark:text-green-400">₹{a.calculatedCommission.toLocaleString()}</td>
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

