import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EcrGeneratorWizard from '../components/EcrGeneratorWizard';
import ChallanUploadModal from '../components/ChallanUploadModal';

export default function ComplianceVault() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [uploadTarget, setUploadTarget] = useState(null);

    useEffect(() => { fetchHistory(); }, []);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/api/statutory/vault');
            setHistory(res.data.history);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const getStatusBadge = (status) => {
        const styles = {
            'Generated': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            'Paid': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            'Failed Validation': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
            'Uploaded to Portal': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        };
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Compliance" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceIcon /> Statutory Compliance Vault (EPFO/ESIC)
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 space-y-6">
                    <div className="flex justify-end">
                        <button onClick={() => setShowWizard(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700">
                            Generate New ECR
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Month/Year</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Type</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total Challan</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                {loading ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading vault...</td></tr>
                                ) : history.length === 0 ? (
                                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No challans generated yet.</td></tr>
                                ) : (
                                    history.map(c => (
                                        <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.month}/{c.year}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300">{c.type}</td>
                                            <td className="px-6 py-4 text-sm text-right font-mono font-bold text-gray-900 dark:text-white">₹{c.totalChallanAmount.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-center">{getStatusBadge(c.status)}</td>
                                            <td className="px-6 py-4 text-center">
                                                {c.status !== 'Paid' && (
                                                    <button onClick={() => setUploadTarget(c)} className="text-xs font-semibold text-brand-600 hover:text-brand-800 dark:text-brand-400">
                                                        Upload Receipt
                                                    </button>
                                                )}
                                                {c.ecrFileUrl && (
                                                    <a href={c.ecrFileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-gray-600 dark:text-slate-400 ml-3">Download ECR</a>
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

            {showWizard && <EcrGeneratorWizard onClose={() => setShowWizard(false)} onSuccess={() => { setShowWizard(false); fetchHistory(); }} />}
            {uploadTarget && <ChallanUploadModal challan={uploadTarget} onClose={() => setUploadTarget(null)} onSuccess={() => { setUploadTarget(null); fetchHistory(); }} />}
        </div>
    );
}
