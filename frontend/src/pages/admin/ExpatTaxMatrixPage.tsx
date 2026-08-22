import { useState, useEffect } from 'react';
import { expatTaxAPI } from '../../services/admin/expatTaxService';
import GlobalMobilityMap from '../../components/admin/GlobalMobilityMap';
import ExpatRelocationLog from '../../components/admin/ExpatRelocationLog';
import { Globe2, PlaneLanding, Fingerprint, Database, MapPin, Receipt, Navigation, Hash } from 'lucide-react';

export default function ExpatTaxMatrixPage() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [highCostList, setHighCostList] = useState<any[]>([]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const [sumRes, highRes] = await Promise.all([
                expatTaxAPI.getMobilitySummary(),
                expatTaxAPI.getHighCostAssignments(50)
            ]);
            setSummary(sumRes.data?.data);
            setHighCostList(highRes.data?.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    const handleSeed = async () => {
        setLoading(true);
        await expatTaxAPI.seedDemoData();
        fetchAssets();
    };

    return (
        <div className="min-h-screen bg-[#050914] text-gray-200">

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#02040b]/80 backdrop-blur-2xl border-b border-indigo-900/50 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-2xl gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-tr from-teal-500 via-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-400/20">
                        <Globe2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            Global Mobility matrix
                            <span className="bg-cyan-500/10 text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 font-black tracking-widest uppercase shadow-inner">EXPAT RELOCATION</span>
                        </h1>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">Enterprise Equalization & Disparity Modeler</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={handleSeed} className="bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 px-4 py-2 rounded-lg text-xs font-bold uppercase transition flex items-center gap-2 shadow-lg">
                        <Database className="h-4 w-4" /> Reset Global State
                    </button>
                </div>
            </header>

            <div className="max-w-[1550px] mx-auto p-6 space-y-6">

                {/* KPI Ribbons */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                        <div className="bg-gradient-to-b from-gray-900 to-black border border-gray-800 rounded-2xl p-5 shadow-2xl group flex flex-col justify-between">
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-2">
                                <PlaneLanding className="h-3 w-3 text-cyan-500" /> Active Assignees
                            </p>
                            <h3 className="text-4xl font-black text-white group-hover:scale-105 transition-transform origin-left">
                                {summary.totalActiveExpats.toLocaleString()}
                            </h3>
                        </div>

                        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1 relative z-10 flex items-center gap-2">
                                <Receipt className="h-3 w-3 text-red-500" /> Global Tax Liability
                            </p>
                            <h3 className="text-3xl font-black text-red-400 relative z-10 break-all font-mono">
                                ${(summary.aggregateTaxEqualizationLiability / 1000).toFixed(0)}k
                            </h3>
                            <p className="text-[10px] text-red-500/70 mt-1 font-bold">Unburdened disparity cost</p>
                        </div>

                        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1 flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-teal-500" /> Relocation spend
                            </p>
                            <h3 className="text-3xl font-black text-emerald-400 font-mono">
                                ${(summary.aggregateRelocationBudgets / 1000).toFixed(0)}k
                            </h3>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-950/80 to-blue-950/80 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl">
                            <p className="text-[10px] font-black uppercase text-indigo-300/80 tracking-widest mb-1">Total Package Run-rate</p>
                            <h3 className="text-4xl font-black text-white mt-1 font-mono">
                                ${(summary.aggregateTotalCost / 1000000).toFixed(2)}M
                            </h3>
                        </div>
                    </div>
                )}

                <GlobalMobilityMap corridors={summary?.corridorTopology || []} loading={loading} />

                <div className="bg-[#0b1021] border border-indigo-900/30 rounded-3xl p-6 shadow-2xl flex flex-col h-[550px] relative overflow-hidden">

                    <div className="absolute top-0 right-1/4 w-[800px] h-[300px] bg-cyan-500/5 blur-[120px] rounded-[100%] pointer-events-none transform -translate-y-1/2"></div>

                    <div className="relative z-10 flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-3">
                            <Fingerprint className="text-cyan-500 h-6 w-6" />
                            High-Cost Mobility Triggers
                        </h3>
                        <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded shadow-inner uppercase tracking-widest">
                            Top {highCostList.length} highest liability assets
                        </span>
                    </div>

                    <div className="relative z-10 flex-1 overflow-auto rounded-2xl border border-gray-800/80 shadow-inner bg-black/40">

                        {/* Dynamic Table Layout for massive enterprise data */}
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#0f152b] sticky top-0 border-b border-indigo-900/50 shadow-md">
                                <tr>
                                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-500">Assignee</th>
                                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-500">Route</th>
                                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-500">Tax Type</th>
                                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-gray-500 text-right">Tax Rates (HM vs HO)</th>
                                    <th className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-rose-500 text-right">C-Liability</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {highCostList.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center text-gray-500 text-sm font-medium h-[200px]">
                                            <Navigation className="h-10 w-10 mx-auto opacity-20 mb-3" />
                                            No critical assignments mapped.
                                        </td>
                                    </tr>
                                ) : (
                                    highCostList.map(a => (
                                        <tr key={a.assignmentId} className="hover:bg-indigo-950/20 transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                                                        <Hash className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-200 text-sm group-hover:text-cyan-400 transition-colors">{a.assignmentId}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-wider">{a.department}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded border border-gray-700">{a.homeCountry.substring(0, 3).toUpperCase()}</span>
                                                    <PlaneLanding className="h-3 w-3 text-gray-600" />
                                                    <span className="bg-indigo-900/60 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-500/30 font-bold">{a.hostCountry.substring(0, 3).toUpperCase()}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border ${a.taxPolicyType === 'EQUALIZATION' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' : 'bg-orange-950/50 text-orange-400 border-orange-900'
                                                    }`}>
                                                    {a.taxPolicyType}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-mono text-gray-300 text-right text-xs">
                                                <span className="text-gray-500">{a.homeTaxRate}%</span> vs <span className="text-white font-bold">{a.hostTaxRate}%</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {a.financials.companyLiability > 0 ? (
                                                    <span className="text-rose-400 font-bold font-mono text-sm">+${(a.financials.companyLiability).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                ) : (
                                                    <span className="text-emerald-500 font-bold font-mono text-sm">NO CAP</span>
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
        </div>
    );
}
