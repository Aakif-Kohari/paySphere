import { useState } from 'react';
import { Target, Users, Search, Play, Plus, MapPin, Award } from 'lucide-react';

export interface TalentProfile {
    employeeId: string;
    performanceScore: number;
    potentialScore: number;
    criticality: string;
    readinessDelay: number;
    currentRole: string;
}

export interface MatrixCategory {
    [key: string]: TalentProfile[];
}

interface Props {
    matrix: MatrixCategory;
    loading: boolean;
}

export default function SuccessionTalentMatrix({ matrix, loading }: Props) {
    const [selectedCell, setSelectedCell] = useState<string | null>(null);

    const GRID_CATEGORIES = [
        { key: 'Consistent Star', title: 'Consistent Stars', bg: 'bg-emerald-900/40', border: 'border-emerald-500/50', text: 'text-emerald-400', pot: 'High', perf: 'High' },
        { key: 'High Professional', title: 'High Professionals', bg: 'bg-teal-900/30', border: 'border-teal-500/40', text: 'text-teal-400', pot: 'Medium', perf: 'High' },
        { key: 'Solid Performer', title: 'Solid Performers', bg: 'bg-cyan-900/20', border: 'border-cyan-500/30', text: 'text-cyan-400', pot: 'Low', perf: 'High' },
        { key: 'Future Star', title: 'Future Stars', bg: 'bg-indigo-900/30', border: 'border-indigo-500/40', text: 'text-indigo-400', pot: 'High', perf: 'Medium' },
        { key: 'Key Player', title: 'Key Players', bg: 'bg-blue-900/20', border: 'border-blue-500/30', text: 'text-blue-400', pot: 'Medium', perf: 'Medium' },
        { key: 'Effective Performer', title: 'Effective Performers', bg: 'bg-gray-800/50', border: 'border-gray-600/50', text: 'text-gray-300', pot: 'Low', perf: 'Medium' },
        { key: 'Rough Diamond', title: 'Rough Diamonds', bg: 'bg-purple-900/20', border: 'border-purple-500/30', text: 'text-purple-400', pot: 'High', perf: 'Low' },
        { key: 'Inconsistent Player', title: 'Inconsistent Players', bg: 'bg-orange-900/20', border: 'border-orange-500/30', text: 'text-orange-400', pot: 'Medium', perf: 'Low' },
        { key: 'Underperformer', title: 'Underperformers', bg: 'bg-red-900/20', border: 'border-red-500/30', text: 'text-red-400', pot: 'Low', perf: 'Low' },
    ];

    if (loading) {
        return (
            <div className="grid grid-cols-3 gap-2 w-full max-w-4xl mx-auto h-[600px] animate-pulse">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-xl border border-gray-700/50" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6 w-full max-w-7xl mx-auto">

            {/* 9-Box Grid Layout */}
            <div className="flex-1 w-full bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-2xl relative">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Target className="text-emerald-400 h-5 w-5" />
                    Enterprise 9-Box Talent Matrix
                </h3>

                {/* Labels */}
                <div className="absolute left-[-20px] top-1/2 -rotate-90 transform -translate-y-1/2 text-gray-500 font-bold tracking-widest text-xs uppercase hidden xl:block">
                    Potential Score
                </div>
                <div className="absolute bottom-[0px] left-1/2 transform -translate-x-1/2 text-gray-500 font-bold tracking-widest text-xs uppercase hidden xl:block">
                    Performance Score
                </div>

                <div className="grid grid-cols-3 grid-rows-3 gap-3 w-full h-[650px] relative z-10 p-4 xl:p-8">
                    {GRID_CATEGORIES.map((cat, idx) => {
                        const employees = matrix[cat.key] || [];
                        const isSelected = selectedCell === cat.key;

                        return (
                            <div
                                key={cat.key}
                                onClick={() => setSelectedCell(cat.key)}
                                className={`relative flex flex-col overflow-hidden rounded-xl border transition-all cursor-pointer hover:shadow-lg ${cat.bg} ${cat.border} ${isSelected ? 'ring-2 ring-white scale-[1.02] z-20 shadow-black/50' : 'hover:scale-[1.01]'}`}
                            >
                                {/* Header */}
                                <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/20">
                                    <span className={`text-xs sm:text-sm font-semibold truncate ${cat.text}`}>{cat.title}</span>
                                    <div className="flex items-center justify-center bg-black/40 rounded-full h-6 w-6 text-xs text-white">
                                        {employees.length}
                                    </div>
                                </div>

                                {/* Body (Avatars/Initials) */}
                                <div className="flex-1 p-3 flex flex-wrap gap-2 content-start overflow-hidden relative">
                                    {employees.slice(0, 8).map(emp => (
                                        <div
                                            key={emp.employeeId}
                                            title={`${emp.employeeId} - ${emp.currentRole}`}
                                            className="h-8 w-8 rounded-full bg-gray-950 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300 shadow hover:border-white transition-colors"
                                        >
                                            {emp.employeeId.slice(-3)}
                                        </div>
                                    ))}
                                    {employees.length > 8 && (
                                        <div className="h-8 w-8 rounded-full bg-gray-800/80 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                            +{employees.length - 8}
                                        </div>
                                    )}

                                    {/* Empty state hint */}
                                    {employees.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                            <Users className="h-10 w-10 text-white" />
                                        </div>
                                    )}
                                </div>

                                {/* Grid Position Labels */}
                                <span className="absolute bottom-1 right-2 text-[8px] uppercase tracking-wider text-white/30 hidden sm:block">
                                    {cat.pot.slice(0, 1)}/P &middot; {cat.perf.slice(0, 1)}/P
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Details Side Panel */}
            <div className="w-full xl:w-[400px] bg-gray-950/80 backdrop-blur-md rounded-2xl border border-gray-800 p-5 shadow-2xl flex flex-col h-full min-h-[600px]">
                {selectedCell ? (
                    <>
                        <div className="flex justify-between items-center border-b border-gray-800 pb-4 mb-4">
                            <div>
                                <h4 className="text-lg font-bold text-white">{selectedCell}</h4>
                                <p className="text-sm text-gray-500">{matrix[selectedCell]?.length || 0} Employees in this pool</p>
                            </div>
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="text-gray-500 hover:text-white transition-colors p-1"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {(matrix[selectedCell] || []).length === 0 ? (
                                <div className="text-center py-10 text-gray-500">
                                    No talent matches this quadrant.
                                </div>
                            ) : (
                                (matrix[selectedCell] || []).map((emp) => (
                                    <div key={emp.employeeId} className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:border-gray-700 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                                                    {emp.employeeId.slice(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-100">{emp.employeeId}</p>
                                                    <p className="text-xs text-indigo-400 line-clamp-1">{emp.currentRole}</p>
                                                </div>
                                            </div>
                                            {emp.criticality === 'CRITICAL' && (
                                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                    CRITICAL
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-800/50">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Perf</p>
                                                <p className="text-sm text-white font-semibold">{emp.performanceScore}/5</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Pot</p>
                                                <p className="text-sm text-white font-semibold">{emp.potentialScore}/5</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 flex items-center justify-between">
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Award className="h-3 w-3" /> Readiness: {emp.readinessDelay}mo
                                            </span>
                                            <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Action <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 border-t border-gray-800 mt-auto">
                            <button className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg text-sm border border-gray-700 transition-colors flex justify-center items-center gap-2">
                                <Search className="h-4 w-4" /> Export Selection
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col justify-center items-center text-center p-8">
                        <div className="h-16 w-16 bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800 mb-6 shadow-xl text-emerald-500/40 rotate-12">
                            <Search className="h-8 w-8" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-300 mb-2">Select a Matrix Cell</h4>
                        <p className="text-sm text-gray-500">
                            Click on any quadrant within the 9-box grid to deeply analyze the talent pool, view individual performance data, and plan executive succession transitions.
                        </p>
                    </div>
                )}
            </div>

        </div>
    );
}
