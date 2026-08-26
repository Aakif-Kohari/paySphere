import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function EscrowAdmin() {
    const [contracts, setContracts] = useState([]);
    const [selectedContract, setSelectedContract] = useState(null);
    const [ledger, setLedger] = useState([]);
    const [showFundModal, setShowFundModal] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchContracts(); }, []);

    const fetchContracts = async () => {
        try {
            const res = await api.get('/api/freelance/contracts');
            setContracts(res.data.contracts || []);
        } catch (err) { console.error(err); }
    };

    const fetchLedger = async (contractId) => {
        try {
            const res = await api.get(`/api/freelance/ledger/${contractId}`);
            setLedger(res.data.ledger || []);
        } catch (err) { console.error(err); }
    };

    const handleSelectContract = (contract) => {
        setSelectedContract(contract);
        fetchLedger(contract._id);
    };

    const handleFund = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/api/freelance/escrow/fund', { contractId: selectedContract._id, amount: Number(fundAmount) });
            alert('Escrow funded!');
            setShowFundModal(false);
            setFundAmount('');
            fetchContracts();
            fetchLedger(selectedContract._id);
        } catch (err) { alert(err.response?.data?.message || 'Funding failed.'); } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Freelance" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AccountBalanceWalletIcon /> Freelancer Escrow & Milestone Admin
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Active Contracts</h2>
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                            {contracts.map(c => (
                                <button key={c._id} onClick={() => handleSelectContract(c)} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{c.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">{c.contractorName} • {c.department}</p>
                                    <div className="flex justify-between mt-2 text-xs">
                                        <span className="text-brand-600 dark:text-brand-400 font-bold">Budget: ₹{c.totalBudget.toLocaleString()}</span>
                                        <span className={`px-1.5 py-0.5 rounded font-bold ${c.status === 'Funded' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'}`}>{c.status}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 min-h-[400px]">
                        {!selectedContract ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                                <AccountBalanceWalletIcon fontSize="large" />
                                <p className="mt-2 text-sm">Select a contract to manage escrow and milestones.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedContract.title}</h2>
                                        <p className="text-sm text-gray-500 dark:text-slate-400">{selectedContract.contractorName}</p>
                                    </div>
                                    <button onClick={() => setShowFundModal(true)} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center gap-2">
                                        <AddIcon fontSize="small" /> Fund Escrow
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-xs text-blue-800 dark:text-blue-200 font-bold uppercase">Total Budget</p>
                                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{selectedContract.totalBudget.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                        <p className="text-xs text-amber-800 dark:text-amber-200 font-bold uppercase">Locked in Escrow</p>
                                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">₹{selectedContract.lockedAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <p className="text-xs text-green-800 dark:text-green-200 font-bold uppercase">Released</p>
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">₹{selectedContract.releasedAmount.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-2">Escrow Ledger History</h3>
                                    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Date</th>
                                                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Type</th>
                                                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                                {ledger.map(l => (
                                                    <tr key={l._id}>
                                                        <td className="px-4 py-2 text-xs text-gray-700 dark:text-slate-300">{new Date(l.createdAt).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-xs font-medium text-gray-900 dark:text-white">{l.transactionType}</td>
                                                        <td className={`px-4 py-2 text-xs text-right font-mono font-bold ${l.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {l.amount > 0 ? '+' : ''}₹{l.amount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showFundModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Fund Escrow Account</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                            Remaining capacity: ₹{((selectedContract?.totalBudget || 0) - (selectedContract?.fundedAmount || 0)).toLocaleString()}
                        </p>
                        <form onSubmit={handleFund} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Funding Amount</label>
                                <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} required className="w-full px-3 py-2 rounded-lg border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowFundModal(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Lock Funds in Escrow'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
