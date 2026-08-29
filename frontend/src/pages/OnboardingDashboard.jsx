import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import TaskChecklist from '../components/TaskChecklist';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function OnboardingDashboard() {
    const [tasks, setTasks] = useState([]);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tasks');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/onboarding/my-tasks');
            setTasks(res.data.tasks);
            setProgress(res.data.progress);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await api.patch(`/api/onboarding/tasks/${taskId}/status`, { status: newStatus });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update task');
        }
    };

    const handleDocUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            // Mock upload logic
            await api.post('/api/onboarding/documents', {
                documentType: 'KYC Document',
                fileUrl: `mock://uploads/${file.name}`,
                fileName: file.name
            });
            alert('Document uploaded successfully');
        } catch (err) { alert('Upload failed'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Onboarding" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AssignmentTurnedInIcon /> My Onboarding Journey
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
                    {/* Progress Bar */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Overall Progress</h2>
                            <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3">
                            <div className="bg-brand-600 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('tasks')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'tasks' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Task Checklist</button>
                        <button onClick={() => setActiveTab('documents')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'documents' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>KYC Documents</button>
                    </div>

                    {activeTab === 'tasks' && (
                        loading ? <p className="text-center text-gray-500 py-12">Loading your onboarding tasks...</p> :
                            tasks.length === 0 ? <p className="text-center text-gray-500 py-12">No onboarding tasks assigned yet.</p> :
                                <TaskChecklist tasks={tasks} onStatusChange={handleStatusChange} />
                    )}

                    {activeTab === 'documents' && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mandatory KYC Uploads</h3>
                            <p className="text-sm text-gray-600 dark:text-slate-400">Please upload clear scans of your identity and address proofs.</p>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                <CloudUploadIcon className="text-gray-400 dark:text-slate-500" fontSize="large" />
                                <span className="text-sm text-gray-500 dark:text-slate-400 mt-2">Click to upload document</span>
                                <input type="file" className="hidden" onChange={handleDocUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
