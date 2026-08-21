import React, { useEffect, useState } from 'react';
import { TaxJurisdictionMap } from '../../components/tax/TaxJurisdictionMap';
import { CorporateTaxLedger } from '../../components/tax/CorporateTaxLedger';
import { taxService, CorporateObligation, RiskTopology } from '../../services/tax/taxService';
import { ShieldCheck, Activity, Globe, Database, ServerCrash, RefreshCw } from 'lucide-react';

export const SmartTaxHarmonizationPage: React.FC = () => {
    const [topology, setTopology] = useState<RiskTopology[]>([]);
    const [obligations, setObligations] = useState<CorporateObligation[]>([]);
    const [loading, setLoading] = useState(true);
    const [metricFocus, setMetricFocus] = useState<'LIABILITY' | 'COMPLEXITY'>('LIABILITY');
    const [init, setInit] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [topoData, oblgData] = await Promise.all([
                taxService.getRiskTopology(),
                taxService.getObligations(1, 50)
            ]);
            setTopology(topoData);
            setObligations(oblgData.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!init) {
            taxService.seedData().then(() => {
                setInit(true);
                fetchDashboardData();
            });
        }
    }, [init]);

    const globalTotalLiability = topology.reduce((acc, region) => acc + region.metrics.aggregateLiability, 0);
    const globalRiskFlags = topology.reduce((acc, region) => acc + region.metrics.aggregateRisk, 0);
    const totalJurisdictions = topology.reduce((acc, region) => acc + region.nodes.length, 0);

    return (
        <div className="min-h-screen bg-slate-950 p-8 pt-24 font-sans text-slate-200">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header Section */}
                <div className="flex justify-between items-end pb-4 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                                <Globe className="w-8 h-8 text-indigo-400" />
                            </div>
                            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400 tracking-tight">
                                Enterprise Smart Tax Harmonization
                            </h1>
                        </div>
                        <p className="text-slate-400 text-lg">Centralized regulatory oversight and multi-jurisdictional tax liability forecasting.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => fetchDashboardData()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 transition-colors rounded-lg border border-slate-700 text-sm font-medium"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Sync Jurisdictions
                        </button>
                        <button className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-lg font-semibold text-white shadow-lg shadow-indigo-500/30">
                            <Database className="w-4 h-4" />
                            Generate Audit Report
                        </button>
                    </div>
                </div>

                {/* Global KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Aggregated Global Liability</span>
                            <Activity className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-white">${globalTotalLiability.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">High Risk Audit Flags</span>
                            <ServerCrash className="w-5 h-5 text-rose-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-rose-400">{globalRiskFlags}</span>
                            <span className="text-slate-500 text-sm ml-2">Active Incidents</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Tracked Jurisdictions</span>
                            <Globe className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-emerald-400">{totalJurisdictions}</span>
                            <span className="text-slate-500 text-sm ml-2">Sovereignties</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Compliance Index</span>
                            <ShieldCheck className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-blue-400">92.4%</span>
                            <span className="text-slate-500 text-sm ml-2">Harmonized</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid Payload */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[550px]">
                    {/* Main Visualizer */}
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMetricFocus('LIABILITY')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${metricFocus === 'LIABILITY' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                Liability Weighting
                            </button>
                            <button
                                onClick={() => setMetricFocus('COMPLEXITY')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${metricFocus === 'COMPLEXITY' ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                Risk Vector Weighting
                            </button>
                        </div>
                        <TaxJurisdictionMap topologyData={topology} metricFocus={metricFocus} />
                    </div>

                    {/* Deep Ledger Component */}
                    <div>
                        <CorporateTaxLedger obligations={obligations} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SmartTaxHarmonizationPage;
