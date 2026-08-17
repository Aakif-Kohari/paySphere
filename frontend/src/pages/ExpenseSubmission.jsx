import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const CATEGORIES = ['Travel', 'Meals', 'Lodging', 'Office Supplies', 'Software', 'Client Entertainment', 'Other'];

export default function ExpenseSubmission() {
    const [policy, setPolicy] = useState(null);
    const [formData, setFormData] = useState({
        category: 'Meals', amount: '', expenseDate: new Date().toISOString().split('T')[0], description: '', receiptUrl: ''
    });
    const [loading, setLoading] = useState(false);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [evaluation, setEvaluation] = useState(null);

    useEffect(() => { fetchPolicy(); }, []);

    const fetchPolicy = async () => {
        try {
            const res = await api.get('/api/expenses/policy');
            setPolicy(res.data.policy);
        } catch (err) { console.error(err); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setOcrProcessing(true);
        try {
            // Mock upload - in real app, upload to S3 and get URL
            const mockUrl = `mock://receipts/${file.name}`;
            setFormData({ ...formData, receiptUrl: mockUrl });

            // Submit to trigger OCR and policy check
            const res = await api.post('/api/expenses/claims', { ...formData, receiptUrl: mockUrl });
            setEvaluation(res.data.evaluation);
            alert('Receipt scanned and evaluated!');
        } catch (err) {
            alert('OCR processing failed.');
        } finally {
            setOcrProcessing(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/expenses/claims', formData);
            alert('Expense submitted successfully!');
            setFormData({ category: 'Meals', amount: '', expenseDate: new Date().toISOString().split('T')[0], description: '', receiptUrl: '' });
            setEvaluation(null);
        } catch (err) {
            alert(err.response?.data?.message || 'Submission failed.');
        } finally {
            setLoading(false);
        }
    };

    const activeRule = policy?.categories.find(c => c.category === formData.category);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Expenses" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ReceiptIcon /> Submit Expense
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Category</label>
                                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Amount ({policy?.currency || 'INR'})</label>
                                <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                {activeRule && <p className="text-xs text-gray-500 mt-1">Limit: {activeRule.maxLimitPerClaim}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Date</label>
                                <input type="date" value={formData.expenseDate} onChange={e => setFormData({ ...formData, expenseDate: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Description</label>
                                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Upload Receipt (OCR Enabled)</label>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                {ocrProcessing ? (
                                    <div className="flex items-center gap-2 text-brand-600">
                                        <div className="animate-spin h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full"></div>
                                        <span className="text-sm font-semibold">Scanning receipt...</span>
                                    </div>
                                ) : (
                                    <>
                                        <CloudUploadIcon className="text-gray-400 dark:text-slate-500" fontSize="large" />
                                        <span className="text-sm text-gray-500 dark:text-slate-400 mt-2">Click to upload image or PDF</span>
                                    </>
                                )}
                                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>

                        {evaluation && (
                            <div className={`p-4 rounded-lg border ${evaluation.isCompliant ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {evaluation.isCompliant ? <CheckCircleIcon className="text-green-600" /> : <ErrorIcon className="text-red-600" />}
                                    <span className={`font-bold ${evaluation.isCompliant ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                        Policy Evaluation
                                    </span>
                                </div>
                                {evaluation.violations.length > 0 && (
                                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                                        {evaluation.violations.map((v, i) => <li key={i}>{v}</li>)}
                                    </ul>
                                )}
                                {evaluation.isCompliant && <p className="text-sm text-green-700 dark:text-green-300">Compliant! Will be auto-approved if under threshold.</p>}
                            </div>
                        )}

                        <button type="submit" disabled={loading || ocrProcessing} className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg disabled:opacity-50">
                            {loading ? 'Submitting...' : 'Submit Expense'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
