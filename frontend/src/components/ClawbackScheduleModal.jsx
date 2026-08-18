import { useState } from 'react';
import PropTypes from 'prop-types';
import ScheduleIcon from '@mui/icons-material/Schedule';

export default function ClawbackScheduleModal({ isOpen, onClose, netOverpaid, onConfirm }) {
    const [recoveryMonths, setRecoveryMonths] = useState(1);
    const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
    const [startYear, setStartYear] = useState(new Date().getFullYear());

    if (!isOpen) return null;

    const monthlyDeduction = (netOverpaid / recoveryMonths).toFixed(2);

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm({ recoveryMonths, startMonth, startYear });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                    <ScheduleIcon className="text-amber-500" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configure Clawback Schedule</h2>
                </div>

                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    Total Net Overpaid: <span className="font-bold text-red-600">₹{netOverpaid.toLocaleString()}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Recover Over (Months)</label>
                        <input type="number" min="1" max="12" value={recoveryMonths} onChange={e => setRecoveryMonths(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        <p className="text-xs text-gray-500 mt-1">Estimated monthly deduction: ₹{monthlyDeduction}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Start Month</label>
                            <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Start Year</label>
                            <input type="number" value={startYear} onChange={e => setStartYear(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700">Generate Schedule</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

ClawbackScheduleModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    netOverpaid: PropTypes.number.isRequired,
    onConfirm: PropTypes.func.isRequired
};
