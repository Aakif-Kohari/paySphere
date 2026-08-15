import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AssessmentIcon from '@mui/icons-material/Assessment';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

export default function AppraisalDashboard() {
    const [review, setReview] = useState(null);
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('goals');

    // Mock cycle ID for demonstration; real app would fetch active cycles
    const cycleId = '65f1a2b3c4d5e6f7g8h9i0j1';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`/api/appraisals/my-review?cycleId=${cycleId}`);
                setReview(res.data.review);
                setGoals(res.data.goals);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const handleSelfRating = (goalId, value) => {
        setGoals(goals.map(g => g._id === goalId ? { ...g, selfAchievement: value } : g));
    };

    const renderStars = (rating, max = 5) => {
        return (
            <div className="flex gap-0.5">
                {Array.from({ length: max }).map((_, i) => (
                    i < rating ? <StarIcon key={i} className="text-amber-400" fontSize="small" />
                        : <StarBorderIcon key={i} className="text-gray-400" fontSize="small" />
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Appraisals" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AssessmentIcon /> Performance Appraisal
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    {loading ? (
                        <p className="text-center text-gray-500 py-12">Loading appraisal data...</p>
                    ) : !review ? (
                        <div className="bg-white dark:bg-slate-800 p-12 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
                            <p className="text-gray-500 dark:text-slate-400">No active appraisal cycle found for your profile.</p>
                        </div>
                    ) : (
                        <>
                            {/* Status Banner */}
                            <div className={`p-4 rounded-xl border ${review.status === 'Finalized' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                                    review.status === 'Manager-Review' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                                        'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                }`}>
                                <p className="font-bold text-gray-900 dark:text-white">
                                    Status: <span className="capitalize">{review.status.replace('-', ' ')}</span>
                                </p>
                                {review.status === 'Finalized' && (
                                    <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
                                        Final Score: <strong>{review.finalScore}/100</strong> | Recommended Increment: <strong>{review.recommendedIncrementPercent}%</strong>
                                    </p>
                                )}
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-200 dark:border-slate-700">
                                <button onClick={() => setActiveTab('goals')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'goals' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Goals & KRAs</button>
                                <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${activeTab === 'feedback' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500'}`}>Manager Feedback</button>
                            </div>

                            {activeTab === 'goals' && (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Goal</th>
                                                <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Weight</th>
                                                <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Self Rating</th>
                                                <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Manager Rating</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                            {goals.map(g => (
                                                <tr key={g._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{g.title}</p>
                                                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{g.description}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-slate-300">{g.weightage}%</td>
                                                    <td className="px-6 py-4 text-center">
                                                        {review.status === 'Draft' || review.status === 'Self-Review' ? (
                                                            <input type="number" min="0" max="100" value={g.selfAchievement} onChange={e => handleSelfRating(g._id, e.target.value)} className="w-16 px-2 py-1 border rounded text-center bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-gray-300 dark:border-slate-600" />
                                                        ) : (
                                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{g.selfAchievement}%</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                                        {g.managerAchievement > 0 ? `${g.managerAchievement}%` : <span className="text-gray-400 italic">Pending</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {review.status === 'Self-Review' && (
                                        <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                                            <button className="px-6 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Submit Self-Review</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'feedback' && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Manager's Qualitative Feedback</h3>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Overall Rating:</span>
                                        {renderStars(review.managerOverallRating)}
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                                        <p className="text-sm text-gray-700 dark:text-slate-300 italic">
                                            {review.managerQualitativeFeedback || "No qualitative feedback provided yet."}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
