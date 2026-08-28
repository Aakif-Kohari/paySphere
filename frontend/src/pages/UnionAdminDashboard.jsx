import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import GavelIcon from '@mui/icons-material/Gavel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CalculateIcon from '@mui/icons-material/Calculate';

export default function UnionAdminDashboard() {
    const [data, setData] = useState({ cbas: [], grievances: [] });
    const [loading, setLoading] = useState(true);
    const [duesResults, setDuesResults] = useState([]);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/union/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSLACheck = async () => {
        try {
            const res = await api.get('/api/union/sla-check');
            if (res.data.breached.length > 0) {
                alert(`WARNING: ${res.data.breached.length} grievance SLAs have been breached!`);
            } else {
                alert('All grievance SLAs are within mandated timeframes.');
            }
            fetchData();
        } catch (err) { alert('SLA check failed.'); }
    };

    const handleCalculateDues = async (cbaId) => {
        try {
            const res = await api.post('/api/union/calculate-dues', { cbaId });
            setDuesResults(res.data.results);
        } catch (err) { alert('Calculation failed.'); }
    };

    const activeCBA = data.cbas.find(c => c.status === 'Active');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Union" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <GavelIcon className="text-red-500" /> Union Dues & Arbitration Tracker
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end">
                        <button onClick={handleSLACheck} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 flex items-center gap-2">
                            <WarningAmberIcon fontSize="small" /> Run Arbitration SLA Check
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Active CBA & Dues Audit */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Active CBA: {activeCBA?.agreementName || 'None'}</h2>
                            {activeCBA && (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600 dark:text-slate-400">Union: <strong>{activeCBA.unionName}</strong></p>
                                    <p className="text-sm text-gray-600 dark:text-slate-400">Calculation Type: <strong>{activeCBA.duesCalculationType}</strong></p>
                                    <p className="text-sm text-gray-600 dark:text-slate-400">Valid Until: <strong>{new Date(activeCBA.effectiveTo).toLocaleDateString()}</strong></p>

                                    <button onClick={() => handleCalculateDues(activeCBA._id)} className="w-full mt-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center justify-center gap-2">
                                        <CalculateIcon fontSize="small" /> Audit Monthly Dues Deductions
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* SLA Breach Alerts */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">SLA Breach Alerts</h2>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {data.grievances.filter(g => g.isSLABreached).length === 0 ? (
                                    <p className="text-sm text-green-600 dark:text-green-400">No SLA breaches detected.</p>
                                ) : (
                                    data.grievances.filter(g => g.isSLABreached).map(g => (
                                        <div key={g._id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                            <p className="text-sm font-bold text-red-800 dark:text-red-200">{g.title}</p>
                                            <p className="text-xs text-red-700 dark:text-red-300">
                                                Employee: {g.employeeId?.fullName} | Step {g.currentStep} Overdue
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {duesResults.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dues Deduction Audit</h2>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Base Pay</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Tier Applied</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Dues Deduction</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Capped?</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {duesResults.map((r, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">₹{r.basePay.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{r.tierName}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-red-600 dark:text-red-400">₹{r.deductionAmount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                {r.capped && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Statutory Cap Hit</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
