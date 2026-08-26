import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { ImmigrationRiskData } from '../../services/legal/immigrationService';

interface ChartProps {
    data: ImmigrationRiskData[];
    chartType: 'RISK_AREA' | 'COST_BAR';
}

export const ImmigrationComplianceRiskChart: React.FC<ChartProps> = ({ data, chartType }) => {
    if (data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-800/20 backdrop-blur-md rounded-2xl border border-slate-700">
                <div className="text-slate-400 font-medium animate-pulse">Computing Global Immigration Vectors...</div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl z-50 min-w-[200px]">
                    <h4 className="text-white font-semibold mb-2">{label} Jurisdiction</h4>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm py-1">
                            <span className="text-slate-400">{entry.name}:</span>
                            <span className="font-bold" style={{ color: entry.color }}>
                                {entry.name.includes('Spend')
                                    ? `$${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                    : entry.value}
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
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-purple-500/5 pointer-events-none" />

            <div className="mb-6 relative z-10">
                <h3 className="text-xl font-semibold text-white tracking-tight">
                    {chartType === 'RISK_AREA' ? 'Active Visa Expiration Trajectory' : 'Corporate Legal Spend Allocation'}
                </h3>
                <p className="text-sm text-slate-400 mt-1">Cross-border workforce regulatory distribution</p>
            </div>

            <div className="flex-1 relative z-10 min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'RISK_AREA' ? (
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="country" stroke="#64748B" tick={{ fill: '#94A3B8' }} />
                            <YAxis stroke="#64748B" tick={{ fill: '#94A3B8' }} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Area type="monotone" dataKey="activeVisas" name="Total Processing Visas" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorActive)" />
                            <Area type="monotone" dataKey="expiringVisas" name="Critical 90-Day Expiry" stroke="#EF4444" fillOpacity={1} fill="url(#colorRisk)" />
                        </AreaChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="country" stroke="#64748B" tick={{ fill: '#94A3B8' }} />
                            <YAxis stroke="#64748B" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fill: '#94A3B8' }} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Bar dataKey="spend" name="Retained Legal Spend" fill="#06B6D4" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};
