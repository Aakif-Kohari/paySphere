import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export default function EquitySettlementDashboard() {
    const [grants, setGrants] = useState([]);
    const [latestValuation, setLatestValuation] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/phantom-equity/my-grants');
            setGrants(res.data.grants || []);
            setLatestValuation(res.data.latestValuation);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const totalUnrealized = grants.reduce((sum, g) => sum + (g.unrealizedValue || 0), 0);
    const totalVestedUnits = grants.reduce((sum, g) => sum + (g.currentVestedUnits || 0), 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Equity" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShowChartIcon className="text-indigo-500" /> Phantom Equity & SAR Settlement
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 uppercase">Unrealized Value</p>
                            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">₹{totalUnrealized.toLocaleString()}</p>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Based on latest valuation</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200 uppercase">Vested Units</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{totalVestedUnits.toLocaleString()}</p>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">Eligible for cash settlement</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-sm font-semibold text-gray-600 dark:text-slate-400 uppercase">Current Unit Price</p>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                ₹{latestValuation ? latestValuation.pricePerUnit.toLocaleString() : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                                {latestValuation ? `As of ${new Date(latestValuation.eventDate).toLocaleDateString()}` : 'No valuations recorded'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Phantom Grants</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Grant Date</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total Units</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Strike Price</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Vesting Progress</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading grants...</td></tr>
                                ) : grants.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No phantom equity grants found.</td></tr>
                                ) : (
                                    grants.map(g => {
                                        const progress = g.totalUnits > 0 ? (g.currentVestedUnits / g.totalUnits) * 100 : 0;
                                        return (
                                            <tr key={g._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(g.grantDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{g.totalUnits.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">₹{g.strikePrice.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-600 dark:text-slate-400">{progress.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${g.status === 'Fully Vested' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                            g.status === 'Vesting' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                                        }`}>{g.status}</span>
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
    );
}
