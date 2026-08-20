import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ScheduleIcon from '@mui/icons-material/Schedule';

export default function LoanPortal() {
    const [loans, setLoans] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [policy, setPolicy] = useState({ maxAdvanceAmount: 0, maxLoanAmount: 0, maxTenureMonths: 12 });
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ type: 'Salary Advance', principalAmount: '', tenureMonths: 1, purpose: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [loanRes, policyRes] = await Promise.all([
                api.get('/api/loans/my-loans'),
                api.get('/api/loans/policy')
            ]);
            setLoans(loanRes.data.loans);
            setSchedules(loanRes.data.schedules);
            setPolicy(policyRes.data.policy);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/loans/request', formData);
            alert('Request submitted!');
            setShowForm(false);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Submission failed.'); } finally { setLoading(false); }
    };

    const activeLoan = loans.find(l => l.status === 'Approved');
    const mySchedule = activeLoan ? schedules.filter(s => s.loanId === activeLoan._id) : [];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Loans" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceWalletIcon /> Loan & Advance Portal
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end">
                        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">
                            Request New Advance/Loan
                        </button>
                    </div>

                    {activeLoan && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                                <ScheduleIcon className="text-brand-600" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Amortization Schedule ({activeLoan.type})</h2>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Month/Year</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Principal</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Interest</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total EMI</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                        {mySchedule.map(s => (
                                            <tr key={s._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{s.month}/{s.year}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">₹{s.principalComponent.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono text-gray-500 dark:text-slate-400">₹{s.interestComponent.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">₹{s.totalEmi.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'Deducted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                            s.status === 'Deferred' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                                                                'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                                        }`}>{s.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Request Advance/Loan</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Type</label>
                                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    <option value="Salary Advance">Salary Advance (Max ₹{policy.maxAdvanceAmount.toLocaleString()})</option>
                                    <option value="Company Loan">Company Loan (Max ₹{policy.maxLoanAmount.toLocaleString()})</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Amount</label>
                                <input type="number" value={formData.principalAmount} onChange={e => setFormData({ ...formData, principalAmount: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Tenure (Months, Max {policy.maxTenureMonths})</label>
                                <input type="number" min="1" max={policy.maxTenureMonths} value={formData.tenureMonths} onChange={e => setFormData({ ...formData, tenureMonths: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}