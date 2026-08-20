/**
 * @fileoverview Celebration Dashboard Widget
 * @description A visually engaging component for the main dashboard that displays 
 * today's birthdays and work anniversaries, complete with confetti animations 
 * and reaction buttons.
 * Issue: #1286
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import CakeIcon from '@mui/icons-material/Cake';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

/**
 * CelebrationWidget Component
 * @param {Object} props 
 * @param {string} props.className - Additional Tailwind classes
 */
export default function CelebrationWidget({ className = '' }) {
    const [celebrations, setCelebrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reactingId, setReactingId] = useState(null);

    useEffect(() => {
        fetchCelebrations();
    }, []);

    const fetchCelebrations = async () => {
        try {
            const res = await api.get('/api/celebrations/today');
            setCelebrations(res.data.celebrations || []);
        } catch (err) {
            console.error('Failed to fetch celebrations:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReact = async (id) => {
        setReactingId(id);
        try {
            const res = await api.post(`/api/celebrations/${id}/react`);
            // Update local state optimistically
            setCelebrations(prev => prev.map(c =>
                c._id === id ? { ...c, reactionCount: res.data.reactionCount } : c
            ));
        } catch (err) {
            console.error('Failed to react:', err);
        } finally {
            setReactingId(null);
        }
    };

    if (loading) {
        return (
            <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm animate-pulse ${className}`}>
                <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 bg-gray-100 dark:bg-slate-700 rounded-lg"></div>
                    <div className="h-16 bg-gray-100 dark:bg-slate-700 rounded-lg"></div>
                </div>
            </div>
        );
    }

    if (celebrations.length === 0) {
        return (
            <div className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm ${className}`}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AutoAwesomeIcon className="text-amber-500" /> Today's Celebrations
                </h3>
                <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-slate-400 text-sm">No birthdays or work anniversaries today. Check back tomorrow!</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 p-6 rounded-2xl border border-purple-100 dark:border-slate-700 shadow-sm ${className}`}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <AutoAwesomeIcon className="text-purple-600 dark:text-purple-400" /> Today's Celebrations
            </h3>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {celebrations.map((item) => {
                    const isBirthday = item.type === 'Birthday';
                    const Icon = isBirthday ? CakeIcon : CelebrationIcon;
                    const iconColor = isBirthday ? 'text-pink-500' : 'text-blue-500';
                    const bgColor = isBirthday ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-blue-100 dark:bg-blue-900/30';

                    return (
                        <div
                            key={item._id}
                            className="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center gap-4 hover:shadow-md transition-shadow"
                        >
                            {/* Avatar / Icon */}
                            <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
                                {item.employeeId?.profilePicture ? (
                                    <img src={item.employeeId.profilePicture} alt={item.employeeId.fullName} className="w-12 h-12 rounded-full object-cover" />
                                ) : (
                                    <Icon className={iconColor} fontSize="medium" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {item.employeeId?.fullName || 'Unknown Employee'}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                                    {item.message}
                                </p>
                                {item.type === 'WorkAnniversary' && item.milestoneYears && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-full">
                                        {item.milestoneYears} {item.milestoneYears === 1 ? 'Year' : 'Years'}
                                    </span>
                                )}
                            </div>

                            {/* Reaction Button */}
                            <button
                                onClick={() => handleReact(item._id)}
                                disabled={reactingId === item._id}
                                className={`
                  flex flex-col items-center justify-center p-2 rounded-lg transition-all
                  ${reactingId === item._id ? 'animate-pulse' : 'hover:bg-pink-50 dark:hover:bg-pink-900/20'}
                  focus:outline-none focus:ring-2 focus:ring-pink-500
                `}
                                aria-label="Send love"
                            >
                                <FavoriteIcon className={`text-pink-500 ${reactingId === item._id ? 'scale-125' : ''} transition-transform`} fontSize="small" />
                                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 mt-0.5">
                                    {item.reactionCount}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

CelebrationWidget.propTypes = {
    className: PropTypes.string
};
