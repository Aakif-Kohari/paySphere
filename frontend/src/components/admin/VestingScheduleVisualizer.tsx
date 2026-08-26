import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Landmark, TrendingUp, HandCoins, AlertCircle } from 'lucide-react';
import { useMemo } from 'react';

interface VestingScheduleItem {
    date: string;
    sharesVesting: number;
    cumulativeVested: number;
    isVested: boolean;
    estimatedValue: number;
}

interface InternalGrant {
    grantId: string;
    grantType: string;
    totalShares: number;
    grantPrice: number;
    schedule: VestingScheduleItem[];
    currentValue: number;
}

interface Props {
    grants: InternalGrant[];
    loading: boolean;
    employeeId: string;
    currentFmv: number;
}

export default function VestingScheduleVisualizer({ grants, loading, employeeId, currentFmv }: Props) {

    // Flatten and aggregate schedules across all grants
    const chartData = useMemo(() => {
        const timeMap = new Map<string, { dateStr: string, timestamp: number, sharesVesting: number, cumulativeVested: number, value: number, isVested: boolean }>();

        grants.forEach(g => {
            g.schedule.forEach(s => {
                const d = new Date(s.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                if (!timeMap.has(key)) {
                    timeMap.set(key, {
                        dateStr: key,
                        timestamp: d.getTime(),
                        sharesVesting: 0,
                        cumulativeVested: 0,
                        value: 0,
                        isVested: s.isVested
                    });
                }

                const entry = timeMap.get(key)!;
                entry.sharesVesting += s.sharesVesting;
                entry.cumulativeVested += s.cumulativeVested;
                entry.value += s.estimatedValue;
                // Keep the latest vested status block
                if (!s.isVested) entry.isVested = false;
            });
        });

        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [grants]);

    if (loading) {
        return (
            <div className="w-full h-[500px] bg-gray-950 border border-gray-800 rounded-3xl animate-pulse flex flex-col items-center justify-center">
                <Landmark className="h-10 w-10 text-emerald-500 animate-pulse mb-4" />
                <p className="text-gray-500 font-medium tracking-widest text-xs uppercase">Computing Financial Projections...</p>
            </div>
        );
    }

    if (grants.length === 0 && !loading) {
        return (
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-gray-900 border border-gray-800 rounded-3xl text-gray-500 text-sm">
                <AlertCircle className="h-12 w-12 mb-3 opacity-20" />
                No equity grants active for this employee.
            </div>
        );
    }

    const todayIndex = chartData.findIndex(d => !d.isVested);

    return (
        <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl border border-gray-800 p-6 flex flex-col xl:flex-row gap-6 shadow-2xl drop-shadow-[0_0_15px_rgba(16,185,129,0.05)]">

            <div className="flex-1 w-full min-h-[450px]">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp className="text-emerald-500 h-6 w-6" />
                            Equity Vesting Projection
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Compound modeling of RSU / Option tranches over organizational tenure.
                        </p>
                    </div>

                    <div className="bg-gray-950 border border-gray-800 px-4 py-2 rounded-lg flex items-center gap-3 shadow-inner">
                        <HandCoins className="h-4 w-4 text-emerald-500" />
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Current Market Value (409A)</p>
                            <p className="font-mono font-bold text-emerald-400">${currentFmv.toFixed(2)} USD</p>
                        </div>
                    </div>
                </div>

                <div className="h-[400px] w-full bg-black/50 p-4 border border-gray-800/80 rounded-2xl shadow-inner">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="dateStr" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />

                            {/* Left Y Axis for specific tranche vests */}
                            <YAxis yAxisId="left" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} orientation="left" />

                            {/* Right Y Axis for cumulative monetary value */}
                            <YAxis yAxisId="right" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} orientation="right"
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                            />

                            <Tooltip
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                                itemStyle={{ fontSize: '13px' }}
                            />
                            <Legend />

                            {/* Draw a line marking TODAY if there are unvested items */}
                            {todayIndex !== -1 && (
                                <ReferenceLine x={chartData[todayIndex].dateStr} yAxisId="left" stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Today', position: 'top', fill: '#fcd34d' }} />
                            )}

                            <Bar yAxisId="left" name="Vesting Tranche (Shares)" dataKey="sharesVesting" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                            <Line yAxisId="right" type="monotone" name="Cumulative Value ($)" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Portfolio Panel */}
            <div className="w-full xl:w-96 bg-gray-950 border border-gray-800 rounded-2xl p-5 flex flex-col items-center">
                <div className="w-full mb-6">
                    <div className="bg-emerald-950/20 border border-emerald-500/30 p-5 rounded-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Landmark className="h-32 w-32 text-emerald-500" />
                        </div>
                        <h4 className="text-[10px] text-emerald-300 uppercase tracking-widest font-black mb-1">Total Equity Portfolio Value</h4>
                        <p className="text-4xl font-extrabold text-emerald-400 font-mono tracking-tight">
                            ${(grants.reduce((sum, g) => sum + g.currentValue, 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div className="mt-4 pt-4 border-t border-emerald-900/50 flex justify-between items-center text-xs text-gray-400">
                            <span>ID: <code className="text-white bg-black/50 px-1 py-0.5 rounded ml-1">{employeeId}</code></span>
                            <span>{grants.length} Active Grants</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full flex flex-col space-y-3 overflow-y-auto pr-1">
                    <h5 className="text-xs font-bold text-gray-500 border-b border-gray-800 pb-2">GRANT DETAILS</h5>
                    {grants.map(g => (
                        <div key={g.grantId} className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-sm hover:border-gray-700 transition">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-bold text-white">{g.grantId}</p>
                                <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] uppercase font-black px-1.5 py-0.5 rounded">
                                    {g.grantType}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs mb-3">
                                <span className="text-gray-400">Total Award: {g.totalShares.toLocaleString()}</span>
                                <span className="text-emerald-400 font-mono">${g.currentValue.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-800">
                                <div
                                    className="bg-emerald-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, ((g.schedule[g.schedule.length - 1]?.cumulativeVested || 0) / g.totalShares) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
