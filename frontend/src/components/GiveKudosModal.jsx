import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import StarsIcon from '@mui/icons-material/Stars';
import CloseIcon from '@mui/icons-material/Close';

export default function GiveKudosModal({ isOpen, onClose, myBalance }) {
    const [employees, setEmployees] = useState([]);
    const [receiverId, setReceiverId] = useState('');
    const [points, setPoints] = useState(10);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) fetchColleagues();
    }, [isOpen]);

    const fetchColleagues = async () => {
        try {
            const res = await api.get('/api/employees'); // Assuming standard employee list endpoint
            setEmployees(res.data.employees || []);
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!receiverId || points <= 0 || !message.trim()) return;
        setLoading(true);
        try {
            await api.post('/api/recognition/give', { receiverId, points, message, isPublic: true });
            alert('Kudos awarded successfully!');
            onClose(true); // Pass true to trigger feed refresh
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send Kudos.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6 relative">
                <button onClick={() => onClose(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white">
                    <CloseIcon />
                </button>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                        <StarsIcon className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Award Kudos</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">To:</label>
                        <select value={receiverId} onChange={e => setReceiverId(e.target.value)} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                            <option value="">Select a colleague...</option>
                            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.fullName}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            Points: <span className="text-amber-600">{points}</span> <span className="text-xs text-gray-500">(Available: {myBalance})</span>
                        </label>
                        <input type="range" min="1" max={myBalance} value={points} onChange={e => setPoints(Number(e.target.value))} className="w-full accent-amber-500" />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Message:</label>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} required maxLength={500} rows="3" placeholder="Thank you for helping with the deployment!" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                    </div>

                    <button type="submit" disabled={loading || points > myBalance} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg disabled:opacity-50 transition">
                        {loading ? 'Sending...' : 'Send Kudos'}
                    </button>
                </form>
            </div>
        </div>
    );
}

GiveKudosModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    myBalance: PropTypes.number.isRequired
};
