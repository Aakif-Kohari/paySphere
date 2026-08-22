import { useEffect, useState } from 'react';
import { Network, AlertTriangle, TrendingDown, Clock, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend, CartesianGrid, ReferenceArea } from 'recharts';

export interface FlightRiskProfile {
    _id?: string;
    employeeId: string;
    riskScore: number;
    riskFactors: { factor: string; weight: number; impact: string }[];
    compensationRatio: number;
    timeInRole: number;
    managerTurnover: number;
    profileData?: {
        performanceScore: number;
        potentialScore: number;
        currentRole: string;
        department: string;
    };
    financialImpact?: number;
}

interface Props {
    data: FlightRiskProfile[];
    loading: boolean;
}

export default function FlightRiskTopology({ data, loading }: Props) {
    const [selectedRisk, setSelectedRisk] = useState<FlightRiskProfile | null>(null);

    // Map Data for plotting
    const chartData = data.map(item => ({
        name: item.employeeId,
        x: item.profileData?.performanceScore || 0,
        y: item.riskScore,
        z: item.financialImpact || 0,
        role: item.profileData?.currentRole || 'N/A',
        fullData: item
    }));

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center bg-gray-900 rounded-xl border border-gray-800 animate-pulse">
                <Network className="h-10 w-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-800 p-6 flex flex-col lg:flex-row gap-6 shadow-2xl">
            {/* Chart Section */}
            <div className="flex-1 min-h-[400px]">
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Flight Risk Topology Grid
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Analyzing criticality vs attrition probability to prevent critical knowledge loss.
                    </p>
                </div>

                <div className="h-[350px] w-full mt-6 bg-gray-950 rounded-xl p-4 border border-gray-800 shadow-inner">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

                            <ReferenceArea x1={1} x2={3} y1={70} y2={100} fill="#f43f5e" fillOpacity={0.1} />
                            <ReferenceArea x1={3} x2={5} y1={70} y2={100} fill="#ef4444" fillOpacity={0.2} />

                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Performance"
                                domain={[1, 5]}
                                stroke="#9ca3af"
                                label={{ value: 'Performance Score', position: 'insideBottom', fill: '#9ca3af', offset: -10 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Risk Score"
                                domain={[0, 100]}
                                stroke="#9ca3af"
                                label={{ value: 'Flight Risk %', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                            />
                            <ZAxis type="number" dataKey="z" range={[100, 800]} name="Impact" />

                            <Tooltip
                                cursor={{ strokeDasharray: '3 3', stroke: '#4b5563' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const dataInfo = payload[0].payload;
                                        return (
                                            <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-xl shadow-black/50">
                                                <p className="text-white font-bold">{dataInfo.name}</p>
                                                <p className="text-xs text-indigo-400 mb-2">{dataInfo.role}</p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                    <span className="text-gray-400">Risk Score:</span>
                                                    <span className="text-amber-500 font-semibold">{dataInfo.y}%</span>
                                                    <span className="text-gray-400">Performance:</span>
                                                    <span className="text-white">{dataInfo.x}</span>
                                                    <span className="text-gray-400">Biz Impact:</span>
                                                    <span className="text-emerald-400">${(dataInfo.z / 1000).toFixed(1)}k</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend wrapperStyle={{ color: '#9ca3af' }} />

                            <Scatter
                                name="Critical Employees"
                                data={chartData.filter(d => d.y >= 75)}
                                fill="#ef4444"
                                onClick={(e) => setSelectedRisk(e.fullData)}
                                className="cursor-pointer transition-all hover:opacity-80"
                            />
                            <Scatter
                                name="Monitored Staff"
                                data={chartData.filter(d => d.y < 75)}
                                fill="#f59e0b"
                                onClick={(e) => setSelectedRisk(e.fullData)}
                                className="cursor-pointer transition-all hover:opacity-80"
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Details Panel */}
            <div className="w-full lg:w-96 flex flex-col bg-gray-950/80 rounded-xl border border-gray-800 p-5 shadow-inner">
                {selectedRisk ? (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-lg font-bold text-white">{selectedRisk.employeeId}</h4>
                                <p className="text-sm text-indigo-400">{selectedRisk.profileData?.currentRole}</p>
                                <span className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded bg-gray-800 text-gray-300">
                                    <Network className="h-3 w-3" />
                                    {selectedRisk.profileData?.department}
                                </span>
                            </div>
                            <div className={`text-xl font-black ${selectedRisk.riskScore >= 75 ? 'text-red-500' : 'text-amber-500'}`}>
                                {selectedRisk.riskScore}%
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col">
                                <span className="text-xs text-gray-500">Comp Ratio</span>
                                <span className="text-sm font-semibold text-white mt-1">{(selectedRisk.compensationRatio * 100).toFixed(1)}%</span>
                            </div>
                            <div className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col">
                                <span className="text-xs text-gray-500">Mngr Turnover</span>
                                <span className="text-sm font-semibold text-white mt-1">{selectedRisk.managerTurnover} changes</span>
                            </div>
                        </div>

                        <div className="flex-1">
                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Primary Risk Factors</h5>
                            <div className="space-y-3 overflow-y-auto max-h-48 pr-2 custom-scrollbar">
                                {selectedRisk.riskFactors.map((factor, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/60 border border-gray-800/80">
                                        {factor.impact === 'NEGATIVE' ? (
                                            <TrendingDown className="h-4 w-4 text-red-400 mt-0.5" />
                                        ) : (
                                            <ArrowUpRight className="h-4 w-4 text-emerald-400 mt-0.5" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-gray-200">{factor.factor}</p>
                                            <p className="text-xs text-gray-500 mt-1">Model Weight: {factor.weight}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                            <ShieldAlert className="h-4 w-4" />
                            Engage Retention Protocol
                        </button>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                        <Clock className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm">Select an employee node from the topology matrix to view detailed flight risk analyticals and trigger engagement workflows.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
