import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function RelocationTracker() {
    const [requests, setRequests] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [grossUps, setGrossUps] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    const [reqForm, setReqForm] = useState({ originCity: '', destinationCity: '', relocationDate: '', approvedBudget: 0 });
    const [expForm, setExpForm] = useState({ category: 'Moving Services', amount: '', description: '' });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/relocation/my-requests');
            setRequests(res.data.requests || []);
            setExpenses(res.data.expenses || []);
            setGrossUps(res.data.grossUps || []);
        } catch (err) { console.error(err); }
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/relocation/request', reqForm);
            alert('Request submitted!');
            setShowForm(false);
            fetchData();
        } catch (err) { alert('Failed to submit request.'); }
    };

    const handleUploadExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/relocation/expense', {
                requestId: selectedRequest._id,
                ...expForm,
                receiptUrl: `mock://receipts/${Date.now()}.pdf`
            });
            alert('Expense uploaded!');
            setShowExpenseForm(false);
            fetchData();
        } catch (err) { alert('Failed to upload expense.'); }
    };

    const getGrossUpForRequest = (reqId) => grossUps.find(g => g.requestId === reqId);
    const getExpensesForRequest = (reqId) => expenses.filter(e => e.requestId === reqId);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Relocation" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FlightTakeoffIcon /> Corporate Relocation Tracker
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end">
                        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">
                            New Relocation Request
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {requests.map(req => {
                            const reqExpenses = getExpensesForRequest(req._id);
                            const reqGrossUp = getGrossUpForRequest(req._id);
                            const totalSpent = reqExpenses.reduce((sum, e) => sum + e.amount, 0);

                            return (
                                <div key={req._id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{req.originCity} ✈️ {req.destinationCity}</h3>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">Moving on: {new Date(req.relocationDate).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${req.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                            {req.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                                        <div>
                                            <p className="text-gray-500 dark:text-slate-400">Budget</p>
                                            <p className="font-bold text-gray-900 dark:text-white">₹{req.approvedBudget.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-slate-400">Spent</p>
                                            <p className={`font-bold ${totalSpent > req.approvedBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>₹{totalSpent.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {reqGrossUp && (
                                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg mb-4">
                                            <p className="text-xs font-bold text-purple-800 dark:text-purple-200 uppercase mb-1">Tax Gross-Up Impact</p>
                                            <p className="text-sm text-purple-700 dark:text-purple-300">
                                                To cover the tax on ₹{reqGrossUp.totalTaxableExpenses.toLocaleString()} of taxable benefits, an additional <strong>₹{reqGrossUp.grossUpAmount.toLocaleString()}</strong> gross-up bonus will be added to your payroll.
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button onClick={() => { setSelectedRequest(req); setShowExpenseForm(true); }} className="flex-1 py-2 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-white rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1">
                                            <CloudUploadIcon fontSize="small" /> Upload Receipt
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Request Relocation</h2>
                        <form onSubmit={handleCreateRequest} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Origin City</label>
                                    <input type="text" value={reqForm.originCity} onChange={e => setReqForm({ ...reqForm, originCity: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Destination</label>
                                    <input type="text" value={reqForm.destinationCity} onChange={e => setReqForm({ ...reqForm, destinationCity: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Relocation Date</label>
                                <input type="date" value={reqForm.relocationDate} onChange={e => setReqForm({ ...reqForm, relocationDate: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Submit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showExpenseForm && selectedRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Upload Relocation Receipt</h2>
                        <form onSubmit={handleUploadExpense} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Category</label>
                                <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    <option>Moving Services</option>
                                    <option>Temporary Housing</option>
                                    <option>Travel</option>
                                    <option>Brokerage</option>
                                    <option>Miscellaneous</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Amount</label>
                                <input type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: Number(e.target.value) })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Receipt File (Mock)</label>
                                <div className="w-full h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center text-gray-400 dark:text-slate-500">
                                    <ReceiptIcon fontSize="large" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowExpenseForm(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">Upload & Process</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
