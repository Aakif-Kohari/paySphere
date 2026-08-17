import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import PostAddIcon from '@mui/icons-material/PostAdd';

export default function OpenShifts() {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00',
        requiredDepartment: '',
        premiumMultiplier: 1.0,
        reason: 'Call-out coverage'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Mocking shiftTemplateId for demonstration
            await api.post('/api/shifts/marketplace/open', { ...formData, shiftTemplateId: '65f1a2b3c4d5e6f7g8h9i0j1' });
            alert('Shift posted to marketplace!');
            setFormData({ ...formData, reason: 'Call-out coverage' });
        } catch (err) {
            alert('Failed to post shift.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="OpenShifts" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PostAddIcon /> Post Open Shift
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Publish Uncovered Shift</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Date</label>
                                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Department</label>
                                <input type="text" placeholder="e.g., Nursing" value={formData.requiredDepartment} onChange={e => setFormData({ ...formData, requiredDepartment: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Start Time</label>
                                <input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">End Time</label>
                                <input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                Premium Multiplier: <span className="text-brand-600">{formData.premiumMultiplier}x</span>
                            </label>
                            <input type="range" min="1" max="2.5" step="0.25" value={formData.premiumMultiplier} onChange={e => setFormData({ ...formData, premiumMultiplier: Number(e.target.value) })} className="w-full accent-brand-600" />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Reason</label>
                            <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} rows="2" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>

                        <button type="submit" className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg">
                            Publish to Marketplace
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
