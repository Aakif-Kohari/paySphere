import React, { useState } from 'react';
import { VisaSponsorship } from '../../services/legal/immigrationService';
import { Clock, ShieldAlert, Plane, FileCheck } from 'lucide-react';

interface TrackerProps {
    sponsorships: VisaSponsorship[];
}

export const VisaSponsorshipTracker: React.FC<TrackerProps> = ({ sponsorships }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = sponsorships.filter(s =>
        s.sponsorshipId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.workerId.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.workerId.hostCountry.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRiskUI = (level: string) => {
        switch (level) {
            case 'LOW': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'MODERATE': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'HIGH': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'SEVERE': return 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
        }
    };

    return (
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="p-6 border-b border-slate-700/50 bg-slate-900/20">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Expatriate Visa Sponsorships</h3>
                        <p className="text-slate-400 text-sm mt-1">Immigration case files ordered by statutory expiry date</p>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by Expat, Country, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-white placeholder-slate-400 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-64 p-2.5 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Worker Info</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Assignment Route</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Visa Type</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Expiration</th>
                            <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-center">Threat Vector</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filtered.map((spons) => (
                            <tr key={spons._id} className="hover:bg-slate-800/40 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-white">{spons.workerId.fullName}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{spons.workerId.workerId}</div>
                                    <div className="text-xs text-indigo-400 mt-1">{spons.workerId.jobTitle} - {spons.workerId.department}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-300 text-xs truncate max-w-[100px]">{spons.workerId.homeCountry}</span>
                                        <Plane className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                        <span className="text-white font-medium text-xs">{spons.workerId.hostCountry}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-cyan-400 tracking-wide text-xs">{spons.visaType}</div>
                                    <div className="text-xs text-slate-500 mt-1">{spons.sponsorshipId}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`font-medium ${new Date(spons.expirationDate) < new Date() ? 'text-rose-400 line-through' : 'text-slate-200'}`}>
                                        {new Date(spons.expirationDate).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Renew by {new Date(spons.renewalFilingDeadline).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center">
                                        <span className={`flex items-center justify-center gap-1.5 px-3 py-1 rounded border text-xs font-bold w-24 ${getRiskUI(spons.riskLevel)}`}>
                                            {spons.riskLevel === 'SEVERE' ? <ShieldAlert className="w-3.5 h-3.5" /> : <FileCheck className="w-3.5 h-3.5" />}
                                            {spons.riskLevel}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
