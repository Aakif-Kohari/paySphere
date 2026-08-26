import { useState, useMemo } from 'react';
import { AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Scale, Activity, ShieldAlert, ArrowUpRight, ArrowDownRight, DollarSign, Filter, Search } from 'lucide-react';

export interface ParityDataPoint {
    employeeId: string;
    tenure: number;
    comp: number;
    perf: number;
    gender: string;
    level: number;
    department: string;
    compRatio: string;
}

interface Props {
    data: ParityDataPoint[];
    loading: boolean;
    marketBaseline: number;
}

export default function PayParityScatterPlot({ data, loading, marketBaseline }: Props) {
    const [selectedGender, setSelectedGender] = useState<string>('ALL');
    const [selectedLevel, setSelectedLevel] = useState<number | 'ALL'>('ALL');
    const [hoveredPoint, setHoveredPoint] = useState<ParityDataPoint | null>(null);

    // Memoize filtered data
    const filteredData = useMemo(() => {
        return data.filter(d =>
            (selectedGender === 'ALL' || d.gender === selectedGender) &&
            (selectedLevel === 'ALL' || d.level === selectedLevel)
        );
    }, [data, selectedGender, selectedLevel]);

    // Separate the series
    const maleData = filteredData.filter(d => d.gender === 'MALE');
    const femaleData = filteredData.filter(d => d.gender === 'FEMALE');

    if (loading) {
        return (
            <div className="w-full h-[500px] bg-gray-900 rounded-2xl border border-gray-800 animate-pulse flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <Activity className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                    <p className="text-gray-500 text-sm font-medium tracking-wide">Compiling Compensation Telemetry...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900/40 backdrop-blur-md rounded-2xl border border-gray-800 p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden">

            {/* Decorative gradient overlay */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-indigo-500/5 to-fuchsia-500/5 blur-3xl rounded-full -mr-48 -mt-48 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Scale className="text-indigo-400 h-6 w-6" />
                        Parity Scatter Telemetry (Base Comp vs Tenure)
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Analyzing structural compensation outliers scaled by performance (bubble size).</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Filter className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                        <select
                            className="pl-9 pr-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                            value={selectedGender}
                            onChange={(e) => setSelectedGender(e.target.value)}
                        >
                            <option value="ALL">All Demographics</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                        </select>
                    </div>

                    <select
                        className="px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    >
                        <option value="ALL">All Levels</option>
                        <option value={1}>L1 - Entry</option>
                        <option value={2}>L2 - Associate</option>
                        <option value={3}>L3 - Mid Level</option>
                        <option value={4}>L4 - Senior</option>
                        <option value={5}>L5 - Staff / Lead</option>
                    </select>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 relative z-10 mt-4">

                {/* Scatter Plot Area */}
                <div className="flex-1 bg-gray-950/80 rounded-xl p-4 border border-gray-800 h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis
                                type="number"
                                dataKey="tenure"
                                name="Tenure"
                                stroke="#9ca3af"
                                domain={[0, 'dataMax + 1']}
                                label={{ value: 'Tenure (Years)', position: 'insideBottom', offset: -10, fill: '#9ca3af' }}
                            />
                            <YAxis
                                type="number"
                                dataKey="comp"
                                name="Compensation"
                                stroke="#9ca3af"
                                domain={['auto', 'auto']}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                label={{ value: 'Base Salary', angle: -90, position: 'insideLeft', offset: -10, fill: '#9ca3af' }}
                            />
                            <ZAxis type="number" dataKey="perf" range={[60, 400]} name="Performance Rating" />

                            <ReferenceLine y={marketBaseline} stroke="#6366f1" strokeDasharray="5 5" label={{ position: 'top', value: 'Market Baseline 50th PCTL', fill: '#818cf8', fontSize: 12 }} />

                            <Tooltip
                                cursor={{ strokeDasharray: '3 3', stroke: '#4b5563' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-gray-800/95 backdrop-blur-xl border border-gray-700 p-4 rounded-xl shadow-2xl shadow-black/80 w-64 z-50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="text-white font-bold text-lg">{d.employeeId}</p>
                                                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${d.gender === 'FEMALE' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
                                                        {d.gender}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-4">{d.department} &middot; Level {d.level}</p>

                                                <div className="space-y-2 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Base Salary</span>
                                                        <span className="text-emerald-400 font-bold">${d.comp.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Tenure</span>
                                                        <span className="text-white font-medium">{d.tenure} Years</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">Performance (Size)</span>
                                                        <span className="text-white font-medium">{d.perf} / 5</span>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t border-gray-700">
                                                        <span className="text-gray-400">Compa-Ratio</span>
                                                        <span className={`font-bold ${parseFloat(d.compRatio) < 0.9 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {(parseFloat(d.compRatio) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />

                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            <Scatter
                                name="Male Demographic"
                                data={maleData}
                                fill="#06b6d4" // Cyan 500
                                fillOpacity={selectedGender !== 'FEMALE' ? 0.7 : 0.1}
                                shape="circle"
                                onMouseEnter={(e) => setHoveredPoint(e.payload)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            />
                            <Scatter
                                name="Female Demographic"
                                data={femaleData}
                                fill="#d946ef" // Fuchsia 500
                                fillOpacity={selectedGender !== 'MALE' ? 0.7 : 0.1}
                                shape="triangle"
                                onMouseEnter={(e) => setHoveredPoint(e.payload)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Dynamic Context Panel */}
                <div className="w-full lg:w-72 bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl border border-gray-800 p-5 flex flex-col justify-between relative overflow-hidden shadow-inner">

                    <div>
                        <h4 className="text-gray-300 font-bold uppercase tracking-wider text-xs mb-4">Diagnostic Insight (Beta)</h4>

                        <div className="space-y-4">
                            <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Visible Employees</p>
                                <p className="text-2xl font-light text-white">{filteredData.length}</p>
                            </div>

                            <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Median Compensation</p>
                                <p className="text-2xl font-light text-emerald-400">
                                    ${filteredData.length > 0 ? (filteredData.reduce((acc, curr) => acc + curr.comp, 0) / filteredData.length / 1000).toFixed(1) : 0}k
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <div className="rounded-lg bg-indigo-900/20 border border-indigo-500/20 p-4">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="text-indigo-400 h-5 w-5 mt-0.5 shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold text-indigo-300">Compliance Checker</h5>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                        Hover over data points falling significantly below the baseline regression curve. Identify outliers for budget remediation mapping.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
