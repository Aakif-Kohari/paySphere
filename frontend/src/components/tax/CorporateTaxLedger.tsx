import React, { useState } from 'react';
import { CorporateObligation } from '../../services/tax/taxService';
import { FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface LedgerProps {
    obligations: CorporateObligation[];
}

export const CorporateTaxLedger: React.FC<LedgerProps> = ({ obligations }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = obligations.filter(obl =>
        obl.obligationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        obl.jurisdictionId.country.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PAID': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
            case 'OVERDUE': return <AlertTriangle className="w-5 h-5 text-rose-400" />;
            case 'FILED': return <FileText className="w-5 h-5 text-blue-400" />;
            case 'DISPUTED': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
            default: return <Clock className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            case 'OVERDUE': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
            case 'FILED': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            case 'DISPUTED': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
        }
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="p-6 border-b border-slate-700/50 bg-slate-900/20">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Global Obligation Ledger</h3>
                        <p className="text-slate-400 text-sm mt-1">Real-time consolidated corporate and payroll tax filing trail</p>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by ID or Country..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-64 p-2.5 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Obligation ID</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Jurisdiction</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Period</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Taxable Base</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Liability</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Outstanding</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filtered.slice(0, 20).map((obl) => (
                            <tr key={obl._id} className="hover:bg-slate-800/40 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-indigo-300">
                                    {obl.obligationId}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{obl.jurisdictionId.country}</div>
                                    <div className="text-xs text-slate-500">[{obl.jurisdictionId.jurisdictionCode}]</div>
                                </td>
                                <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                                    Q{Math.floor(new Date(obl.periodEnd).getMonth() / 3) + 1} {new Date(obl.periodEnd).getFullYear()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-medium text-slate-300">${obl.financialMetrics.netTaxableIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="font-semibold text-white">${obl.taxLiabilities.totalLiability.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {obl.taxLiabilities.outstandingBalance > 0 ? (
                                        <span className="text-amber-400 font-bold">${obl.taxLiabilities.outstandingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    ) : (
                                        <span className="text-emerald-400 font-medium">Clear</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center">
                                        <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${getStatusBg(obl.status)}`}>
                                            {getStatusIcon(obl.status)}
                                            {obl.status}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                        <FileText className="w-12 h-12 mb-3 opacity-20" />
                        <p>No tax obligations found matching the current search parameters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
