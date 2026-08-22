import { useState, useEffect } from 'react';
import { equityVestingAPI } from '../../services/admin/equityVestingService';
import VestingScheduleVisualizer from '../../components/admin/VestingScheduleVisualizer';
import { Landmark, TrendingUp, HandCoins, HardDrive, Filter, Users, ShieldAlert, Target } from 'lucide-react';

export default function EquityVestingDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [topHolders, setTopHolders] = useState<any[]>([]);

    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [portfolioData, setPortfolioData] = useState<any>(null);
    const [portfolioLoading, setPortfolioLoading] = useState(false);

    const fetchGlobalAssets = async () => {
        setLoading(true);
        try {
            const [sumRes, topRes] = await Promise.all([
                equityVestingAPI.getEnterpriseSummary(),
                equityVestingAPI.getTopHolders(10)
            ]);
            setSummary(sumRes.data?.data);
            const top = topRes.data?.data || [];
            setTopHolders(top);

            if (top.length > 0 && !selectedEmployee) {
                setSelectedEmployee(top[0].employeeId);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGlobalAssets();
    }, []);

    useEffect(() => {
        if (selectedEmployee) {
            loadEmployeePortfolio(selectedEmployee);
        }
    }, [selectedEmployee]);

    const loadEmployeePortfolio = async (empid: string) => {
        setPortfolioLoading(true);
        try {
            const res = await equityVestingAPI.getEmployeePortfolio(empid);
            setPortfolioData(res.data?.data);
        } catch (e) {
            console.error(e);
        } finally {
            setPortfolioLoading(false);
        }
    };

    const seed = async () => {
        setLoading(true);
        await equityVestingAPI.seedDemoData();
        fetchGlobalAssets();
    };

    return (
        <div className="min-h-screen bg-[#08080a] text-gray-200">

            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/70 backdrop-blur-xl border-b border-gray-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Landmark className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                            Institutional Equity Engine
                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 font-black tracking-widest uppercase">FINANCE & HR</span>
                        </h1>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">Enterprise RSU & Option Liability Predictor</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={seed} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-xs font-bold uppercase transition flex items-center gap-2">
                        <HardDrive className="h-3 w-3 text-cyan-400" /> Init Ledger Data
                    </button>
                </div>
            </header>

            <div className="max-w-[1500px] mx-auto p-6 space-y-6">

                {/* KPI Ribbons */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest relative z-10">Total Unvested Enterprise Liability</p>
                            <h3 className="text-4xl font-extrabold font-mono text-emerald-400 mt-2 relative z-10">
                                ${(summary.totalUnvestedValue / 1000000).toFixed(2)}M
                            </h3>
                            <p className="text-xs text-emerald-500/70 mt-2 relative z-10 font-bold bg-emerald-500/10 inline-block px-2 py-0.5 rounded">
                                Across {summary.totalUnvestedShares.toLocaleString()} unvested shares
                            </p>
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl relative">
                            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-3 relative z-10">Total Minted Stock Volume</p>
                            <div className="flex items-baseline gap-2 relative z-10">
                                <h3 className="text-3xl font-extrabold font-mono text-white">
                                    {summary.totalGrantedShares.toLocaleString()}
                                </h3>
                                <span className="text-sm font-medium text-gray-500">Shares</span>
                            </div>

                            <div className="mt-4 bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800 flex relative z-10">
                                <div className="bg-emerald-500 h-full" style={{ width: `${(summary.totalVestedShares / summary.totalGrantedShares) * 100}%` }}></div>
                                <div className="bg-indigo-500 h-full" style={{ width: `${(summary.totalUnvestedShares / summary.totalGrantedShares) * 100}%` }}></div>
                            </div>
                            <div className="flex justify-between mt-2 text-[10px] uppercase font-bold text-gray-500">
                                <span className="text-emerald-500">Vested</span>
                                <span className="text-indigo-500">Unvested</span>
                            </div>
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
                            <p className="text-xs font-bold uppercase text-gray-500 tracking-widest relative z-10">Current 409A FMV</p>
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-gray-950 border border-gray-800 rounded-full flex items-center justify-center shrink-0">
                                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-extrabold font-mono text-white">${summary.currentFmv.toFixed(2)}</h3>
                                    <p className="text-xs text-green-500 flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3" /> +12.4% YTD</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                    {/* Employee Select Sidebar */}
                    <div className="xl:col-span-1 bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-5 shadow-inner flex flex-col h-[600px]">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2 border-b border-gray-800 pb-3">
                            <Target className="h-4 w-4 text-emerald-400" />
                            Unvested Retention Top Tier
                        </h3>

                        <div className="relative mb-4">
                            <Filter className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input type="text" placeholder="Search by Employee ID..." className="w-full bg-black/40 border border-gray-800 text-sm text-gray-200 rounded-lg pl-9 pr-4 py-2 focus:ring-1 focus:ring-emerald-500 outline-none" />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {topHolders.map((holder, idx) => (
                                <button
                                    key={holder.employeeId}
                                    onClick={() => setSelectedEmployee(holder.employeeId)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all ${selectedEmployee === holder.employeeId
                                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/20'
                                            : 'bg-black/20 border-transparent hover:border-gray-700'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-gray-200">{holder.employeeId}</span>
                                        {idx < 3 && <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded font-black border border-yellow-500/30">TOP {idx + 1}</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">{holder.department}</p>

                                    <div className="flex justify-between items-center bg-gray-950 px-2 py-1.5 rounded-lg border border-gray-800">
                                        <span className="text-[10px] text-gray-500 uppercase font-black">Unvested</span>
                                        <span className="text-xs text-emerald-400 font-mono font-bold">{holder.unvestedShares.toLocaleString()} Sh</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Visualization Area */}
                    <div className="xl:col-span-3">
                        {portfolioData ? (
                            <VestingScheduleVisualizer
                                grants={portfolioData.grants}
                                loading={portfolioLoading}
                                employeeId={portfolioData.employeeId}
                                currentFmv={summary?.currentFmv || 10.0}
                            />
                        ) : (
                            <div className="w-full h-[600px] bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl flex flex-col items-center justify-center">
                                <Landmark className="h-16 w-16 mb-4 text-emerald-500 opacity-20" />
                                <p className="text-gray-500">Select an employee from the retention list to plot their vesting compound curves.</p>
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
}
