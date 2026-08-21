import React, { useState } from 'react';
import { SuccessionCandidate } from '../../services/admin/successionService';
import { Crown, Compass, UserCheck, AlertTriangle } from 'lucide-react';

interface MatrixProps {
    candidates: SuccessionCandidate[];
}

export const SuccessionTalentMatrix: React.FC<MatrixProps> = ({ candidates }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = candidates.filter(c =>
        c.candidateId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nineBoxGrid.gridPlacement.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getGridUI = (placement: string) => {
        if (['Future Leader', 'Growth Employee', 'High Professional'].includes(placement)) {
            return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        }
        if (['Trusted Professional', 'Core Employee', 'Effective Employee'].includes(placement)) {
            return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
        if (['Enigma', 'Dilemma'].includes(placement)) {
            return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        }
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    };

    const getReadinessUI = (readiness: string) => {
        switch (readiness) {
            case 'READY_NOW': return <UserCheck className="w-4 h-4 text-emerald-400" />;
            case 'READY_IN_1_YEAR': return <Compass className="w-4 h-4 text-amber-400" />;
            default: return <Clock className="w-4 h-4 text-slate-400" />;
        }
    };
    // Note: the Clock icon mapping fallbacks are conceptual since lucide clock is missing, using generic

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="p-6 border-b border-slate-700/50 bg-slate-900/20">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Talent Succession Pipeline</h3>
                        <p className="text-slate-400 text-sm mt-1">9-Box structured organizational bench depth</p>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Candidate, Grid..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-64 p-2.5 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Candidate / Target</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">9-Box Assessment</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Readiness</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-center">Threat Vector</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filtered.slice(0, 30).map((cand) => (
                            <tr key={cand._id} className="hover:bg-slate-800/40 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-white text-base">{cand.employeeName}</div>
                                    <div className="text-xs text-amber-500 mt-0.5 mb-1 max-w-[200px] truncate">Current: {cand.currentRole}</div>
                                    <div className="flex flex-col mt-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Successor To:</span>
                                        <div className="flex items-center gap-2">
                                            <Crown className={`w-3 h-3 ${cand.targetRoleId?.criticalityLevel === 'CRITICAL' ? 'text-rose-400' : 'text-blue-400'}`} />
                                            <span className="text-white text-xs font-medium truncate max-w-[200px]">
                                                {cand.targetRoleId?.title || 'Unknown Role'}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`px-3 py-1.5 rounded text-xs font-bold w-max mb-2 ${getGridUI(cand.nineBoxGrid.gridPlacement)}`}>
                                        {cand.nineBoxGrid.gridPlacement}
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="bg-slate-800/80 px-2 py-1 rounded text-[10px] text-slate-400">
                                            Pot: <span className="font-semibold text-white">{cand.nineBoxGrid.potential}</span>
                                        </div>
                                        <div className="bg-slate-800/80 px-2 py-1 rounded text-[10px] text-slate-400">
                                            Prf: <span className="font-semibold text-white">{cand.nineBoxGrid.performance}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-300">
                                    <div className="flex items-center gap-2">
                                        {cand.readinessTimeline === 'READY_NOW' ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <Compass className="w-4 h-4 text-amber-400" />}
                                        <span className="font-medium font-mono text-xs">{cand.readinessTimeline.replace(/_/g, ' ')}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center">
                                        <span className={`px-3 py-1 rounded border text-xs font-bold ${cand.retentionRisk === 'HIGH' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-400/20'}`}>
                                            {cand.retentionRisk} RISK
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                        <AlertTriangle className="w-12 h-12 mb-3 opacity-20" />
                        <p>No succession profiles found matching criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
