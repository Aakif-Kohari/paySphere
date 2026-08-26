import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Flame, BrainCircuit, Activity, HeartPulse } from 'lucide-react';

interface DepartmentData {
    department: string;
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    avgScore: number;
    avgHours: number;
}

interface Props {
    data: DepartmentData[];
    loading: boolean;
}

export default function BurnoutHeatmap({ data, loading }: Props) {
    // Format data for Radar Chart
    const radarData = useMemo(() => {
        return data.map(d => ({
            subject: d.department,
            Critical: Math.floor((d.critical / d.total) * 100),
            High: Math.floor((d.high / d.total) * 100),
            Moderate: Math.floor((d.moderate / d.total) * 100),
            fullMark: 100
        }));
    }, [data]);

    if (loading) {
        return (
            <div className="w-full h-96 bg-gray-900 border border-gray-800 rounded-3xl animate-pulse flex items-center justify-center shadow-xl">
                <Flame className="h-10 w-10 text-orange-500 animate-bounce" />
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-black rounded-3xl border border-gray-800 p-6 flex flex-col xl:flex-row gap-6 shadow-2xl relative overflow-hidden">

            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-b from-orange-600/10 to-transparent blur-3xl rounded-full transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

            {/* Main Heatmap Stacked Area */}
            <div className="flex-1 shrink-0 relative z-10 w-full min-h-[400px]">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-orange-500 h-6 w-6" />
                        Organizational Burnout Topology
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Tracking critical structural workload density and physiological sentiment drain across macro-divisions.
                    </p>
                </div>

                <div className="h-[350px] w-full bg-black/40 p-4 border border-gray-800 rounded-2xl shadow-inner backdrop-blur-sm">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                                </linearGradient>
                                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                                </linearGradient>
                                <linearGradient id="colorMod" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#eab308" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis dataKey="department" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                                itemStyle={{ color: '#e5e7eb', fontSize: '13px' }}
                                labelStyle={{ fontWeight: 'bold', color: '#f3f4f6', marginBottom: '8px' }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle" />
                            <Area type="monotone" name="Moderate Risk (Headcount)" dataKey="moderate" stackId="1" stroke="#eab308" fill="url(#colorMod)" />
                            <Area type="monotone" name="High Risk" dataKey="high" stackId="1" stroke="#f97316" fill="url(#colorHigh)" />
                            <Area type="monotone" name="Critical Risk" dataKey="critical" stackId="1" stroke="#ef4444" fill="url(#colorCritical)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Radar Matrix Panel */}
            <div className="w-full xl:w-[450px] bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl relative z-10 hidden md:flex flex-col">
                <h4 className="text-gray-300 font-bold uppercase tracking-wider text-xs border-b border-gray-800 pb-3 mb-4 flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-emerald-400" />
                    AI Component Vector (Severity %)
                </h4>

                <div className="flex-1 relative bg-black/20 rounded-xl">
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#374151" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280' }} />
                            <Radar name="Critical Saturation" dataKey="Critical" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                            <Radar name="High Saturation" dataKey="High" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
                            <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between text-xs text-gray-500 px-2">
                        <span>Total Divisions Tracked: <strong className="text-white ml-1">{data.length}</strong></span>
                        <span className="flex items-center gap-1"><HeartPulse className="h-3 w-3 text-red-500" /> Real-time</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
