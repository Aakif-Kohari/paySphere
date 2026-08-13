/**
 * @fileoverview Client Invoicing & Forex Dashboard
 * @description Displays outstanding foreign receivables, realized forex gains/losses,
 * and provides a modal to record bank payments and trigger reconciliation.
 * Issue: #960
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import { formatCurrency } from '../utils/currency';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ReceiptIcon from '@mui/icons-material/Receipt';

export default function ClientInvoices() {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState({ openInvoices: [], totalOutstandingForeign: 0, totalRealizedGainLoss: 0 });
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState('Invoices');
    const currency = localStorage.getItem('currency') || 'INR';

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await api.get('/api/clients/invoices/dashboard');
                setDashboard(res.data);
            } catch (err) {
                console.error('Failed to fetch forex dashboard', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    const isGain = dashboard.totalRealizedGainLoss >= 0;

    return (
        <>
            <Helmet><title>Client Invoices & Forex Ledger | PaySphere</title></Helmet>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
                <Sidebar activePage={activePage} setActivePage={(p) => { setActivePage(p); navigate(`/${p.toLowerCase()}`); }} isSidebarOpen={false} onClose={() => { }} />

                <div className="lg:ml-64">
                    <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <AccountBalanceWalletIcon /> Multi-Currency Invoicing & Forex Ledger
                        </h1>
                        <ThemeToggle />
                    </div>

                    <div className="p-4 lg:p-8 space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Outstanding Receivables</p>
                                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                                    ${dashboard.totalOutstandingForeign.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Across all open foreign currency invoices</p>
                            </div>

                            <div className={`p-6 rounded-xl border shadow-sm ${isGain ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                <p className={`text-sm font-semibold uppercase tracking-wider ${isGain ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                    Realized Forex {isGain ? 'Gain' : 'Loss'} (YTD)
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    {isGain ? <TrendingUpIcon className="text-green-600" /> : <TrendingDownIcon className="text-red-600" />}
                                    <p className={`text-3xl font-bold ${isGain ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                        {formatCurrency(dashboard.totalRealizedGainLoss, currency)}
                                    </p>
                                </div>
                                <p className={`text-xs mt-1 ${isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Impact of currency fluctuations on realized payments
                                </p>
                            </div>
                        </div>

                        {/* Open Invoices Table */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Open Foreign Invoices</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Client</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Invoice #</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Foreign Amount</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Locked Rate</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">INR Equivalent</th>
                                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                        {loading ? (
                                            <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading receivables...</td></tr>
                                        ) : dashboard.openInvoices.length === 0 ? (
                                            <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No open foreign currency invoices.</td></tr>
                                        ) : (
                                            dashboard.openInvoices.map((inv) => (
                                                <tr key={inv._id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{inv.clientId?.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300 font-mono">{inv.invoiceNumber}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900 dark:text-white">
                                                        {inv.foreignCurrency} {inv.foreignAmount.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-slate-400">
                                                        1 {inv.foreignCurrency} = ₹{inv.exchangeRateAtInvoice}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900 dark:text-white">
                                                        {formatCurrency(inv.inrEquivalent, currency)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm font-semibold flex items-center gap-1 mx-auto">
                                                            <ReceiptIcon fontSize="small" /> Record Payment
                                                        </button>
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
            </div>
        </>
    );
}
