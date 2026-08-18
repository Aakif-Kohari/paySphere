import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import UndoIcon from '@mui/icons-material/Undo';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ClawbackScheduleModal from '../components/ClawbackScheduleModal';
import ReversalJournalPreview from '../components/ReversalJournalPreview';

export default function ReversalDashboard() {
    const [reversals, setReversals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedReversal, setSelectedReversal] = useState(null);

    useEffect(() => { fetchReversals(); }, []);

    const fetchReversals = async () => {
        try {
            const res = await api.get('/api/reversals');
            setReversals(res.data.reversals);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleApprove = async (id) => {
        if (!window.confirm('Approve this reversal and activate the clawback schedule?')) return;
        try {
            await api.patch(`/api/reversals/${id}/approve`);
            alert('Reversal approved!');
            fetchReversals();
        } catch (err) { alert('Failed to approve.'); }
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Pending Approval': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
            'Recovery Active': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            'Fully Recovered': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            'Cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Reversals" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <UndoIcon /> Payroll Reversal & Clawback Dashboard
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                        <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Payroll Block Guard Active</h3>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                Next month's payroll run will be automatically blocked if any reversals are in "Pending Approval" status.
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Original Payroll</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Net Overpaid</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading reversals...</td></tr>
                                ) : reversals.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No payroll reversals found.</td></tr>
                                ) : (
                                    reversals.map(rev => (
                                        <tr key={rev._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{rev.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{rev.originalPayrollId?.month}/{rev.originalPayrollId?.year}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-red-600 dark:text-red-400">₹{rev.netOverpaid.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(rev.status)}</td>
                                            <td className="px-6 py-4 text-center">
                                                {rev.status === 'Pending Approval' && (
                                                    <button onClick={() => handleApprove(rev._id)} className="text-xs font-semibold text-brand-600 hover:text-brand-800 dark:text-brand-400">
                                                        Approve & Activate
                                                    </button>
                                                )}
                                                {rev.status === 'Recovery Active' && (
                                                    <button onClick={() => { setSelectedReversal(rev); setShowModal(true); }} className="text-xs font-semibold text-gray-600 dark:text-slate-400">
                                                        View Schedule
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {selectedReversal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Clawback Schedule & Journals</h2>
                        <ReversalJournalPreview journalEntries={selectedReversal.journalEntries} />

                        <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 mt-6 mb-2">Recovery Schedule</h3>
                        <table className="min-w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Month/Year</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Deduction</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {selectedReversal.clawbackSchedule.map((s, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-2 text-gray-700 dark:text-slate-300">{s.month}/{s.year}</td>
                                        <td className="px-4 py-2 text-right font-mono text-gray-900 dark:text-white">₹{s.deductionAmount.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-center text-xs font-semibold text-amber-600">{s.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end mt-6">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-white rounded-lg font-semibold">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
