import React, { useEffect, useState } from 'react';
import { FlightRiskTopology } from '../../components/admin/FlightRiskTopology';
import { SuccessionTalentMatrix } from '../../components/admin/SuccessionTalentMatrix';
import { successionService, SuccessionCandidate, SuccessionTopologyData } from '../../services/admin/successionService';
import { Crown, Network, Building2, UserX, Target, RefreshCw } from 'lucide-react';

export const EnterpriseSuccessionHubPage: React.FC = () => {
    const [topology, setTopology] = useState<SuccessionTopologyData[]>([]);
    const [candidates, setCandidates] = useState<SuccessionCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [chartMode, setChartMode] = useState<'FLIGHT_RISK' | 'BENCH_STRENGTH'>('FLIGHT_RISK');
    const [init, setInit] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [metrics, records] = await Promise.all([
                successionService.getTopology(),
                successionService.getCandidates(1, 100)
            ]);
            setTopology(metrics);
            setCandidates(records.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!init) {
            successionService.seedData().then(() => {
                setInit(true);
                fetchDashboardData();
            });
        }
    }, [init]);

    const globalTotalRoles = topology.reduce((acc, c) => acc + c.criticalRoles, 0);
    const globalAtRisk = topology.reduce((acc, c) => acc + (c.atRisk || 0), 0);
    const globalBenchStrength = topology.reduce((acc, c) => acc + c.benchStrength, 0);

    return (
        <div className="min-h-screen bg-slate-950 p-8 pt-24 font-sans text-slate-200">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* Header Section */}
                <div className="flex justify-between items-end pb-4 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                                <Network className="w-8 h-8 text-amber-400" />
                            </div>
                            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400 tracking-tight">
                                Workforce Succession Planning & Contingency Hub
                            </h1>
                        </div>
                        <p className="text-slate-400 text-lg">Organizational restructures, bench charting, and executive flight risk telemetry.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => fetchDashboardData()}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 transition-colors rounded-lg border border-slate-700 text-sm font-medium"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Sync Topology
                        </button>
                        <button className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 transition-colors rounded-lg font-semibold text-white shadow-lg shadow-amber-500/30">
                            <Target className="w-4 h-4" />
                            Configure Restructure Node
                        </button>
                    </div>
                </div>

                {/* Global KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Critical Operations Nodes</span>
                            <Building2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-white">{globalTotalRoles}</span>
                            <span className="text-slate-500 text-sm ml-2">Total Exec Roles</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">High Flight Risk Nodes</span>
                            <UserX className="w-5 h-5 text-rose-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-rose-400">{globalAtRisk}</span>
                            <span className="text-slate-500 text-sm ml-2">Impending Departures</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Ready-Now Candidates</span>
                            <Crown className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-emerald-400">{globalBenchStrength}</span>
                            <span className="text-slate-500 text-sm ml-2">Bench Depth</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start">
                            <span className="text-slate-400 font-medium">Leadership Deficit Index</span>
                            <Network className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-amber-400">{((globalAtRisk / globalTotalRoles) * 100).toFixed(1)}%</span>
                            <span className="text-slate-500 text-sm ml-2">Exposure Ratio</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid Payload */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                    {/* Main Visualizer */}
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setChartMode('FLIGHT_RISK')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${chartMode === 'FLIGHT_RISK' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                Flight Risk Topology
                            </button>
                            <button
                                onClick={() => setChartMode('BENCH_STRENGTH')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all ${chartMode === 'BENCH_STRENGTH' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >
                                Bench Strength Radar
                            </button>
                        </div>
                        <FlightRiskTopology data={topology} chartType={chartMode} />
                    </div>

                    {/* Deep Ledger Component */}
                    <div>
                        <SuccessionTalentMatrix candidates={candidates} />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EnterpriseSuccessionHubPage;
