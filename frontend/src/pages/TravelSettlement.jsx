import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ReceiptIcon from '@mui/icons-material/Receipt';

export default function TravelSettlement() {
    const [requestId, setRequestId] = useState('');
    const [receipts, setReceipts] = useState([{ category: 'Food', amount: 0, description: '' }]);
    const [loading, setLoading] = useState(false);

    const addReceipt = () => setReceipts([...receipts, { category: 'Transport', amount: 0, description: '' }]);
    const updateReceipt = (idx, field, val) => {
        const newRec = [...receipts];
        newRec[idx][field] = val;
        setReceipts(newRec);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!requestId) return alert('Enter Request ID');
        setLoading(true);
        try {
            await api.post('/api/travel/settle', { requestId, expenseReceipts: receipts });
            alert('Settlement submitted!');
            setReceipts([{ category: 'Food', amount: 0, description: '' }]);
        } catch (err) { alert('Submission failed.'); } finally { setLoading(false); }
    };

    const totalActuals = receipts.reduce((sum, r) => sum + Number(r.amount), 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Settlement" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ReceiptIcon /> Post-Trip Settlement
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Travel Request ID</label>
                            <input type="text" value={requestId} onChange={e => setRequestId(e.target.value)} placeholder="Enter ID from Travel Desk" required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Expense Receipts</h3>
                            {receipts.map((r, i) => (
                                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                    <select value={r.category} onChange={e => updateReceipt(i, 'category', e.target.value)} className="col-span-3 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm">
                                        <option>Food</option><option>Transport</option><option>Hotel</option><option>Other</option>
                                    </select>
                                    <input type="number" placeholder="Amount" value={r.amount} onChange={e => updateReceipt(i, 'amount', e.target.value)} className="col-span-3 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                    <input type="text" placeholder="Description" value={r.description} onChange={e => updateReceipt(i, 'description', e.target.value)} className="col-span-6 px-2 py-1 rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white text-sm" />
                                </div>
                            ))}
                            <button type="button" onClick={addReceipt} className="text-xs text-brand-600 font-bold hover:underline">+ Add Expense</button>
                        </div>

                        <div className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 flex justify-between">
                            <span className="text-sm font-bold text-gray-700 dark:text-slate-300">Total Actual Expenses:</span>
                            <span className="text-sm font-bold text-brand-600">₹{totalActuals.toLocaleString()}</span>
                        </div>

                        <button type="submit" disabled={loading} className="w-full py-3 bg-brand-600 text-white font-bold rounded-lg disabled:opacity-50">
                            {loading ? 'Submitting...' : 'Submit Settlement'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
