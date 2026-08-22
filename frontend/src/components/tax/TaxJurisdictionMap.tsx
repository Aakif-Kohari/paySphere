import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { RiskTopology } from '../../services/tax/taxService';

interface MapProps {
    topologyData: RiskTopology[];
    metricFocus: 'LIABILITY' | 'COMPLEXITY';
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'HARMONIZED': return '#10B981'; // emerald-500
        case 'AT_RISK': return '#F59E0B'; // amber-500
        case 'AUDIT_PENDING': return '#6366F1'; // indigo-500
        case 'NON_COMPLIANT': return '#EF4444'; // red-500
        default: return '#9CA3AF';
    }
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-xl z-50">
                <h4 className="text-white font-semibold text-lg">{data.name} ({data.id})</h4>
                <div className="mt-2 space-y-1">
                    <p className="text-slate-300 text-sm">Status: <span className="text-emerald-400 font-medium">{data.status}</span></p>
                    <p className="text-slate-300 text-sm">Liability: <span className="font-mono">${data.liability.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
                    <p className="text-slate-300 text-sm">Corp Tax Rate: {data.taxRate * 100}%</p>
                    <p className="text-slate-300 text-sm">Code Complexity: {data.complexity}/100</p>
                    <p className="text-slate-300 text-sm">High Risk Flags: <span className="text-rose-400 font-bold">{data.risk}</span></p>
                </div>
            </div>
        );
    }
    return null;
};

export const TaxJurisdictionMap: React.FC<MapProps> = ({ topologyData, metricFocus }) => {
    const flattenedNodes = useMemo(() => {
        return topologyData.map((region, i) =>
            region.nodes.map(n => ({ ...n, regionBase: i * 20 }))
        ).flat();
    }, [topologyData]);

    if (flattenedNodes.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-800/20 backdrop-blur-md rounded-2xl border border-slate-700">
                <div className="text-slate-400 font-medium animate-pulse">Initializing Jurisdiction Matrix...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-rose-500/5 pointer-events-none" />

            <div className="flex justify-between items-center mb-6 relative z-10">
                <div>
                    <h3 className="text-xl font-semibold text-white tracking-tight">Global Jurisdiction Topology</h3>
                    <p className="text-sm text-slate-400 mt-1">Multi-axis footprint analysis tracking rates vs complexity</p>
                </div>
                <div className="flex bg-slate-800/80 rounded-lg p-1 border border-slate-700/50">
                    <div className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 rounded-md">Harmonized</div>
                    <div className="px-3 py-1.5 text-xs font-medium text-amber-400">At Risk</div>
                    <div className="px-3 py-1.5 text-xs font-medium text-rose-400">Non-Compliant</div>
                </div>
            </div>

            <div className="flex-1 relative z-10 min-h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            type="number"
                            dataKey="complexity"
                            name="Complexity"
                            domain={[0, 100]}
                            stroke="#64748B"
                            tick={{ fill: '#94A3B8' }}
                            label={{ value: 'Jurisdictional Code Complexity (0-100)', position: 'insideBottom', fill: '#64748B', offset: -10 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="taxRate"
                            name="Corporate Tax"
                            domain={[0, 0.5]}
                            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                            stroke="#64748B"
                            tick={{ fill: '#94A3B8' }}
                            label={{ value: 'Corporate Base Rate', angle: -90, position: 'insideLeft', fill: '#64748B' }}
                        />
                        {metricFocus === 'LIABILITY' ? (
                            <ZAxis type="number" dataKey="liability" range={[100, 1000]} name="Exposure" />
                        ) : (
                            <ZAxis type="number" dataKey="risk" range={[100, 1000]} name="Risk Incidents" />
                        )}

                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <ReferenceLine y={0.25} stroke="#334155" strokeDasharray="3 3" label={{ position: 'right', value: 'Avg Rate', fill: '#64748B', fontSize: 12 }} />

                        <Scatter data={flattenedNodes} animationDuration={1500}>
                            {flattenedNodes.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={getStatusColor(entry.status)}
                                    className="transition-all duration-300 transform hover:scale-110 drop-shadow-xl"
                                    r={8}
                                />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
