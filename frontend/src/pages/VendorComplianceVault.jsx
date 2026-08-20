import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DownloadIcon from '@mui/icons-material/Download';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function VendorComplianceVault() {
    const [vendors, setVendors] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fy, setFy] = useState('2026-27');
    const [quarter, setQuarter] = useState('Q1');

    useEffect(() => { fetchData(); }, [fy, quarter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vRes, lRes] = await Promise.all([
                api.get('/api/vendor-tds/vendors'),
                api.get(`/api/vendor-tds/ledger?fy=${fy}&quarter=${quarter}`)
            ]);
            setVendors(vRes.data.vendors);
            setLedger(lRes.data.ledger);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleGenerate26Q = async () => {
        try {
            const res = await api.post('/api/vendor-tds/form26q/generate', { financialYear: fy, quarter });
            alert(`Form 26Q Generated! Total TDS: ₹${res.data.draft.stats.totalTDS.toLocaleString()}`);
            // In a real app, trigger download of res.data.draft.fileContent
        } catch (err) { alert(err.response?.data?.message || 'Generation failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="VendorTDS" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon /> Vendor TDS Compliance (194C/194J)
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            <select value={fy} onChange={e => setFy(e.target.value)} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                <option value="2026-27">FY 2026-27</option>
                                <option value="2025-26">FY 2025-26</option>
                            </select>
                            <select value={quarter} onChange={e => setQuarter(e.target.value)} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                <option value="Q1">Q1 (Apr-Jun)</option>
                                <option value="Q2">Q2 (Jul-Sep)</option>
                                <option value="Q3">Q3 (Oct-Dec)</option>
                                <option value="Q4">Q4 (Jan-Mar)</option>
                            </select>
                        </div>
                        <button onClick={handleGenerate26Q} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                            <DownloadIcon fontSize="small" /> Generate Form 26Q
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Vendor Profiles */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Vendor Tax Profiles</h2>
                            </div>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Vendor</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">PAN</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Section</th>
                                            <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {vendors.map(v => (
                                            <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{v.vendorName}</td>
                                                <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-slate-300">{v.pan}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{v.sectionType}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                                                    {v.hasLDC ? <span className="text-green-600">{v.ldcRate}% (LDC)</span> : `${v.standardRate}%`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* TDS Ledger */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quarterly Deduction Ledger</h2>
                            </div>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Vendor</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">TDS Amt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                                        ) : ledger.map(l => (
                                            <tr key={l._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{new Date(l.invoiceDate).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{l.vendorId?.vendorName}</td>
                                                <td className="px-4 py-3 text-sm text-right font-mono font-bold text-red-600 dark:text-red-400">₹{l.tdsAmount.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
