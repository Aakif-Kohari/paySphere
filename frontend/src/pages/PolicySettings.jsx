import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SettingsIcon from '@mui/icons-material/Settings';

const DEFAULT_CATEGORIES = ['Travel', 'Meals', 'Lodging', 'Office Supplies', 'Software', 'Client Entertainment', 'Other'];

export default function PolicySettings() {
    const [policy, setPolicy] = useState({ autoApprovalThreshold: 1000, categories: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchPolicy(); }, []);

    const fetchPolicy = async () => {
        try {
            const res = await api.get('/api/expenses/policy');
            const p = res.data.policy;
            // Ensure all categories exist in state
            const cats = DEFAULT_CATEGORIES.map(c => {
                const found = p.categories.find(x => x.category === c);
                return found || { category: c, maxLimitPerClaim: 0, maxLimitPerMonth: 0, requiresReceipt: true, receiptThreshold: 0, weekendAllowed: true };
            });
            setPolicy({ ...p, categories: cats });
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleCategoryChange = (index, field, value) => {
        const newCats = [...policy.categories];
        newCats[index] = { ...newCats[index], [field]: value };
        setPolicy({ ...policy, categories: newCats });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/api/expenses/policy', policy);
            alert('Policy saved successfully!');
        } catch (err) { alert('Failed to save policy.'); } finally { setSaving(false); }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading policy...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="PolicySettings" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon /> Expense Policy Settings
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Global Rules</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Auto-Approval Threshold</label>
                                <input type="number" value={policy.autoApprovalThreshold} onChange={e => setPolicy({ ...policy, autoApprovalThreshold: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                <p className="text-xs text-gray-500 mt-1">Compliant claims under this amount are auto-approved.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Category Limits</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Category</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Max/Claim</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Max/Month</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Receipt Req.</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Weekends</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {policy.categories.map((cat, i) => (
                                        <tr key={cat.category} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{cat.category}</td>
                                            <td className="px-4 py-3"><input type="number" value={cat.maxLimitPerClaim} onChange={e => handleCategoryChange(i, 'maxLimitPerClaim', Number(e.target.value))} className="w-24 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm text-right" /></td>
                                            <td className="px-4 py-3"><input type="number" value={cat.maxLimitPerMonth} onChange={e => handleCategoryChange(i, 'maxLimitPerMonth', Number(e.target.value))} className="w-24 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm text-right" /></td>
                                            <td className="px-4 py-3 text-center"><input type="checkbox" checked={cat.requiresReceipt} onChange={e => handleCategoryChange(i, 'requiresReceipt', e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500" /></td>
                                            <td className="px-4 py-3 text-center"><input type="checkbox" checked={cat.weekendAllowed} onChange={e => handleCategoryChange(i, 'weekendAllowed', e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                                {saving ? 'Saving...' : 'Save Policy'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
