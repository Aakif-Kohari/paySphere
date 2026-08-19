import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

export default function ReferralPortal() {
    const [programs, setPrograms] = useState([]);
    const [referrals, setReferrals] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ programId: '', candidateName: '', candidateEmail: '', candidatePhone: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [progRes, refRes] = await Promise.all([
                api.get('/api/referrals/programs'),
                api.get('/api/referrals/my-referrals')
            ]);
            setPrograms(progRes.data.programs);
            setReferrals(refRes.data.referrals);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/referrals/submit', formData);
            alert('Referral submitted!');
            setShowForm(false);
            setFormData({ programId: '', candidateName: '', candidateEmail: '', candidatePhone: '' });
            fetchData();
        } catch (err) { alert('Submission failed.'); } finally { setLoading(false); }
    };

    const totalEarned = referrals.reduce((sum, r) => sum + (r.payout?.status === 'Paid' ? r.payout.amount : 0), 0);
    const totalPending = referrals.reduce((sum, r) => sum + (r.payout?.status === 'Approved' || r.payout?.status === 'Pending' ? r.payout.amount : 0), 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Referrals" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <GroupAddIcon /> Employee Referral Portal
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-brand-50 dark:bg-brand-900/20 p-6 rounded-xl border border-brand-200 dark:border-brand-800">
                            <p className="text-sm font-semibold text-brand-800 dark:text-brand-200 uppercase">Total Earned</p>
                            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 mt-2">₹{totalEarned.toLocaleString()}</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase">Pending Payouts</p>
                            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">₹{totalPending.toLocaleString()}</p>
                        </div>
                        <button onClick={() => setShowForm(true)} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center text-brand-600 dark:text-brand-400">
                            <GroupAddIcon fontSize="large" />
                            <span className="font-bold mt-2">Refer a Friend</span>
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Referrals</h2>
                        </div>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Candidate</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Role/Program</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Bonus Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {referrals.map(r => (
                                    <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.candidateName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{r.programId?.title}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === 'Hired' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                    r.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                                }`}>{r.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-mono text-gray-900 dark:text-white">
                                            {r.payout ? (
                                                <span className={r.payout.status === 'Paid' ? 'text-green-600' : 'text-amber-600'}>
                                                    ₹{r.payout.amount.toLocaleString()} ({r.payout.status})
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Refer a Candidate</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Open Program</label>
                                <select value={formData.programId} onChange={e => setFormData({ ...formData, programId: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    <option value="">Select a role...</option>
                                    {programs.map(p => <option key={p._id} value={p._id}>{p.title} (₹{p.bountyAmount.toLocaleString()})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Candidate Name</label>
                                <input type="text" value={formData.candidateName} onChange={e => setFormData({ ...formData, candidateName: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Candidate Email</label>
                                <input type="email" value={formData.candidateEmail} onChange={e => setFormData({ ...formData, candidateEmail: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Submitting...' : 'Submit Referral'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
