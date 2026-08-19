import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SettingsIcon from '@mui/icons-material/Settings';

export default function ToilPolicySettings() {
    const [policy, setPolicy] = useState({ weekendMultiplier: 1.0, holidayMultiplier: 1.5, maxAccumulationDays: 15, expirationDays: 90, allowEncashment: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchPolicy(); }, []);

    const fetchPolicy = async () => {
        try {
            const res = await api.get('/api/toil/policy');
            setPolicy(res.data.policy);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/api/toil/policy', policy);
            alert('Policy saved!');
        } catch (err) { alert('Failed to save.'); } finally { setSaving(false); }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="ToilSettings" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon /> TOIL Policy Settings
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Weekend Multiplier</label>
                                <input type="number" step="0.5" value={policy.weekendMultiplier} onChange={e => setPolicy({ ...policy, weekendMultiplier: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                <p className="text-xs text-gray-500 mt-1">e.g., 1.0 means 1 day worked = 1 TOIL day.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Holiday Multiplier</label>
                                <input type="number" step="0.5" value={policy.holidayMultiplier} onChange={e => setPolicy({ ...policy, holidayMultiplier: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                <p className="text-xs text-gray-500 mt-1">e.g., 1.5 means 1 public holiday = 1.5 TOIL days.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Max Accumulation Cap (Days)</label>
                                <input type="number" value={policy.maxAccumulationDays} onChange={e => setPolicy({ ...policy, maxAccumulationDays: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Expiration Window (Days)</label>
                                <input type="number" value={policy.expirationDays} onChange={e => setPolicy({ ...policy, expirationDays: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={policy.allowEncashment} onChange={e => setPolicy({ ...policy, allowEncashment: e.target.checked })} className="rounded text-brand-600" id="encash" />
                            <label htmlFor="encash" className="text-sm text-gray-700 dark:text-slate-300">Allow employees to encash TOIL instead of taking time off</label>
                        </div>

                        <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save Policy'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
