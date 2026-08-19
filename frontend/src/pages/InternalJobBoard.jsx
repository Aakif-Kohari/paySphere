import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import WorkIcon from '@mui/icons-material/Work';
import SendIcon from '@mui/icons-material/Send';

export default function InternalJobBoard() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchJobs(); }, []);

    const fetchJobs = async () => {
        try {
            const res = await api.get('/api/internal-jobs/open');
            setJobs(res.data.jobs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleApply = async (jobId) => {
        if (!window.confirm('Are you sure you want to apply for this internal role? Your current manager will be notified upon hiring.')) return;
        try {
            await api.post(`/api/internal-jobs/${jobId}/apply`, { coverLetter: 'I am very interested in this opportunity and believe my skills align perfectly with the team goals.' });
            alert('Application submitted successfully!');
            fetchJobs();
        } catch (err) { alert(err.response?.data?.message || 'Failed to apply.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="InternalJobs" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <WorkIcon /> Internal Job Board
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <p className="col-span-full text-center text-gray-500 py-12">Loading opportunities...</p>
                    ) : jobs.length === 0 ? (
                        <div className="col-span-full text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-gray-500 dark:text-slate-400">No internal openings available at the moment.</p>
                        </div>
                    ) : (
                        jobs.map(job => (
                            <div key={job._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-6 flex flex-col">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{job.title}</h3>
                                    <p className="text-sm text-brand-600 dark:text-brand-400 font-semibold mb-2">{job.department}</p>
                                    <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-3 mb-4">{job.description}</p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {job.requiredSkills?.slice(0, 3).map(skill => (
                                            <span key={skill} className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full text-xs font-medium">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => handleApply(job._id)} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition">
                                    <SendIcon fontSize="small" /> Apply Internally
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
