import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

const SECTIONS = ['80C', '80D', '80CCD(1B)', '80E', '80G', 'HRA', 'LTA', 'Home Loan Interest', 'Other'];

export default function TaxProofPortal() {
    const [proofs, setProofs] = useState([]);
    const [aggregated, setAggregated] = useState({ totalApproved: 0 });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ sectionType: '80C', claimedAmount: '', financialYear: 2024 });
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/tax-proofs/my-proofs');
            setProofs(res.data.proofs);
            setAggregated(res.data.aggregated);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/tax-proofs', { ...formData, receiptUrls: ['mock_url.pdf'] });
            setShowForm(false);
            fetchData();
        } catch (err) { alert(err.response?.data?.message || 'Failed to submit'); }
    };

    const getStatusIcon = (status) => {
        if (status === 'Approved') return <CheckCircleIcon className="text-green-500" fontSize="small" />;
        if (status === 'Rejected') return <CancelIcon className="text-red-500" fontSize="small" />;
        return <HourglassEmptyIcon className="text-amber-500" fontSize="small" />;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Tax Proofs" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ReceiptIcon /> Tax Proof Submission (Form 12BB)
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-brand-800 dark:text-brand-200">Total Approved Deductions (FY 2024-25)</h3>
                            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{formatCurrency(aggregated.totalApproved, currency)}</p>
                        </div>
                        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                            <CloudUploadIcon fontSize="small" /> Upload New Proof
                        </button>
                    </div>

                    {showForm && (
                        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Section Type</label>
                                    <select value={formData.sectionType} onChange={e => setFormData({ ...formData, sectionType: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                                        {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Claimed Amount</label>
                                    <input type="number" value={formData.claimedAmount} onChange={e => setFormData({ ...formData, claimedAmount: e.target.value })} required className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">Submit Proof</button>
                            </div>
                        </form>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Section</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Claimed</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Approved</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {proofs.map(p => (
                                    <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{p.sectionType}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-700 dark:text-slate-300">{formatCurrency(p.claimedAmount, currency)}</td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-gray-900 dark:text-white">{formatCurrency(p.approvedAmount, currency)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold">
                                                {getStatusIcon(p.status)} {p.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">{p.remarks || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
