import { useState, useEffect } from 'react';
import { payEquityAPI } from '../../services/admin/payEquityService';
import PayParityScatterPlot from '../../components/admin/PayParityScatterPlot';
import { Network, Search, HardDrive, Calculator, ShieldCheck, ArrowUpRight, ArrowDownRight, RefreshCcw, HandCoins } from 'lucide-react';

export default function PayEquityDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);
    const [scatterData, setScatterData] = useState<any[]>([]);
    const [latestAudit, setLatestAudit] = useState<any>(null);

    const [activeDepartment, setActiveDepartment] = useState<string>('');
    const [remediationBudget, setRemediationBudget] = useState<number | null>(null);
    const [calculatingBudget, setCalculatingBudget] = useState(false);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const [histRes, scatRes] = await Promise.all([
                payEquityAPI.getAuditHistory(),
                payEquityAPI.getScatterData(activeDepartment)
            ]);

            const histData = histRes.data?.data || [];
            setHistory(histData);
            setScatterData(scatRes.data?.data || []);

            if (histData.length > 0) {
                setLatestAudit(histData[0]);
                setRemediationBudget(histData[0].remediationBudget || 0);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [activeDepartment]);

    const runNewAudit = async () => {
        setLoading(true);
        try {
            await payEquityAPI.runAudit();
            fetchDashboard();
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSeed = async () => {
        setLoading(true);
        await payEquityAPI.seedData();
        runNewAudit();
    };

    const generateRemediation = async () => {
        if (!latestAudit) return;
        setCalculatingBudget(true);
        try {
            const res = await payEquityAPI.calculateRemediation(latestAudit.auditId);
            setRemediationBudget(res.data?.data?.requiredBudget);
        } catch (error) {
            console.error(error);
        } finally {
            setCalculatingBudget(false);
            fetchDashboard(); // refresh to show saved budget
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-gray-200">

            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-gray-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-tr from-rose-500 via-fuchsia-600 to-indigo-600 rounded-xl flex items-center justify-center p-0.5 shadow-lg shadow-fuchsia-500/20">
                        <div className="h-full w-full bg-gray-950 rounded-[10px] flex items-center justify-center">
                            <Network className="h-5 w-5 text-fuchsia-400" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Pay Equity Analyzer</h1>
                        <p className="text-xs text-gray-400 font-medium">Algorithmic Compensation Parity Auditing System</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        value={activeDepartment}
                        onChange={(e) => setActiveDepartment(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                    >
                        <option value="">Company Wide</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Sales">Sales</option>
                        <option value="Product">Product</option>
                        <option value="Marketing">Marketing</option>
                    </select>
                    <button onClick={handleSeed} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm transition flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-emerald-400" /> Reset & Seed Data
                    </button>
                    <button onClick={runNewAudit} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30">
                        <RefreshCcw className="h-4 w-4" /> Run Global Audit
                    </button>
                </div>
            </header>

            <div className="max-w-[1500px] mx-auto p-6 space-y-6">

                {/* Top KPIs Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Unadjusted Gender Gap */}
                    <div className={`rounded-xl border p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden ${latestAudit && latestAudit.overallGenderWageGap > 3
                            ? 'bg-rose-950/20 border-rose-500/20 shadow-rose-900/10'
                            : 'bg-emerald-950/20 border-emerald-500/20 shadow-emerald-900/10'
                        }`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Search className="h-32 w-32" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Unadjusted Gender Wage Gap</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className={`text-5xl font-black ${latestAudit?.overallGenderWageGap > 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {latestAudit ? latestAudit.overallGenderWageGap.toFixed(1) : 0}%
                                </h2>
                                {latestAudit?.overallGenderWageGap > 3 ? (
                                    <ArrowUpRight className="h-6 w-6 text-rose-500" />
                                ) : (
                                    <ArrowDownRight className="h-6 w-6 text-emerald-500" />
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                                Reflects the raw median variance in compensation across all roles.
                                <span className="text-gray-300 font-semibold block mt-1">Status: {latestAudit?.status || 'N/A'}</span>
                            </p>
                        </div>
                    </div>

                    {/* AI Unexplained Variance (Implicit Bias Marker) */}
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/10 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ShieldCheck className="h-32 w-32" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">AI Unexplained Variance</p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-5xl font-black text-indigo-400">
                                    {latestAudit ? latestAudit.unexplainedVariance.toFixed(1) : 0}%
                                </h2>
                                <Calculator className="h-6 w-6 text-indigo-500" />
                            </div>
                            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                                Variance remaining after controlling for role, tenure, location, and performance. Often correlates as an indicator of implicit bias.
                            </p>
                        </div>
                    </div>

                    {/* Remediation Budget Action Panel */}
                    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 shadow-2xl flex flex-col justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Remediation Action Mapping</p>
                            {remediationBudget !== null && remediationBudget > 0 ? (
                                <div>
                                    <h2 className="text-4xl font-black text-fuchsia-400 mt-2">
                                        ${(remediationBudget / 1000).toFixed(1)}k
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-2">Required budget to harmonize base pay for structural deficit outliers.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-700 rounded-lg mt-2 text-center text-gray-500">
                                    <HandCoins className="h-6 w-6 mb-2 text-gray-600" />
                                    <p className="text-xs font-medium">No budget calculated for current audit tier.</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={generateRemediation}
                            disabled={calculatingBudget || !latestAudit}
                            className="w-full mt-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                        >
                            {calculatingBudget ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                            Map Remediation Budget
                        </button>
                    </div>

                </div>

                {/* Detailed Audit & Topology Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                    {/* Main Chart */}
                    <div className="xl:col-span-3">
                        <PayParityScatterPlot data={scatterData} loading={loading} marketBaseline={120000} />
                    </div>

                    {/* Department Breakdown Feed from Audit */}
                    <div className="xl:col-span-1 bg-gray-900/50 border border-gray-800 rounded-2xl p-5 shadow-inner flex flex-col h-[500px]">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2 border-b border-gray-800 pb-3">
                            Latest Department Audit
                        </h3>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {latestAudit?.departmentBreakdowns?.map((dept: any) => (
                                <div key={dept.department} className="bg-black/40 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-gray-200">{dept.department}</h4>
                                        {dept.genderGap > 5 && (
                                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                HIGH DEFICIT
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Gender Gap</span>
                                        <span className={`font-bold ${dept.genderGap > 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {dept.genderGap.toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="mt-3 bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800">
                                        <div
                                            className={`h-full ${dept.equityRiskFactor > 50 ? 'bg-rose-500' : 'bg-fuchsia-500'}`}
                                            style={{ width: `${Math.min(100, dept.equityRiskFactor)}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2 text-right">
                                        {dept.flaggedEmployees} flagged outliers
                                    </p>
                                </div>
                            ))}

                            {(!latestAudit || latestAudit.departmentBreakdowns.length === 0) && (
                                <div className="text-center py-20 text-gray-600 text-sm">
                                    Run a Global Audit to see department breakdowns.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
