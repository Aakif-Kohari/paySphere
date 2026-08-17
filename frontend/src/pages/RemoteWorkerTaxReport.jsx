import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import MapIcon from '@mui/icons-material/Map';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { formatCurrency } from '../utils/currency';

export default function RemoteWorkerTaxReport() {
    const [report, setReport] = useState([]);
    const [nexusAlerts, setNexusAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => { fetchReport(); }, []);

    const fetchReport = async () => {
        try {
            const res = await api.get('/api/regional-tax/report/remote-workers');
            setReport(res.data.report);
            setNexusAlerts(res.data.nexusAlerts);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="TaxReport" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MapIcon /> Remote Worker Tax Liability Report
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {nexusAlerts.length > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <WarningAmberIcon className="text-red-600 dark:text-red-400" />
                                <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Tax Nexus Compliance Alerts ({nexusAlerts.length})</h3>
                            </div>
                            <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 space-y-1">
                                {nexusAlerts.slice(0, 3).map((alert, i) => (
                                    <li key={i}><strong>{alert.employee}</strong> ({alert.state}): {alert.message}</li>
                                ))}
                                {nexusAlerts.length > 3 && <li className="font-semibold">...and {nexusAlerts.length - 3} more alerts.</li>}
                            </ul>
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Work State</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Annual Gross</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Est. State Tax</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Nexus</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Calculating liabilities...</td></tr>
                                    ) : report.length === 0 ? (
                                        <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No remote workers with declared locations found.</td></tr>
                                    ) : (
                                        report.map(r => (
                                            <tr key={r.employeeId} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.fullName}</td>
                                                <td className="px-6 py-4 text-center text-sm font-mono text-gray-700 dark:text-slate-300">{r.stateCode}</td>
                                                <td className="px-6 py-4 text-right text-sm font-mono text-gray-700 dark:text-slate-300">{formatCurrency(r.annualGross, currency)}</td>
                                                <td className="px-6 py-4 text-right text-sm font-mono font-bold text-gray-900 dark:text-white">
                                                    {r.hasRules ? formatCurrency(r.annualStateTax, currency) : <span className="text-red-500 text-xs italic">No Rules</span>}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {r.hasNexus ? (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Active</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Missing</span>
                                                    )}
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
