import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, ComposedChart, Area
} from 'recharts';
import { Layers, Zap, TrendingDown, ArrowDownToLine, Flame } from 'lucide-react';
import treasuryService from '../../services/treasury/treasuryService';

const LiquidityForecastChart: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCurrencies, setActiveCurrencies] = useState<string[]>(['usdOutflow', 'inrOutflow']);
    const [forecastSummary, setForecastSummary] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [chartResp, forecastResp] = await Promise.all([
                treasuryService.getLiquidityChartData(),
                treasuryService.getLiquidityForecast()
            ]);
            setData(chartResp?.data || []);
            setForecastSummary(forecastResp?.data || {});
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCurrency = (key: string) => {
        setActiveCurrencies(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl text-white">
                    <p className="font-bold text-lg mb-3 border-b border-slate-700 pb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400" /> {label}
                    </p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6 mb-1 font-medium text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-md shadow-inner" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-300 capitalize">{entry.name.replace('Outflow', ' Outflow')}:</span>
                            </div>
                            <span className="font-bold tracking-wide font-mono">
                                ${entry.value.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">

            {/* 90-Day Trajectory Header */}
            <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-2xl shadow-xl p-8 border border-emerald-500/20 text-white relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <h2 className="text-2xl font-black flex items-center gap-3 mb-2">
                    <Layers className="text-emerald-400 w-8 h-8" /> 90-Day Liquidity Trajectory (Beta)
                </h2>
                <p className="text-emerald-100/70 max-w-2xl">
                    Visualizing projected payroll outflows against aggregated corporate liquidity buffers. Trajectories are smoothed using proprietary machine learning models applied across cross-currency balances.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                {/* Main Chart Area */}
                <div className="xl:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    {/* Chart Controls */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-700">
                        <span className="text-sm font-bold text-slate-500 uppercase">Toggles:</span>
                        {[
                            { k: 'usdOutflow', label: 'USD Outflow', c: '#3b82f6' },
                            { k: 'eurOutflow', label: 'EUR Outflow', c: '#a855f7' },
                            { k: 'gbpOutflow', label: 'GBP Outflow', c: '#f43f5e' },
                            { k: 'inrOutflow', label: 'INR Outflow (Normalized)', c: '#eab308' },
                        ].map(series => (
                            <button
                                key={series.k}
                                onClick={() => toggleCurrency(series.k)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${activeCurrencies.includes(series.k)
                                        ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-500 text-slate-800 dark:text-white'
                                        : 'bg-transparent border-slate-200 dark:border-slate-700 pb-2 text-slate-400 opacity-60'
                                    }`}
                            >
                                <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: series.c }}></span>
                                {series.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-full h-[500px]">
                        {loading ? (
                            <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse flex items-center justify-center">Loading Forecast Engine...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} margin={{ top: 20, right: 0, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorBuffer" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<CustomTooltip />} />

                                    <Area
                                        type="monotone"
                                        dataKey="liquidityBuffer"
                                        name="Master Liquidity Buffer"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fill="url(#colorBuffer)"
                                    />

                                    {activeCurrencies.includes('usdOutflow') && (
                                        <Line type="basis" dataKey="usdOutflow" name="USD" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                    )}
                                    {activeCurrencies.includes('eurOutflow') && (
                                        <Line type="basis" dataKey="eurOutflow" name="EUR" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                    )}
                                    {activeCurrencies.includes('gbpOutflow') && (
                                        <Line type="basis" dataKey="gbpOutflow" name="GBP" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                    )}
                                    {activeCurrencies.includes('inrOutflow') && (
                                        <Line type="basis" dataKey="inrOutflow" name="INR" stroke="#eab308" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Forecast Risks sidebar */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 h-full flex flex-col">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <Flame className="w-6 h-6 text-orange-500" /> Hotspots & Escalations
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                            {loading ? (
                                [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse"></div>)
                            ) : forecastSummary?.currencyProjections?.map((proj: any) => (
                                <div key={proj.currency} className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-300 transition-colors">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-lg">{proj.currency} Portfolio</span>
                                        <span className={`text-xs px-2 py-1 font-bold rounded capitalize ${proj.riskLevel === 'CRITICAL_SHORTFALL' ? 'bg-red-100 text-red-600' :
                                                proj.riskLevel === 'DEFICIT_WARNING' ? 'bg-amber-100 text-amber-600' :
                                                    'bg-emerald-100 text-emerald-600'
                                            }`}>
                                            {proj.riskLevel.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="flex items-end justify-between font-mono text-sm text-slate-500">
                                        <div>
                                            <div className="flex items-center gap-1 text-red-500 mb-1"><TrendingDown className="w-3 h-3" /> -{(proj.projectedPayrollOutflow).toLocaleString()}</div>
                                            <div className="flex items-center gap-1 text-emerald-500"><ArrowDownToLine className="w-3 h-3" /> +{(proj.currentBalance).toLocaleString()}</div>
                                        </div>
                                        <div className={`font-bold ${proj.netPosition < 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                                            EOM: {proj.netPosition.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LiquidityForecastChart;
