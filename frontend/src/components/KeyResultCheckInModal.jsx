import { useState } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';
import CloseIcon from '@mui/icons-material/Close';

export default function KeyResultCheckInModal({ data, onClose, onSuccess }) {
    const [newValue, setNewValue] = useState(data.kr.currentValue);
    const [notes, setNotes] = useState('');
    const [blockedBy, setBlockedBy] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/okrs/check-in', {
                objectiveId: data.objectiveId,
                keyResultId: data.kr._id,
                newValue,
                notes,
                blockedBy
            });
            onSuccess();
        } catch (err) {
            alert('Failed to log check-in.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-slate-400">
                    <CloseIcon />
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Weekly Check-in</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">{data.objectiveTitle} • {data.kr.title}</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                            Current Value ({data.kr.unit})
                        </label>
                        <input
                            type="number"
                            value={newValue}
                            onChange={e => setNewValue(Number(e.target.value))}
                            required
                            className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">Target: {data.kr.targetValue} {data.kr.unit}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Progress Notes</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows="3"
                            placeholder="What did you achieve this week?"
                            className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Blocked By (Dependencies)</label>
                        <input
                            type="text"
                            value={blockedBy}
                            onChange={e => setBlockedBy(e.target.value)}
                            placeholder="e.g., Waiting on Marketing team for assets"
                            className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                        />
                    </div>

                    <button type="submit" disabled={loading} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg disabled:opacity-50">
                        {loading ? 'Updating...' : 'Log Progress'}
                    </button>
                </form>
            </div>
        </div>
    );
}

KeyResultCheckInModal.propTypes = {
    data: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired
};
