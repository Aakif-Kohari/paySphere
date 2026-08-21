import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { SuccessionTopologyData } from '../../services/admin/successionService';

interface ChartProps {
    data: SuccessionTopologyData[];
    chartType: 'FLIGHT_RISK' | 'BENCH_STRENGTH';
}

export const FlightRiskTopology: React.FC<ChartProps> = ({ data, chartType }) => {
    if (data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-800/20 backdrop-blur-md rounded-2xl border border-slate-700">
                <div className="text-slate-400 font-medium animate-pulse">Calculating Critical Succession Nodes...</div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl z-50 min-w-[200px]">
                    <h4 className="text-white font-semibold mb-2">{label} Dept</h4>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm py-1">
                            <span className="text-slate-400">{entry.name}:</span>
                            <span className="font-bold" style={{ color: entry.color }}>
                                {entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full w-full bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-rose-500/5 pointer-events-none" />

            <div className="mb-6 relative z-10">
                <h3 className="text-xl font-semibold text-white tracking-tight">
                    {chartType === 'FLIGHT_RISK' ? 'Executive Flight Risk Vectors' : 'Ready-Now Bench Strength'}
                </h3>
                <p className="text-sm text-slate-400 mt-1">Cross-departmental leadership pipeline depth</p>
            </div>

            <div className="flex-1 relative z-10 min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'FLIGHT_RISK' ? (
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="department" stroke="#64748B" tick={{ fill: '#94A3B8' }} />
                            <YAxis stroke="#64748B" tick={{ fill: '#94A3B8' }} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Area type="monotone" dataKey="criticalRoles" name="Total Critical Roles" stroke="#3B82F6" fillOpacity={1} fill="url(#colorTotal)" />
                            <Area type="monotone" dataKey="atRisk" name="Roles At Risk" stroke="#F43F5E" fillOpacity={1} fill="url(#colorRisk)" />
                        </AreaChart>
                    ) : (
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="department" stroke="#94A3B8" />
                            <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} stroke="#64748B" />
                            <Radar name="Ready-Now Candidates" dataKey="benchStrength" stroke="#10B981" fill="#10B981" fillOpacity={0.4} />
                            <Radar name="Vacant Critical Roles" dataKey="vacant" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.4} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                        </RadarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};
