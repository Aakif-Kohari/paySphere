import React, { useState, useEffect } from 'react';
import {
    FileText, Search, DownloadCloud, Activity, LayoutGrid,
    ArrowUpRight, ArrowDownRight, RefreshCcw, Filter
} from 'lucide-react';
import treasuryService from '../../services/treasury/treasuryService';

const TreasuryLedgerGrid: React.FC = () => {
    const [ledger, setLedger] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchLedger();
    }, [page]);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const resp = await treasuryService.getTradeLedger(page);
            setLedger(resp?.data?.data || []);
            setTotalPages(resp?.data?.metadata?.totalPages || 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLedger = ledger.filter(trade =>
        trade.tradeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.sourceCurrency.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.targetCurrency.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 flex flex-col h-[700px]">

            {/* Header & Controls */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    <FileText className="text-indigo-500" /> Historical Trade Ledger
                </h3>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by ID or Currency..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors">
                        <DownloadCloud className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Grid Layout Container */}
            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/50 relative">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-6 py-4 text-xs tracking-wider font-bold text-slate-500 uppercase">Trade ID</th>
                            <th className="px-6 py-4 text-xs tracking-wider font-bold text-slate-500 uppercase">Timestamp</th>
                            <th className="px-6 py-4 text-xs tracking-wider font-bold text-slate-500 uppercase">Source Leg</th>
                            <th className="px-6 py-4 text-xs tracking-wider font-bold text-slate-500 uppercase">Target Leg</th>
                            <th className="px-6 py-4 text-xs tracking-wider font-bold text-slate-500 uppercase">Execution Rate</th>
                            <th className="px-6 py-4 text-xs tracking-wider font-bold text-slate-500 uppercase text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={6} className="px-6 py-4"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-full"></div></td>
                                </tr>
                            ))
                        ) : filteredLedger.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium bg-white dark:bg-slate-800">
                                    <LayoutGrid className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                                    No forensic trade records found.
                                </td>
                            </tr>
                        ) : (
                            filteredLedger.map((trade) => (
                                <tr key={trade._id} className="hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {trade.tradeId}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(trade.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1 bg-red-100 text-red-600 rounded"><ArrowUpRight className="w-3 h-3" /></span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{trade.amountSold.toLocaleString()} {trade.sourceCurrency}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className="p-1 bg-emerald-100 text-emerald-600 rounded"><ArrowDownRight className="w-3 h-3" /></span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{trade.amountBought.toLocaleString(undefined, { maximumFractionDigits: 2 })} {trade.targetCurrency}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 group-hover:bg-transparent transition-colors">
                                        1 {trade.sourceCurrency} = {trade.exchangeRate.toFixed(4)} {trade.targetCurrency}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full ${trade.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                trade.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                            {trade.status === 'SETTLED' ? <CheckCircle className="w-3 h-3" /> : <RefreshCcw className={`w-3 h-3 ${trade.status === 'PENDING' ? 'animate-spin' : ''}`} />}
                                            {trade.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                <span className="text-sm font-semibold text-slate-500">Retrieving Page {page} of {totalPages} (Enterprise Core API)</span>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-200 transition-colors text-sm font-bold"
                    >
                        Previous
                    </button>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                        className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-50 hover:bg-slate-200 transition-colors text-sm font-bold"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TreasuryLedgerGrid;
