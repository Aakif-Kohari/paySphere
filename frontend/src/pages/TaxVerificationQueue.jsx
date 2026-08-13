import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export default function TaxVerificationQueue() {
    const [proofs, setProofs] = useState([]);
    const [loading, setLoading] = useState(true);
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => { fetchQueue(); }, []);

    const fetchQueue = async () => {
        try {
            const res = await api.get('/api/tax-proofs/queue?status=Submitted');
            setProofs(res.data.proofs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleVerify = async (id, status) => {
        const approvedAmount = status === 'Approved' ? proofs.find(p => p._id === id)?.claimedAmount : 0;
        try {
            await api.patch(`/api/tax-proofs/${id}/verify`, { status, approvedAmount, remarks: status === 'Approved' ? 'Verified' : 'Invalid proof' });
            fetchQueue();
        } catch (err) { alert('Failed to verify'); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Tax Verification" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <VerifiedUserIcon /> HR Tax Verification Queue
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Section</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Claimed</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Receipts</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading queue...</td></tr>
                                ) : proofs.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No pending proofs to verify.</td></tr>
                                ) : (
                                    proofs.map(p => (
                                        <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{p.employeeId?.fullName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{p.sectionType}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{formatCurrency(p.claimedAmount, currency)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <a href={p.receiptUrls[0]} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-sm">View Receipt</a>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleVerify(p._id, 'Approved')} className="p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200" title="Approve">
                                                        <CheckIcon fontSize="small" />
                                                    </button>
                                                    <button onClick={() => handleVerify(p._id, 'Rejected')} className="p-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200" title="Reject">
                                                        <CloseIcon fontSize="small" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
