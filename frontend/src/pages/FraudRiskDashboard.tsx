import React, { useEffect, useState } from 'react';
import { FraudRiskService } from '../services/FraudRiskService';
import { ComprehensiveFraudPayload } from '../types/fraudRisk';
import { RiskMatrix } from '../components/fraud/RiskMatrix';
import { FraudAlertsTimeline } from '../components/fraud/FraudAlertsTimeline';
import { IPBlocklistForm } from '../components/fraud/IPBlocklistForm';
import {
    ShieldCheck, AlertTriangle, Crosshair, Map, ShieldHalf, Play, Bell
} from 'lucide-react';

export default function FraudRiskDashboard() {
    const [data, setData] = useState<ComprehensiveFraudPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        FraudRiskService.getDashboardData().then(d => {
            setData(d);
            setLoading(false);
        });
    }, []);

    const topCard = (title: string, value: string | number, desc: string, icon: any, color: string) => {
        const Icon = icon;
        return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden group">
                {/* Decorative fade behind icon */}
                <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl ${color.replace('text', 'bg')}`} />

                <div className={`p-3 rounded-xl mb-4 w-min ${color.replace('text', 'bg').replace('500', '100')} dark:${color.replace('text', 'bg').replace('500', '500/20')}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h4 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</h4>
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1 mb-2">{value}</div>
                <p className="text-sm font-medium text-gray-400">{desc}</p>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 xl:p-10 font-sans">
            <div className="max-w-[1700px] mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-gradient-to-br from-rose-500 to-orange-500 p-3 rounded-xl text-white shadow-lg shadow-rose-500/30">
                                <ShieldHalf className="w-8 h-8" />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                                Fraud & Risk Command Center
                            </h1>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-3 max-w-2xl leading-relaxed">
                            Real-time monitoring of behavioral anomalies, velocity metrics, and AI-driven predictive risk scoring across all international gateways.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Play className="w-4 h-4" /> Run Simulation
                        </button>
                        <button className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-2.5 rounded-xl font-semibold shadow-xl shadow-gray-900/10 hover:opacity-90 transition-opacity">
                            <Bell className="w-4 h-4" /> Alert Rules
                        </button>
                    </div>
                </div>

                {/* Global KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {topCard('Critical Threats (24h)', data?.metrics.criticalAlerts24h || 0, 'Requires immediate action', AlertTriangle, 'text-rose-500')}
                    {topCard('Active Investigations', data?.metrics.activeInvestigations || 0, 'Tickets assigned to agents', Crosshair, 'text-orange-500')}
                    {topCard('Avg Resolution Time', `${data?.metrics.avgResolutionMinutes || 0} min`, '-12% improved SLA', Play, 'text-emerald-500')}
                    {topCard('Top Risk Vector', data?.metrics.topRiskVector.replace('_', ' ') || '-', 'Global behavioral trend', Map, 'text-indigo-500')}
                </div>

                {/* Dense Dashboard Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8">

                    {/* Left Column: Timeline & Alerts (Spans 7 cols) */}
                    <div className="xl:col-span-7 flex flex-col gap-8">
                        <FraudAlertsTimeline alerts={data?.alerts || []} />
                    </div>

                    {/* Right Column: Deep Matrix, Forms, Rules (Spans 5 cols) */}
                    <div className="xl:col-span-5 flex flex-col gap-8">
                        {/* Heatmap Matrix */}
                        <div className="h-[450px]">
                            <RiskMatrix matrix={data?.matrix || []} loading={loading} />
                        </div>

                        {/* Form Interactor */}
                        <div className="h-[500px]">
                            <IPBlocklistForm />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
