import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

export default function RosterGenerator() {
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => { fetchCalendar(); }, [month, year]);

    const fetchCalendar = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/roster/calendar?month=${month}&year=${year}`);
            setRoster(res.data.roster);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleAutoGenerate = async () => {
        if (!window.confirm('This will overwrite all DRAFT shifts for the selected month. Continue?')) return;
        setGenerating(true);
        try {
            const daysInMonth = new Date(year, month, 0).getDate();
            await api.post('/api/roster/generate', {
                startDate: `${year}-${String(month).padStart(2, '0')}-01`,
                endDate: `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`
            });
            alert('Roster generated successfully!');
            fetchCalendar();
        } catch (err) { alert('Generation failed.'); } finally { setGenerating(false); }
    };

    const getFatigueColor = (score) => {
        if (score < 30) return 'text-green-600 dark:text-green-400';
        if (score < 70) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Rostering" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CalendarMonthIcon /> Algorithmic Shift Rostering
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
                        <button onClick={handleAutoGenerate} disabled={generating} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
                            <AutoFixHighIcon fontSize="small" /> {generating ? 'Generating...' : 'Auto-Generate Compliant Roster'}
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Shift</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Fatigue Score</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Compliance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading roster...</td></tr>
                                ) : roster.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No shifts generated for this month. Click Auto-Generate.</td></tr>
                                ) : (
                                    roster.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{r.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(r.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">
                                                <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: r.shiftTemplateId?.colorCode || '#3b82f6' }}>
                                                    {r.shiftTemplateId?.name} ({r.shiftTemplateId?.startTime} - {r.shiftTemplateId?.endTime})
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-center text-sm font-bold ${getFatigueColor(r.fatigueScore)}`}>
                                                {r.fatigueScore}%
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {r.isCompliant ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Compliant</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1 justify-center">
                                                        <WarningAmberIcon fontSize="small" /> Violation
                                                    </span>
                                                )}
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
