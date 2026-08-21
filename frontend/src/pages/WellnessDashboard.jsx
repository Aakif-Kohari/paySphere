import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export default function WellnessDashboard() {
    const [challenges, setChallenges] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [activeChallenge, setActiveChallenge] = useState(null);
    const [activityForm, setActivityForm] = useState({ metricValue: 0, source: 'Manual' });

    useEffect(() => { fetchChallenges(); }, []);

    const fetchChallenges = async () => {
        try {
            // Mocking fetch
            setChallenges([{ _id: '1', title: 'Q3 Step Challenge', type: 'Steps', status: 'Active', targetGoal: 100000 }]);
            setActiveChallenge({ _id: '1', title: 'Q3 Step Challenge', type: 'Steps', status: 'Active', targetGoal: 100000 });
            fetchLeaderboard('1');
        } catch (err) { console.error(err); }
    };

    const fetchLeaderboard = async (id) => {
        try {
            const res = await api.get(`/api/wellness/leaderboard/${id}`);
            setLeaderboard(res.data.leaderboard || []);
        } catch (err) { console.error(err); }
    };

    const handleLogActivity = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/wellness/activity', {
                challengeId: activeChallenge._id,
                teamId: 'team1',
                date: new Date().toISOString().split('T')[0],
                ...activityForm
            });
            alert('Activity logged!');
            fetchLeaderboard(activeChallenge._id);
        } catch (err) { alert('Failed to log activity.'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Wellness" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FitnessCenterIcon className="text-green-500" /> Corporate Wellness Tracker
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <LeaderboardIcon /> Live Leaderboard
                        </h2>
                        <div className="space-y-3">
                            {leaderboard.map((team, i) => (
                                <div key={team.teamId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-100 dark:border-slate-700">
                                    <div className="flex items-center gap-4">
                                        <span className={`text-2xl font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-500'}`}>
                                            #{team.rank}
                                        </span>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{team.teamName}</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">{team.memberCount} members</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-brand-600">{team.totalScore.toLocaleString()} pts</p>
                                        {team.bonusAllocated > 0 && (
                                            <p className="text-xs font-semibold text-green-600 dark:text-green-400">₹{team.bonusAllocated.toLocaleString()} Bonus</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <EmojiEventsIcon /> Log Daily Activity
                        </h2>
                        {activeChallenge && (
                            <form onSubmit={handleLogActivity} className="space-y-4">
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <p className="text-sm font-bold text-green-800 dark:text-green-200">{activeChallenge.title}</p>
                                    <p className="text-xs text-green-700 dark:text-green-300">Tracking: {activeChallenge.type}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                        {activeChallenge.type} Count
                                    </label>
                                    <input
                                        type="number"
                                        value={activityForm.metricValue}
                                        onChange={e => setActivityForm({ ...activityForm, metricValue: Number(e.target.value) })}
                                        required
                                        className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Source</label>
                                    <select
                                        value={activityForm.source}
                                        onChange={e => setActivityForm({ ...activityForm, source: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                    >
                                        <option value="Manual">Manual Entry</option>
                                        <option value="Fitbit">Fitbit Sync</option>
                                        <option value="AppleHealth">Apple Health</option>
                                        <option value="GoogleFit">Google Fit</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg">
                                    Submit Activity
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
