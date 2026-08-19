import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

export default function HandoverDashboard() {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('kt');

    useEffect(() => { fetchPlan(); }, []);

    const fetchPlan = async () => {
        try {
            const res = await api.get('/api/handover/my-handover');
            setPlan(res.data.plan);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleKTToggle = async (ktId, isCompleted) => {
        try {
            await api.patch('/api/handover/knowledge-transfer', { planId: plan._id, ktId, isCompleted });
            fetchPlan();
        } catch (err) { alert('Failed to update task.'); }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading handover plan...</div>;
    if (!plan) return (
        <div className="p-8 text-center text-gray-500 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 m-8">
            No active offboarding handover plan found.
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Handover" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ExitToAppIcon /> Offboarding Handover Dashboard
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {/* Progress Header */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Clearance Progress</h2>
                            <span className={`text-2xl font-bold ${plan.clearanceScore === 100 ? 'text-green-600' : 'text-brand-600'}`}>
                                {plan.clearanceScore}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 mb-3">
                            <div className="bg-brand-600 h-3 rounded-full transition-all" style={{ width: `${plan.clearanceScore}%` }}></div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                            Exit Date: <strong>{new Date(plan.exitDate).toLocaleDateString()}</strong> |
                            Status: <strong className={plan.status === 'Cleared' ? 'text-green-600' : 'text-amber-600'}>{plan.status}</strong>
                        </p>
                        {plan.isFnFBlocked && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                                ⚠️ Full & Final (F&F) settlement is currently BLOCKED. Complete all mandatory tasks to proceed.
                            </p>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-slate-700">
                        <button onClick={() => setActiveTab('kt')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'kt' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Knowledge Transfer ({plan.knowledgeTransfers.length})
                        </button>
                        <button onClick={() => setActiveTab('assets')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'assets' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>
                            Asset Recovery ({plan.assetRecoveries.length})
                        </button>
                    </div>

                    {activeTab === 'kt' && (
                        <div className="space-y-3">
                            {plan.knowledgeTransfers.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No knowledge transfer tasks assigned.</p>
                            ) : (
                                plan.knowledgeTransfers.map(kt => (
                                    <div key={kt._id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex items-start gap-3">
                                        <button onClick={() => handleKTToggle(kt._id, !kt.isCompleted)} className="mt-1">
                                            {kt.isCompleted ? <CheckCircleIcon className="text-green-500" /> : <RadioButtonUncheckedIcon className="text-gray-400" />}
                                        </button>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`text-sm font-bold ${kt.isCompleted ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>{kt.title}</h4>
                                                {kt.isMandatory && <span className="text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded">MANDATORY</span>}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{kt.description}</p>
                                            {kt.link && <a href={kt.link} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline mt-1 block">{kt.link}</a>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'assets' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Asset</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Condition</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {plan.assetRecoveries.map(asset => (
                                        <tr key={asset._id}>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{asset.assetName}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${asset.condition === 'Returned Good' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                                    asset.condition === 'Pending Return' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                                                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                    }`}>{asset.condition}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
