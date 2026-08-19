import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DownloadIcon from '@mui/icons-material/Download';
import CalculateIcon from '@mui/icons-material/Calculate';
import { formatCurrency } from '../utils/currency';

const DEFAULT_COMPONENTS = [
    { key: 'basicSalary', label: 'Basic Salary', nature: 'Debit' },
    { key: 'hra', label: 'House Rent Allowance', nature: 'Debit' },
    { key: 'allowances', label: 'Special Allowances', nature: 'Debit' },
    { key: 'bonus', label: 'Bonus / Incentives', nature: 'Debit' },
    { key: 'employerPF', label: 'Employer PF Contribution', nature: 'Debit' },
    { key: 'employeePF', label: 'Employee PF Payable', nature: 'Credit' },
    { key: 'tds', label: 'TDS Payable (Sec 192)', nature: 'Credit' },
    { key: 'professionalTax', label: 'Professional Tax Payable', nature: 'Credit' },
    { key: 'netSalary', label: 'Salary Payable (Net)', nature: 'Credit' },
];

export default function AccountingExport() {
    const [activeTab, setActiveTab] = useState('export');
    const [mappings, setMappings] = useState([]);
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
    const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/accounting/mappings');
            const existing = res.data.mappings;

            // Merge with defaults to ensure all components are shown
            const merged = DEFAULT_COMPONENTS.map(def => {
                const found = existing.find(e => e.componentKey === def.key);
                return found || { componentKey: def.key, glAccountName: def.label, glAccountCode: '', nature: def.nature };
            });
            setMappings(merged);

            // Fetch existing vouchers (mocking a list endpoint for UI demonstration)
            // In a real app, there would be a GET /api/accounting/vouchers endpoint
            setVouchers([]);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleMappingChange = (index, field, value) => {
        const newMappings = [...mappings];
        newMappings[index] = { ...newMappings[index], [field]: value };
        setMappings(newMappings);
    };

    const handleSaveMappings = async () => {
        try {
            await api.post('/api/accounting/mappings', { mappings });
            alert('GL Mappings saved successfully');
        } catch (err) { alert('Failed to save mappings'); }
    };

    const handleGenerateJournal = async () => {
        try {
            await api.post('/api/accounting/generate-journal', { month: generateMonth, year: generateYear });
            alert('Journal Voucher generated successfully!');
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to generate journal'); }
    };

    const handleExport = (id, type) => {
        const token = localStorage.getItem('token');
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        window.open(`${baseUrl}/api/accounting/export/${id}/${type}?token=${token}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Accounting" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon /> Double-Entry Accounting & ERP Export
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8">
                    <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
                        <button onClick={() => setActiveTab('export')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'export' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Generate & Export Journals</button>
                        <button onClick={() => setActiveTab('mappings')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'mappings' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>GL Account Mapping</button>
                    </div>

                    {activeTab === 'export' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Month</label>
                                    <select value={generateMonth} onChange={e => setGenerateMonth(Number(e.target.value))} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Year</label>
                                    <input type="number" value={generateYear} onChange={e => setGenerateYear(Number(e.target.value))} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white w-24" />
                                </div>
                                <button onClick={handleGenerateJournal} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                    <CalculateIcon fontSize="small" /> Generate Journal Voucher
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Voucher No.</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total Debit</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total Credit</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Export</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {vouchers.length === 0 ? (
                                            <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No journal vouchers generated yet. Generate one above.</td></tr>
                                        ) : vouchers.map(v => (
                                            <tr key={v._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{v.voucherNumber}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(v.voucherDate).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{formatCurrency(v.totalDebit, currency)}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{formatCurrency(v.totalCredit, currency)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.isBalanced ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>
                                                        {v.isBalanced ? 'Balanced' : 'Unbalanced'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleExport(v._id, 'tally')} className="p-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg hover:bg-amber-200" title="Export Tally XML">
                                                            <DownloadIcon fontSize="small" />
                                                        </button>
                                                        <button onClick={() => handleExport(v._id, 'csv')} className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200" title="Export Generic CSV">
                                                            <DownloadIcon fontSize="small" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'mappings' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">PaySphere Component</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Nature</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Tally / ERP Ledger Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">GL Code (Optional)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {mappings.map((m, i) => (
                                        <tr key={m.componentKey} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{DEFAULT_COMPONENTS.find(c => c.key === m.componentKey)?.label}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.nature === 'Debit' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                                                    {m.nature}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input type="text" value={m.glAccountName} onChange={e => handleMappingChange(i, 'glAccountName', e.target.value)} className="w-full px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input type="text" value={m.glAccountCode} onChange={e => handleMappingChange(i, 'glAccountCode', e.target.value)} className="w-24 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                                <button onClick={handleSaveMappings} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Save GL Mappings</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
