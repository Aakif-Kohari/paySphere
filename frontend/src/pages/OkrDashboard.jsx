import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import KeyResultCheckInModal from '../components/KeyResultCheckInModal';

export default function OkrDashboard() {
    const [okrs, setOkrs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedKR, setSelectedKR] = useState(null);

    useEffect(() => { fetchOkrs(); }, []);

    const fetchOkrs = async () => {
        try {
            const res = await api.get('/api/okrs/my');
            setOkrs(res.data.okrs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleCheckInSuccess = () => {
        setSelectedKR(null);
        fetchOkrs();
    };

    const getStatusColor = (status) => {
        if (status === 'Completed') return 'text-green-600 dark:text-green-400';
        if (status === 'On Track') return 'text-blue-600 dark:text-blue-400';
        if (status === 'At Risk') return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="OKRs" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrackChangesIcon /> My OKRs & Key Results
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {loading ? (
                        <p className="text-center text-gray-500 py-12">Loading objectives...</p>
                    ) : okrs.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-gray-500 dark:text-slate-400">No OKRs assigned for this cycle.</p>
                        </div>
                    ) : (
                        okrs.map(obj => (
                            <div key={obj._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{obj.title}</h2>
                                        <p className="text-sm text-gray-500 dark:text-slate-400">{obj.cycle} • {obj.type} {obj.parentId && `• Aligned to: ${obj.parentId.title}`}</p>
                                    </div>
                                    <span className={`text-sm font-bold uppercase ${getStatusColor(obj.status)}`}>{obj.status}</span>
                                </div>

                                <div className="mb-4">
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                                        <span>Overall Progress</span>
                                        <span>{obj.overallProgress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                        <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${obj.overallProgress}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase">Key Results</h3>
                                    {obj.keyResults.map(kr => (
                                        <div key={kr._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{kr.title}</p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">
                                                    {kr.currentValue} / {kr.targetValue} {kr.unit} ({kr.progressPercent}%)
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedKR({ objectiveId: obj._id, objectiveTitle: obj.title, kr })}
                                                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg"
                                            >
                                                Check-in
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {selectedKR && (
                <KeyResultCheckInModal
                    data={selectedKR}
                    onClose={() => setSelectedKR(null)}
                    onSuccess={handleCheckInSuccess}
                />
            )}
        </div>
    );
}
