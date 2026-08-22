import React, { useEffect, useState } from 'react';
import { ImmigrationComplianceRiskChart } from '../../components/legal/ImmigrationComplianceRiskChart';
import { VisaSponsorshipTracker } from '../../components/legal/VisaSponsorshipTracker';
import { immigrationService, VisaSponsorship, ImmigrationRiskData } from '../../services/legal/immigrationService';
import { Briefcase, FileSignature, Globe2, PlaneLanding, Fingerprint, RefreshCw } from 'lucide-react';

export const WorkforceImmigrationHubPage: React.FC = () => {
    const [riskData, setRiskData] = useState<ImmigrationRiskData[]>([]);
    const [sponsorships, setSponsorships] = useState<VisaSponsorship[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartMode, setChartMode] = useState<'RISK_AREA' | 'COST_BAR'>('RISK_AREA');
    const [init, setInit] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [metrics, records] = await Promise.all([
                immigrationService.getRiskChart(),
                immigrationService.getSponsorships(1, 100)
            ]);
            setRiskData(metrics);
            setSponsorships(records.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!init) {
            immigrationService.seedData().then(() => {
                setInit(true);
                fetchDashboardData();
            });
        }
    }, [init]);

    const globalActiveVisas = riskData.reduce((acc, c) => acc + c.activeVisas, 0);
    const globalCriticalVisas = riskData.reduce((acc, c) => acc + c.expiringVisas, 0);
    const globalLegalSpend = riskData.reduce((acc, c) => acc + c.spend, 0);

    return (
        <div className="min-h-screen bg-slate-950 p-8 pt-24 font-sans text-slate-200">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* Header Section */}
                <div className="flex justify-between items-end pb-4 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                                <Globe2 className="w-8 h-8 text-cyan-400" />
                            </div>
                            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-tight">
                                Workforce Legal Immigration & Visas Hub
                            </h1>
                        </div>
                        <p className="text-slate-400 text-lg">Cross-border workforce regulatory administration and sponsorship mobility matrix.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => fetchDashboardData()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 transition-colors rounded-lg border border-slate-700 text-sm font-medium"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Re-calculate Risks
                        </button>
                        <button className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 transition-colors rounded-lg font-semibold text-white shadow-lg shadow-cyan-500/30">
                            <FileSignature className="w-4 h-4" />
                            File Petitions
                        </button>
                    </div>
                </div>

                {/* Global KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Active Sponsorships</span>
                            <Briefcase className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-white">{globalActiveVisas}</span>
                            <span className="text-slate-500 text-sm ml-2">Managed Expatriates</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Expiring &lt; 90 Days</span>
                            <PlaneLanding className="w-5 h-5 text-rose-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-rose-400">{globalCriticalVisas}</span>
                            <span className="text-slate-500 text-sm ml-2">Urgent Renewals</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Clearance Rate</span>
                            <Fingerprint className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-emerald-400">97.8%</span>
                            <span className="text-slate-500 text-sm ml-2">Total Verified</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Annual Retainer Spend</span>
                            <FileSignature className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-purple-400">${globalLegalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            <span className="text-slate-500 text-sm ml-2">Disbursed</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid Payload */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                    {/* Main Visualizer */}
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setChartMode('RISK_AREA')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${chartMode === 'RISK_AREA' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                Immigration Risk Density
                            </button>
                            <button
                                onClick={() => setChartMode('COST_BAR')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${chartMode === 'COST_BAR' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                Jurisdictional Cost Center
                            </button>
                        </div>
                        <ImmigrationComplianceRiskChart data={riskData} chartType={chartMode} />
                    </div>

                    {/* Deep Ledger Component */}
                    <div>
                        <VisaSponsorshipTracker sponsorships={sponsorships} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WorkforceImmigrationHubPage;
