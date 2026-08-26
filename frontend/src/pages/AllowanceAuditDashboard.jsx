import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function AllowanceAuditDashboard() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [selectedItems, setSelectedItems] = useState([]);

    useEffect(() => { fetchAudit(); }, [month, year]);

    const fetchAudit = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/shift-allowances/audit?month=${month}&year=${year}`);
            setItems(res.data.items || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSelect = (id) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleApprove = async () => {
        if (selectedItems.length === 0) return alert('Select items to approve.');
        try {
            await api.post('/api/shift-allowances/approve', { itemIds: selectedItems });
            alert('Batch approved for payroll!');
            setSelectedItems([]);
            fetchAudit();
        } catch (err) { alert('Approval failed.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Allowances" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ScheduleIcon className="text-purple-500" /> Shift Allowance & Differential Audit
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
                            </select>
                            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>
                        <button onClick={handleApprove} disabled={selectedItems.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                            <CheckCircleIcon fontSize="small" /> Approve Selected ({selectedItems.length})
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 w-10">
                                        <input type="checkbox" onChange={e => setSelectedItems(e.target.checked ? items.filter(i => i.status === 'Calculated').map(i => i._id) : [])} className="rounded text-brand-600" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Component</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Hours/Days</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Amount</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading audit batch...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No calculated allowances for this period.</td></tr>
                                ) : (
                                    items.map(item => (
                                        <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.includes(item._id)}
                                                    onChange={() => handleSelect(item._id)}
                                                    disabled={item.status !== 'Calculated'}
                                                    className="rounded text-brand-600"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">
                                                {item.componentName}
                                                {item.anomalies.length > 0 && (
                                                    <span className="ml-2 text-amber-500" title={item.anomalies.join(', ')}>
                                                        <WarningAmberIcon fontSize="small" />
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{item.premiumHours}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">₹{item.amount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                                    }`}>{item.status}</span>
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
    );
}
