import React from 'react';
import { Truck, Home, Plane, MapPin, Receipt, CheckCircle, Clock } from 'lucide-react';

export default function ExpatRelocationLog() {
    const steps = [
        {
            date: '2026-08-01',
            title: 'Visa Application Initiated',
            desc: 'HO-1191 L1-A Intracompany Transferee visa petition submitted to USCIS. Associated premium processing fee paid from relocation budget.',
            icon: <Plane className="h-4 w-4 text-cyan-400" />,
            status: 'completed',
            cost: '$2,500'
        },
        {
            date: '2026-08-15',
            title: 'Pre-Assignment Tax Briefing',
            desc: 'Mandatory cross-border tax briefing completed with PwC. Equalization policy signed and acknowledged by assignee.',
            icon: <Receipt className="h-4 w-4 text-emerald-400" />,
            status: 'completed',
            cost: '$800'
        },
        {
            date: '2026-09-02',
            title: 'Global Household Goods Shipment',
            desc: 'Container departed origin port. Tracking via Maersk assigned to profile. Insured up to $150k.',
            icon: <Truck className="h-4 w-4 text-indigo-400" />,
            status: 'active',
            cost: '$14,200'
        },
        {
            date: '2026-09-10',
            title: 'Temporary Corporate Housing',
            desc: 'Oakwood furnished apartment booked for 60 days pending permanent home search in host location.',
            icon: <Home className="h-4 w-4 text-yellow-400" />,
            status: 'pending',
            cost: '$8,500'
        },
        {
            date: '2026-09-12',
            title: 'Arrival & Destination Services',
            desc: 'Assignee arrives at host location. Settling-in services (bank account, social security equivalent setup) initiated.',
            icon: <MapPin className="h-4 w-4 text-rose-400" />,
            status: 'pending',
            cost: '$1,200'
        }
    ];

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full"></div>
            <div className="relative z-10 flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Truck className="h-5 w-5 text-cyan-500" />
                    Relocation Logistics Pipeline
                </h3>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-950 px-2 py-1 rounded border border-gray-800">
                    Log #REL-9042
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar relative z-10">
                <div className="absolute left-6 top-2 bottom-4 w-[2px] bg-gray-800 rounded-full z-0"></div>

                {steps.map((step, idx) => (
                    <div key={idx} className="relative z-10 pl-14 group">
                        <div className={`absolute left-3.5 top-1 h-5 w-5 rounded-full flex items-center justify-center transform -translate-x-1.5 border-4 border-gray-900 ${step.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                step.status === 'active' ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-pulse' : 'bg-gray-700'
                            }`}>
                            {step.status === 'completed' && <CheckCircle className="h-3 w-3 text-white" />}
                            {step.status === 'active' && <Clock className="h-3 w-3 text-white" />}
                            {step.status === 'pending' && <div className="h-2 w-2 rounded-full bg-gray-400"></div>}
                        </div>

                        <div className={`p-4 rounded-xl border transition-colors ${step.status === 'active' ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-black/50 border-gray-800 group-hover:border-gray-700'
                            }`}>
                            <div className="flex justify-between items-start mb-2 text-sm">
                                <div className="flex items-center gap-2 font-bold text-gray-200">
                                    <div className="p-1 bg-gray-800 rounded-md shadow-inner">{step.icon}</div>
                                    {step.title}
                                </div>
                                <span className="font-mono text-cyan-400 font-bold">{step.cost}</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">{step.desc}</p>
                            <div className="mt-3 text-[10px] uppercase font-black tracking-widest text-gray-600">
                                Target: {step.date}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center text-xs relative z-10">
                <span className="text-gray-500 font-bold uppercase tracking-widest">Total Sunk Costs</span>
                <span className="text-white font-mono font-bold text-lg">$27,200</span>
            </div>
        </div>
    );
}
