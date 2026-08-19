import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ApplicationDetailDrawer from '../components/ApplicationDetailDrawer';

const STATUSES = ['Applied', 'Screening', 'Interviewing', 'Offered', 'Hired', 'Rejected'];

export default function InternalHiringPipeline() {
    const [jobId, setJobId] = useState('');
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [selectedApp, setSelectedApp] = useState(null);

    useEffect(() => { fetchJobs(); }, []);
    useEffect(() => { if (jobId) fetchPipeline(); }, [jobId]);

    const fetchJobs = async () => {
        try {
            // Mocking fetching all active jobs for the dropdown
            const res = await api.get('/api/internal-jobs/open');
            setJobs(res.data.jobs);
            if (res.data.jobs.length > 0) setJobId(res.data.jobs[0]._id);
        } catch (err) { console.error(err); }
    };

    const fetchPipeline = async () => {
        try {
            const res = await api.get(`/api/internal-jobs/${jobId}/pipeline`);
            setApplications(res.data.applications);
        } catch (err) { console.error(err); }
    };

    const handleStatusUpdate = async (appId, newStatus) => {
        try {
            await api.patch(`/api/internal-jobs/applications/${appId}/status`, { status: newStatus });
            fetchPipeline();
            setSelectedApp(null);
        } catch (err) { alert('Failed to update status.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="HiringPipeline" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ViewKanbanIcon /> Internal Hiring Pipeline
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8">
                    <div className="mb-6 max-w-xs">
                        <select value={jobId} onChange={e => setJobId(e.target.value)} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                            {jobs.map(j => <option key={j._id} value={j._id}>{j.title} ({j.department})</option>)}
                        </select>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {STATUSES.map(status => {
                            const apps = applications.filter(a => a.status === status);
                            return (
                                <div key={status} className="min-w-[280px] bg-gray-100 dark:bg-slate-900 rounded-xl p-3 flex flex-col gap-3">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider px-2">{status} ({apps.length})</h3>
                                    {apps.map(app => (
                                        <div key={app._id} onClick={() => setSelectedApp(app)} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition">
                                            <p className="font-bold text-gray-900 dark:text-white text-sm">{app.applicantId?.fullName}</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">{app.applicantId?.role} • {app.applicantId?.department}</p>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedApp && (
                <ApplicationDetailDrawer
                    application={selectedApp}
                    onClose={() => setSelectedApp(null)}
                    onStatusUpdate={handleStatusUpdate}
                />
            )}
        </div>
    );
}
