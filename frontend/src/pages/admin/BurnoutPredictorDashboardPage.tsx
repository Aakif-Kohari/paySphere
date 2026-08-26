import { useState, useEffect } from 'react';
import { burnoutServiceAPI } from '../../services/admin/burnoutService';
import BurnoutHeatmap from '../../components/admin/BurnoutHeatmap';
import { Flame, Brain, ShieldAlert, HeartPulse, HardDrive, RefreshCcw, BellRing, Sparkles, TrendingUp, Users } from 'lucide-react';

export default function BurnoutPredictorDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [departmentData, setDepartmentData] = useState<any[]>([]);
    const [highRisk, setHighRisk] = useState<any[]>([]);
    const [interventions, setInterventions] = useState<any[]>([]);
    const [runningInterventions, setRunningInterventions] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [heatRes, riskRes, intRes] = await Promise.all([
                burnoutServiceAPI.getDepartmentHeatmap(),
                burnoutServiceAPI.getHighRiskTopology(50),
                burnoutServiceAPI.getActiveInterventions()
            ]);
            setDepartmentData(heatRes.data?.data || []);
            setHighRisk(riskRes.data?.data || []);
            setInterventions(intRes.data?.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleSeed = async () => {
        setLoading(true);
        await burnoutServiceAPI.seedDemoData();
        fetchAll();
    };

    const handleAutoIntervene = async () => {
        setRunningInterventions(true);
        try {
            await burnoutServiceAPI.runAutoInterventions();
            await fetchAll();
        } finally {
            setRunningInterventions(false);
        }
    };

    // Stats derivation
    const totalEmployees = departmentData.reduce((acc, curr) => acc + curr.total, 0);
    const criticalCount = departmentData.reduce((acc, curr) => acc + curr.critical, 0);

    return (
        <div className="min-h-screen bg-[#070707] text-gray-200 selection:bg-orange-500/30">

            {/* Application Navbar */}
            <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-gray-800/80 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-tr from-orange-600 via-rose-600 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/30">
                        <Flame className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            Burnout Risk Predictor <span className="bg-rose-500/10 text-rose-400 text-xs px-2 py-0.5 rounded border border-rose-500/30 font-black tracking-widest uppercase">AI Agent</span>
                        </h1>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">Enterprise Sentiment & Psychological Safety Radar</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={handleSeed} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-xs font-bold uppercase transition flex items-center gap-2">
                        <HardDrive className="h-3 w-3 text-cyan-400" /> Init Data
                    </button>
                    <button onClick={handleAutoIntervene} disabled={runningInterventions} className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-orange-600/30">
                        {runningInterventions ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Trigger Auto Intervention
                    </button>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto p-6 space-y-6">

                {/* Metric Cards Ribbon */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform"></div>
                        <p className="text-xs font-bold uppercase text-gray-500 tracking-widest relative z-10">Total Workforce Checked</p>
                        <h3 className="text-3xl font-black text-white mt-1 relative z-10 flex items-center gap-3">
                            {totalEmployees} <Users className="h-5 w-5 text-gray-600" />
                        </h3>
                    </div>

                    <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden shadow-rose-900/10">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ShieldAlert className="h-20 w-20 text-rose-500" />
                        </div>
                        <p className="text-xs font-bold uppercase text-rose-300/80 tracking-widest relative z-10">Critical Burnout Cases</p>
                        <h3 className="text-4xl font-black text-rose-500 mt-2 relative z-10">
                            {criticalCount}
                        </h3>
                        <div className="mt-2 text-xs font-bold text-rose-400/80 bg-rose-500/10 inline-block px-2 py-0.5 rounded">
                            {(totalEmployees ? (criticalCount / totalEmployees) * 100 : 0).toFixed(1)}% of population
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl">
                        <p className="text-xs font-bold uppercase text-gray-500 tracking-widest relative z-10 mb-3 block">Avg Weekly Workload</p>
                        <div className="flex items-end gap-3">
                            <h3 className="text-3xl font-black text-orange-400">
                                {departmentData.length ? Math.round(departmentData.reduce((a, c) => a + c.avgHours, 0) / departmentData.length) : 0}h
                            </h3>
                            <span className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Median</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl relative">
                        <p className="text-xs font-bold uppercase text-indigo-300 tracking-widest relative z-10 mb-2">Active AI Interventions</p>
                        <div className="flex justify-between items-center mt-2 group">
                            <h3 className="text-4xl font-black text-white group-hover:scale-110 transition-transform origin-left">
                                {interventions.length}
                            </h3>
                            <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                                <HeartPulse className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Component */}
                <BurnoutHeatmap data={departmentData} loading={loading} />

                {/* Lower Split Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* High Risk Topology List */}
                    <div className="xl:col-span-2 bg-gray-900/70 backdrop-blur-md rounded-2xl border border-gray-800 p-6 shadow-2xl h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Flame className="text-rose-500 h-5 w-5" />
                                Top Flight Risk Telemetry
                            </h3>
                            <span className="text-xs font-bold bg-gray-800 px-3 py-1 rounded text-gray-400">Displaying top {highRisk.length} outliers</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-3 custom-scrollbar">
                            {highRisk.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-500 text-sm">No critical risks detected.</div>
                            ) : (
                                highRisk.map((emp) => (
                                    <div key={emp._id} className="bg-black/50 border border-rose-900/30 hover:border-rose-500/50 transition-colors p-4 rounded-xl flex flex-wrap lg:flex-nowrap justify-between items-center gap-4">
                                        <div>
                                            <p className="font-bold text-gray-100 flex items-center gap-2">
                                                {emp.employeeId}
                                                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">{emp.riskCategory}</span>
                                            </p>
                                            <p className="text-xs text-rose-400/80 mt-1">{emp.department} &middot; Risk Score: {emp.burnoutRiskScore}/100</p>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Workload</span>
                                                <span className="text-sm font-semibold text-gray-300">{emp.averageWeeklyHours} hrs/wk</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sentiment</span>
                                                <span className={`text-sm font-semibold ${emp.sentimentScore < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {emp.sentimentScore.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Intervention Logs */}
                    <div className="xl:col-span-1 bg-gradient-to-b from-indigo-950/20 to-gray-900/20 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl h-[500px] flex flex-col">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                            <BellRing className="text-indigo-400 h-5 w-5" />
                            Intervention Feed
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                            {interventions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                                    <Brain className="h-10 w-10 mb-3 opacity-20" />
                                    <p className="text-sm">No active interventions. Run Auto-Intervene to let AI prescribe wellness actions.</p>
                                </div>
                            ) : (
                                interventions.map((int) => (
                                    <div key={int._id} className="relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-indigo-500/20 last:before:bottom-0">
                                        <div className="absolute left-[3px] top-2 h-[12px] w-[12px] rounded-full bg-indigo-500 border-[3px] border-black"></div>
                                        <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                                            <p className="text-xs text-indigo-400 font-bold mb-1">{int.interventionType.replace('_', ' ')}</p>
                                            <p className="text-sm font-bold text-white mb-2">{int.employeeId}</p>
                                            <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                                <span>By: {int.triggeredBy}</span>
                                                <span className="px-2 py-0.5 bg-gray-800 rounded">{int.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
