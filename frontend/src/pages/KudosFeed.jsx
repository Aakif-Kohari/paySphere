import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import StarsIcon from '@mui/icons-material/Stars';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GiveKudosModal from '../components/GiveKudosModal';

export default function KudosFeed() {
    const [feed, setFeed] = useState([]);
    const [balance, setBalance] = useState({ availablePoints: 0 });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [feedRes, balRes] = await Promise.all([
                api.get('/api/recognition/feed'),
                api.get('/api/recognition/balance')
            ]);
            setFeed(feedRes.data.feed);
            setBalance(balRes.data.balance);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleModalClose = (refresh) => {
        setModalOpen(false);
        if (refresh) fetchData();
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Kudos" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <StarsIcon className="text-amber-500" /> Kudos Recognition Feed
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 rounded-2xl shadow-lg text-white flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold opacity-90">Your Available Kudos</p>
                            <p className="text-4xl font-bold mt-1">{balance.availablePoints}</p>
                        </div>
                        <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-white text-amber-600 font-bold rounded-lg hover:bg-gray-100 transition flex items-center gap-2 shadow-md">
                            <AddCircleOutlineIcon /> Give Kudos
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-center text-gray-500 py-12">Loading feed...</p>
                    ) : feed.length === 0 ? (
                        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                            <p className="text-gray-500 dark:text-slate-400">No recognition yet. Be the first to award Kudos!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {feed.map(item => (
                                <div key={item._id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold">
                                            {item.senderId?.fullName?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-900 dark:text-white">
                                                <span className="font-bold">{item.senderId?.fullName}</span> awarded <span className="font-bold text-amber-600">{item.points} Kudos</span> to <span className="font-bold">{item.receiverId?.fullName}</span>
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-slate-300 italic bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg border-l-4 border-amber-500">
                                        "{item.message}"
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <GiveKudosModal isOpen={modalOpen} onClose={handleModalClose} myBalance={balance.availablePoints} />
        </div>
    );
}
