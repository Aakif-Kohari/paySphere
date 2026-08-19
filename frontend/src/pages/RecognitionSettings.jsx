import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import SettingsIcon from '@mui/icons-material/Settings';

export default function RecognitionSettings() {
    const [config, setConfig] = useState({ monthlyAllowance: 100, maxCarryOver: 50, redemptionRate: 10, isActive: true });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        try {
            const res = await api.get('/api/recognition/config');
            setConfig(res.data.config);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/api/recognition/config', config);
            alert('Settings saved!');
        } catch (err) { alert('Failed to save.'); } finally { setSaving(false); }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="RecognitionSettings" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon /> Recognition Program Settings
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Program Status</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400">Enable or disable the Kudos program company-wide.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={config.isActive} onChange={e => setConfig({ ...config, isActive: e.target.checked })} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-600"></div>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Monthly Allowance (Points)</label>
                            <input type="number" value={config.monthlyAllowance} onChange={e => setConfig({ ...config, monthlyAllowance: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            <p className="text-xs text-gray-500 mt-1">Points distributed to every active employee on the 1st of the month.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Max Carry-Over Limit</label>
                            <input type="number" value={config.maxCarryOver} onChange={e => setConfig({ ...config, maxCarryOver: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            <p className="text-xs text-gray-500 mt-1">Maximum unused points that roll over to the next month.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Redemption Rate</label>
                            <input type="number" value={config.redemptionRate} onChange={e => setConfig({ ...config, redemptionRate: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            <p className="text-xs text-gray-500 mt-1">How many points equal 1 unit of currency (e.g., 10 points = $1).</p>
                        </div>

                        <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
