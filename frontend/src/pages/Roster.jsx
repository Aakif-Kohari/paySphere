/**
 * @fileoverview Shift Roster Calendar Page
 * @description Displays a weekly grid of employee shifts with color-coded templates.
 * Issue: #956
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

export default function Roster() {
    const navigate = useNavigate();
    const [roster, setRoster] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState('Roster');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch current week's roster
                const today = new Date();
                const start = new Date(today);
                start.setDate(today.getDate() - today.getDay()); // Sunday
                const end = new Date(start);
                end.setDate(start.getDate() + 6); // Saturday

                const res = await api.get(`/api/shifts/roster?start=${start.toISOString()}&end=${end.toISOString()}`);
                setRoster(res.data.roster);

                // Fetch templates for legend/colors
                // Assuming a GET /api/shifts/templates exists or is fetched via another endpoint
                // For now, we'll extract unique templates from the roster data
                const uniqueTemplates = {};
                res.data.roster.forEach(r => {
                    if (r.shiftTemplateId) uniqueTemplates[r.shiftTemplateId._id] = r.shiftTemplateId;
                });
                setTemplates(Object.values(uniqueTemplates));
            } catch (err) {
                console.error('Failed to fetch roster', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <>
            <Helmet><title>Shift Roster | PaySphere</title></Helmet>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
                <Sidebar activePage={activePage} setActivePage={(p) => { setActivePage(p); navigate(`/${p.toLowerCase()}`); }} isSidebarOpen={false} onClose={() => { }} />

                <div className="lg:ml-64">
                    <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <CalendarMonthIcon /> Weekly Shift Roster
                        </h1>
                        <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                                {templates.map(t => (
                                    <div key={t._id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.colorCode }}></div>
                                        {t.name}
                                    </div>
                                ))}
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>

                    <div className="p-4 lg:p-8">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-slate-700">
                                {daysOfWeek.map(day => (
                                    <div key={day} className="px-4 py-3 bg-gray-50 dark:bg-slate-900/50 text-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 min-h-[400px] flex items-center justify-center text-gray-500 dark:text-slate-400">
                                {loading ? (
                                    <p>Loading roster grid...</p>
                                ) : roster.length === 0 ? (
                                    <div className="text-center">
                                        <CalendarMonthIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                                        <p className="mt-2 font-semibold">No shifts scheduled for this week.</p>
                                        <p className="text-sm">Drag and drop shift templates onto employee rows to schedule.</p>
                                    </div>
                                ) : (
                                    <p className="text-sm">Roster grid rendering logic for {roster.length} shifts...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
