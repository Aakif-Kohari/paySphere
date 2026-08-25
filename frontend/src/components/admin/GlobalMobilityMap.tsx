import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Globe2, FileSearch, Plane, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';

interface CorridorMetric {
    country: string;
    activeExpats: number;
    totalTaxLiability: number;
    avgTaxLiabilityPerExpat: number;
}

interface Props {
    corridors: CorridorMetric[];
    loading: boolean;
}

export default function GlobalMobilityMap({ corridors, loading }: Props) {

    const barData = useMemo(() => {
        return corridors.slice(0, 8).map(c => ({
            country: c.country,
            activeAmount: c.activeExpats,
            liability: Math.floor(c.totalTaxLiability)
        }));
    }, [corridors]);

    const scatterData = useMemo(() => {
        return corridors.map(c => ({
            ...c,
            displayAvg: Math.floor(c.avgTaxLiabilityPerExpat)
        }));
    }, [corridors]);

    if (loading) {
        return (
            <div className="w-full h-[450px] bg-indigo-950/20 border border-indigo-900/30 rounded-3xl animate-pulse flex flex-col items-center justify-center">
                <Globe2 className="h-12 w-12 text-teal-500 animate-spin mb-4" />
                <p className="text-teal-500/50 font-bold uppercase tracking-widest text-xs">Simulating Global Corridors...</p>
            </div>
        );
    }

    if (corridors.length === 0) {
        return (
            <div className="w-full h-full min-h-[450px] flex flex-col items-center justify-center bg-gray-900 border border-gray-800 rounded-3xl text-gray-500 text-sm">
                <Plane className="h-12 w-12 mb-3 opacity-20" />
                No active border crossing assignments found.
            </div>
        );
    }

    return (
        <div className="bg-gray-900/40 backdrop-blur-3xl rounded-3xl border border-gray-800/80 p-6 flex flex-col xl:flex-row gap-6 shadow-[0_0_50px_rgba(45,212,191,0.05)] w-full">

            <div className="flex-1 min-h-[450px]">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Globe2 className="text-teal-500 h-6 w-6" />
                        Global Operations Vector Model
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Measuring active expats mapping vs corporate equalization tax overhead.
                    </p>
                </div>

                <div className="h-[380px] w-full bg-black/40 p-4 border border-gray-800 rounded-2xl shadow-inner relative">

                    <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-500/5 via-black/0 to-transparent pointer-events-none"></div>

                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                            <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(val) => `$${(val / 1000)}k`} />
                            <YAxis dataKey="country" type="category" stroke="#6b7280" tick={{ fill: '#d1d5db', fontSize: 13, fontWeight: 'bold' }} width={120} />
                            <Tooltip
                                cursor={{ fill: '#1f2937', opacity: 0.4 }}
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                                itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                            />
                            <Legend />
                            <Bar name="Corporate Tax Liability ($)" dataKey="liability" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={25} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="w-full xl:w-[450px] bg-black/50 border border-gray-800 rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-2xl">
                <h4 className="text-[11px] text-gray-400 uppercase tracking-widest font-black mb-3 border-b border-gray-800 pb-3 flex items-center gap-2">
                    <FileSearch className="h-4 w-4 text-cyan-500" />
                    Density vs Cost Dispersion (Per Country)
                </h4>

                <div className="flex-1 mt-2 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis type="number" dataKey="activeExpats" name="Expats" stroke="#6b7280" tick={{ fill: '#9ca3af' }}>
                                <Label value="Headcount" position="insideBottom" offset={-10} fill="#6b7280" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                            </XAxis>
                            <YAxis type="number" dataKey="displayAvg" name="Avg Liability" stroke="#6b7280" tick={{ fill: '#9ca3af' }} tickFormatter={(val) => `$${(val / 1000)}k`}>
                                <Label value="Avg Tax Liability" angle={-90} position="insideLeft" fill="#6b7280" style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                            </YAxis>
                            <ZAxis type="category" dataKey="country" name="Host" />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#14b8a6', borderRadius: '12px', padding: '15px' }}
                                itemStyle={{ color: '#ecfeff', fontWeight: 'bold' }}
                            />
                            <Scatter name="Corridors" data={scatterData} fill="#14b8a6">
                                {scatterData.map((entry, index) => (
                                    <cell key={`cell-${index}`} fill={entry.displayAvg > 25000 ? '#ef4444' : '#14b8a6'} opacity={0.8} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                <div className="absolute top-4 right-4 bg-gray-900 border border-gray-800 rounded p-2 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Red = Danger Zone (&gt;$25k Avg/Expat)</span>
                </div>
            </div>

        </div>
    );
}
