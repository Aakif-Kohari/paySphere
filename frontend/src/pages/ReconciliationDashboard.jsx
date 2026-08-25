import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReceiptIcon from '@mui/icons-material/Receipt';

export default function ReconciliationDashboard() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadTarget, setUploadTarget] = useState(null);
    const [receiptForm, setReceiptForm] = useState({ receiptUrl: '', notes: '', isPersonalSpend: false });

    useEffect(() => { fetchTransactions(); }, []);

    const fetchTransactions = async () => {
        try {
            const res = await api.get('/api/corporate-cards/my-transactions');
            setTransactions(res.data.transactions || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/corporate-cards/receipt', {
                transactionId: uploadTarget._id,
                ...receiptForm,
                receiptUrl: receiptForm.receiptUrl || `mock://receipts/${Date.now()}.pdf`
            });
            alert('Receipt uploaded!');
            setUploadTarget(null);
            fetchTransactions();
        } catch (err) { alert('Upload failed.'); }
    };

    const getStatusBadge = (tx) => {
        if (tx.isPersonalSpend) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Personal (Clawback)</span>;
        if (tx.status === 'Approved') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Approved</span>;
        if (tx.policyFlags.length > 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Policy Violation</span>;
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Pending Receipt</span>;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Expenses" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCardIcon className="text-brand-500" /> Corporate Card Reconciliation
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                        <WarningAmberIcon className="text-amber-600 dark:text-amber-400 mt-0.5" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            <strong>Action Required:</strong> Upload receipts for pending transactions within 7 days. Unreceipted or personal spend will be automatically deducted from your next payroll.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Merchant</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Amount</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading transactions...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No corporate card transactions found.</td></tr>
                                ) : (
                                    transactions.map(tx => (
                                        <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{tx.merchantName}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">${tx.amount.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(tx)}</td>
                                            <td className="px-6 py-4 text-center">
                                                {(tx.status === 'Pending Receipt' || tx.policyFlags.length > 0) && !tx.isPersonalSpend && (
                                                    <button onClick={() => setUploadTarget(tx)} className="text-xs font-bold text-brand-600 hover:text-brand-800 dark:text-brand-400 flex items-center gap-1 mx-auto">
                                                        <CloudUploadIcon fontSize="small" /> Upload
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

            {uploadTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upload Receipt</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                            {uploadTarget.merchantName} - ${uploadTarget.amount.toFixed(2)}
                        </p>
                        {uploadTarget.policyFlags.length > 0 && (
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                                <p className="text-xs text-red-700 dark:text-red-300 font-bold">Policy Flags: {uploadTarget.policyFlags.join(', ')}</p>
                            </div>
                        )}
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={receiptForm.isPersonalSpend} onChange={e => setReceiptForm({ ...receiptForm, isPersonalSpend: e.target.checked })} className="rounded text-red-600" id="personal" />
                                <label htmlFor="personal" className="text-sm text-gray-700 dark:text-slate-300">Mark as Personal Spend (Will be deducted from payroll)</label>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Notes / Business Purpose</label>
                                <textarea value={receiptForm.notes} onChange={e => setReceiptForm({ ...receiptForm, notes: e.target.value })} rows="2" className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setUploadTarget(null)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                    <ReceiptIcon fontSize="small" /> Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
