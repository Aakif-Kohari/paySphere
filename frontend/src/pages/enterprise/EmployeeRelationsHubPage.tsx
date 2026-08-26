import React, { useState, useMemo, useEffect } from 'react';
import {
    AlertOctagon, Scale, Clock, ShieldAlert, FileText, CheckCircle, XCircle, Search, AlertCircle
} from 'lucide-react';
import type { ERCase, DisciplinaryAction, EmployeeRelationsKPIs } from '../../types/employeeRelations';
import { generateERCases, generateDisciplinaryActions, computeERKpis } from '../../services/employeeRelationsService';

const fmtCurrency = (n: number) => `$${n.toLocaleString()}`;

function RiskBadge({ risk }: { risk: string }) {
    const styles: any = {
        'LOW': 'bg-gray-100 text-gray-700',
        'MEDIUM': 'bg-yellow-100 text-yellow-700',
        'HIGH': 'bg-orange-100 text-orange-700',
        'LITIGATION_IMMINENT': 'bg-red-600 text-white animate-pulse'
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles[risk]}`}>{risk.replace(/_/g, ' ')}</span>;
}

function StatusBadge({ status }: { status: string }) {
    const isClosed = status.startsWith('CLOSED');
    return (
        <span className={`px-2 py-1 rounded text-xs font-bold ${isClosed ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
}

function ActionBadge({ type }: { type: string }) {
    const styles: any = {
        'VERBAL_WARNING': 'text-gray-600 bg-gray-100',
        'WRITTEN_WARNING': 'text-yellow-700 bg-yellow-100',
        'PIP': 'text-orange-700 bg-orange-100',
        'SUSPENSION': 'text-red-700 bg-red-100',
        'TERMINATION_WITH_CAUSE': 'text-white bg-red-600',
    };
    return <span className={`px-2 py-1 rounded text-xs font-bold ${styles[type]}`}>{type.replace(/_/g, ' ')}</span>;
}

export default function EmployeeRelationsHubPage() {
    const [tab, setTab] = useState<'cases' | 'disciplinary'>('cases');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const cases = useMemo(() => generateERCases(50), []);
    const actions = useMemo(() => generateDisciplinaryActions(30), []);
    const kpis = useMemo(() => computeERKpis(cases), [cases]);

    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(t);
    }, []);

    const filteredCases = useMemo(() => cases.filter(c =>
        c.caseId.toLowerCase().includes(search.toLowerCase()) ||
        c.reporterName.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase())
    ), [cases, search]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-3 text-gray-500 font-bold">
                    <Scale size={32} className="animate-bounce text-indigo-500" />
                    <p>Loading Employee Relations Docket...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <div className="bg-slate-900 px-6 py-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <Scale className="text-red-500" size={32} /> Employee Relations & Grievance Arbitration Hub
                    </h1>
                    <p className="text-slate-400 mt-2">Manage confidential grievances, monitor litigation exposure, and enforce SLA on HR investigations.</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                    <p className="text-xs uppercase font-bold text-slate-400 mb-1">Total Estimated Legal Exposure</p>
                    <p className="text-3xl font-extrabold text-red-500">{fmtCurrency(kpis.totalEstimatedExposure)}</p>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex justify-between items-center text-gray-500 mb-2">
                            <span className="text-xs uppercase font-bold">Active Cases</span>
                            <FileText size={18} />
                        </div>
                        <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{kpis.activeCasesTotal}</p>
                    </div>

                    <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-xl border border-orange-200 dark:border-orange-900/30">
                        <div className="flex justify-between items-center text-orange-600 mb-2">
                            <span className="text-xs uppercase font-bold">SLA Breaches (&gt;30 Days)</span>
                            <Clock className="animate-spin-slow" size={18} />
                        </div>
                        <p className="text-2xl font-extrabold text-orange-700">{kpis.casesBreachingSLA}</p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-200 dark:border-red-900/30">
                        <div className="flex justify-between items-center text-red-600 mb-2">
                            <span className="text-xs uppercase font-bold">Litigation Imminent</span>
                            <AlertOctagon className="animate-pulse" size={18} />
                        </div>
                        <p className="text-2xl font-extrabold text-red-700">{kpis.litigationRiskCount}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex justify-between items-center text-gray-500 mb-2">
                            <span className="text-xs uppercase font-bold">Avg Resolution Time</span>
                            <CheckCircle size={18} />
                        </div>
                        <p className="text-2xl font-extrabold text-indigo-600">{kpis.averageResolutionDays} Days</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-gray-200 dark:border-slate-800 pb-2 flex-wrap">
                    <button onClick={() => setTab('cases')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg ${tab === 'cases' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500'}`}>
                        <Scale size={16} /> ER Case Ledger
                    </button>
                    <button onClick={() => setTab('disciplinary')} className={`font-bold px-4 py-2 flex gap-2 items-center rounded-lg ${tab === 'disciplinary' ? 'bg-white dark:bg-slate-800 shadow text-indigo-600' : 'text-gray-500'}`}>
                        <ShieldAlert size={16} /> Disciplinary Actions & PIPs
                    </button>
                </div>

                {/* Content */}
                {tab === 'cases' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-gray-900 dark:text-white">Active Grievance & Investigation Docket</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search cases..."
                                    className="pl-9 pr-4 py-1.5 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Case ID & Date</th>
                                        <th className="px-6 py-4">Category & Risk</th>
                                        <th className="px-6 py-4">Parties Involved</th>
                                        <th className="px-6 py-4">Status & SLA</th>
                                        <th className="px-6 py-4 text-right">Est. Exposure</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {filteredCases.slice(0, 30).map(c => (
                                        <tr key={c.caseId} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4">
                                                <p className="font-extrabold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">{c.caseId}</p>
                                                <p className="text-xs text-gray-500 mt-1">{c.filingDate}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-gray-700 dark:text-gray-300 mb-1">{c.category.replace(/_/g, ' ')}</p>
                                                <RiskBadge risk={c.severity} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm"><span className="text-gray-500 text-xs">Reporter:</span> <span className="font-semibold">{c.reporterName}</span></p>
                                                {c.accusedName && <p className="text-sm mt-0.5"><span className="text-gray-500 text-xs">Accused:</span> <span className="font-semibold">{c.accusedName}</span></p>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="mb-2"><StatusBadge status={c.status} /></div>
                                                {c.slaBreached ? (
                                                    <span className="flex items-center gap-1 text-xs text-red-600 font-bold"><AlertCircle size={12} /> SLA Breached ({c.daysOpen} d)</span>
                                                ) : (
                                                    <span className="text-xs text-gray-500">{c.daysOpen} Days Open</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {c.estimatedLegalExposure > 0 ? (
                                                    <span className="font-extrabold text-red-600">{fmtCurrency(c.estimatedLegalExposure)}</span>
                                                ) : (
                                                    <span className="text-gray-400 font-semibold">$0</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'disciplinary' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm p-4">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">Recent Disciplinary Actions & PIPs</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {actions.map(a => (
                                <div key={a.actionId} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-extrabold text-gray-900 dark:text-white">{a.employeeName}</p>
                                            <p className="text-xs text-gray-500">{a.department} · Issued {a.dateIssued}</p>
                                        </div>
                                        <ActionBadge type={a.type} />
                                    </div>
                                    <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center text-xs">
                                        <div>
                                            <p className="text-gray-500 uppercase font-bold mb-0.5">Appeal Status</p>
                                            <p className={`font-semibold ${a.appealStatus === 'OVERTURNED' ? 'text-green-600' : a.appealStatus === 'UPHELD' ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>{a.appealStatus.replace(/_/g, ' ')}</p>
                                        </div>
                                        {a.relatedCaseId && (
                                            <div className="text-right">
                                                <p className="text-gray-500 uppercase font-bold mb-0.5">Linked ER Case</p>
                                                <p className="font-semibold text-indigo-500 hover:underline cursor-pointer">{a.relatedCaseId}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
