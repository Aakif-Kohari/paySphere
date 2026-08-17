import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import AddIcon from '@mui/icons-material/Add';

export default function TaxJurisdictionSettings() {
    const [jurisdictions, setJurisdictions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ stateCode: '', stateName: '', hasNexus: false, registrationNumber: '' });

    useEffect(() => { fetchJurisdictions(); }, []);

    const fetchJurisdictions = async () => {
        try {
            const res = await api.get('/api/regional-tax/jurisdictions');
            setJurisdictions(res.data.jurisdictions);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/regional-tax/jurisdictions', formData);
            alert('Jurisdiction saved!');
            setFormData({ stateCode: '', stateName: '', hasNexus: false, registrationNumber: '' });
            fetchJurisdictions();
        } catch (err) { alert('Failed to save.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="TaxSettings" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LocationCityIcon /> Multi-Jurisdiction Tax Settings
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Register New State/Region</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">State Code</label>
                                    <input type="text" maxLength="3" value={formData.stateCode} onChange={e => setFormData({ ...formData, stateCode: e.target.value.toUpperCase() })} required placeholder="e.g., CA" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">State Name</label>
                                    <input type="text" value={formData.stateName} onChange={e => setFormData({ ...formData, stateName: e.target.value })} required placeholder="e.g., California" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Registration Number (Optional)</label>
                                    <input type="text" value={formData.registrationNumber} onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={formData.hasNexus} onChange={e => setFormData({ ...formData, hasNexus: e.target.checked })} className="rounded text-brand-600" id="nexus" />
                                    <label htmlFor="nexus" className="text-sm text-gray-700 dark:text-slate-300">Company has established Tax Nexus here</label>
                                </div>
                                <button type="submit" className="w-full py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center justify-center gap-2">
                                    <AddIcon fontSize="small" /> Register Jurisdiction
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Registered Jurisdictions</h2>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">State</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Code</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Nexus Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Registration #</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {loading ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                                    ) : jurisdictions.length === 0 ? (
                                        <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500">No jurisdictions registered.</td></tr>
                                    ) : (
                                        jurisdictions.map(j => (
                                            <tr key={j._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{j.stateName}</td>
                                                <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-slate-300">{j.stateCode}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {j.hasNexus ? (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Established</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Pending</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{j.registrationNumber || '-'}</td>
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
