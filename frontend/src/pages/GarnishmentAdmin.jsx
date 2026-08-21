import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import GavelIcon from '@mui/icons-material/Gavel';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';

export default function GarnishmentAdmin() {
    const [orders, setOrders] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        employeeId: '', type: 'Creditor Debt', agencyName: '', agencyRemittanceEmail: '',
        caseNumber: '', totalAmountOwed: 0, monthlyDeductionAmount: 0, priority: 4, startDate: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchOrders(); }, []);

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/garnishments/orders');
            setOrders(res.data.orders || []);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/garnishments/orders', formData);
            alert('Garnishment order created!');
            setShowForm(false);
            fetchOrders();
            setFormData({
                employeeId: '', type: 'Creditor Debt', agencyName: '', agencyRemittanceEmail: '',
                caseNumber: '', totalAmountOwed: 0, monthlyDeductionAmount: 0, priority: 4, startDate: ''
            });
        } catch (err) { alert(err.response?.data?.message || 'Creation failed.'); } finally { setLoading(false); }
    };

    const handleGenerateReport = async () => {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        try {
            const res = await api.get(`/api/garnishments/report?month=${month}&year=${year}`);
            alert(`Remittance report generated for ${res.data.report.length} agencies.`);
            // In a real app, trigger CSV download here
        } catch (err) { alert('Report generation failed.'); }
    };

    const getTypeColor = (type) => {
        if (type === 'Child Support') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        if (type === 'Tax Levy') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Garnishments" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <GavelIcon /> Wage Garnishment & Court Orders
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                            Manage court-ordered deductions. The engine automatically enforces statutory caps and priority rules during payroll processing.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={handleGenerateReport} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2">
                                <DownloadIcon fontSize="small" /> Agency Remittance Report
                            </button>
                            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                <AddIcon fontSize="small" /> Add Court Order
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Agency / Case</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Type</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Owed / Deducted</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Priority</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {orders.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No active garnishment orders.</td></tr>
                                ) : orders.map(o => (
                                    <tr key={o._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{o.employeeId?.fullName}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{o.agencyName}</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">Case: {o.caseNumber}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTypeColor(o.type)}`}>{o.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-mono text-gray-700 dark:text-slate-300">
                                            ₹{o.amountDeductedToDate.toLocaleString()} <span className="text-gray-400">/</span> ₹{o.totalAmountOwed.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-900 dark:text-white">#{o.priority}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Court-Ordered Garnishment</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Employee ID</label>
                                    <input type="text" value={formData.employeeId} onChange={e => setFormData({ ...formData, employeeId: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Case Number</label>
                                    <input type="text" value={formData.caseNumber} onChange={e => setFormData({ ...formData, caseNumber: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Type</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value, priority: e.target.value === 'Child Support' ? 1 : e.target.value === 'Tax Levy' ? 2 : 4 })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                        <option>Child Support</option>
                                        <option>Tax Levy</option>
                                        <option>Student Loan</option>
                                        <option>Creditor Debt</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Priority (1 is Highest)</label>
                                    <input type="number" min="1" max="10" value={formData.priority} onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Agency Name</label>
                                <input type="text" value={formData.agencyName} onChange={e => setFormData({ ...formData, agencyName: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Total Amount Owed</label>
                                    <input type="number" value={formData.totalAmountOwed} onChange={e => setFormData({ ...formData, totalAmountOwed: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Monthly Deduction Max</label>
                                    <input type="number" value={formData.monthlyDeductionAmount} onChange={e => setFormData({ ...formData, monthlyDeductionAmount: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Start Date</label>
                                <input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Create Order'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
