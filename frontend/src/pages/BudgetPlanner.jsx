import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';
import api from '../services/api';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalculateIcon from '@mui/icons-material/Calculate';
import ForecastChart from '../components/reports/ForecastChart';
import { formatCurrency } from '../utils/currency';

export default function BudgetPlanner() {
    const [scenario, setScenario] = useState({
        name: 'Baseline Projection 2026',
        companyWideIncrementPercent: 8,
        incrementEffectiveMonth: 4, // April
        includeEmployerPF: true,
        includeEmployerESI: true,
        hiringPlan: [{ department: 'Engineering', estimatedMonthlySalary: 80000, hireMonth: 3, headcount: 2 }]
    });

    const [projections, setProjections] = useState([]);
    const [totalCost, setTotalCost] = useState(0);
    const [loading, setLoading] = useState(false);
    const currency = localStorage.getItem('currency') || 'INR';

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await api.post('/api/forecasts/generate', {
                ...scenario,
                startMonth: new Date().getMonth() + 1,
                startYear: new Date().getFullYear()
            });
            setProjections(res.data.forecast.projectedMonthlyCashflow);
            setTotalCost(res.data.forecast.totalAnnualProjectedCost);
        } catch (err) {
            alert('Failed to generate forecast');
        } finally {
            setLoading(false);
        }
    };

    const updateHiringPlan = (index, field, value) => {
        const newPlan = [...scenario.hiringPlan];
        newPlan[index] = { ...newPlan[index], [field]: value };
        setScenario({ ...scenario, hiringPlan: newPlan });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
            <Sidebar activePage="Budget Planner" setActivePage={() => { }} isSidebarOpen={false} onClose={() => { }} />
            <div className="lg:ml-64">
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUpIcon /> Payroll Budget & Scenario Planner
                    </h1>
                    <ThemeToggle />
                </div>

                <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Controls Panel */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 space-y-4">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Scenario Assumptions</h2>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Scenario Name</label>
                                <input type="text" value={scenario.name} onChange={e => setScenario({ ...scenario, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
                                    Company-Wide Increment: <span className="text-brand-600">{scenario.companyWideIncrementPercent}%</span>
                                </label>
                                <input type="range" min="0" max="30" step="0.5" value={scenario.companyWideIncrementPercent}
                                    onChange={e => setScenario({ ...scenario, companyWideIncrementPercent: Number(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-brand-600" />
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                                    <input type="checkbox" checked={scenario.includeEmployerPF} onChange={e => setScenario({ ...scenario, includeEmployerPF: e.target.checked })} className="rounded text-brand-600 focus:ring-brand-500" />
                                    Include Employer PF (12%)
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                                    <input type="checkbox" checked={scenario.includeEmployerESI} onChange={e => setScenario({ ...scenario, includeEmployerESI: e.target.checked })} className="rounded text-brand-600 focus:ring-brand-500" />
                                    Include Employer ESI
                                </label>
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Projected Hiring (Ghost Employees)</h3>
                                {scenario.hiringPlan.map((h, i) => (
                                    <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                                        <input type="text" placeholder="Dept" value={h.department} onChange={e => updateHiringPlan(i, 'department', e.target.value)} className="px-2 py-1 text-xs rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                        <input type="number" placeholder="Salary" value={h.estimatedMonthlySalary} onChange={e => updateHiringPlan(i, 'estimatedMonthlySalary', Number(e.target.value))} className="px-2 py-1 text-xs rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                        <input type="number" placeholder="Count" value={h.headcount} onChange={e => updateHiringPlan(i, 'headcount', Number(e.target.value))} className="px-2 py-1 text-xs rounded border dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                                    </div>
                                ))}
                            </div>

                            <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 flex items-center justify-center gap-2 disabled:opacity-50">
                                <CalculateIcon fontSize="small" /> {loading ? 'Calculating...' : 'Generate 12-Month Forecast'}
                            </button>
                        </div>
                    </div>

                    {/* Chart & Results Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        {totalCost > 0 && (
                            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 p-6 rounded-xl">
                                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200 uppercase tracking-wider">Total Projected Annual Cash Outflow</p>
                                <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 mt-1">{formatCurrency(totalCost, currency)}</p>
                            </div>
                        )}

                        <ForecastChart data={projections} />

                        {projections.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Month</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Headcount</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Net Payroll</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Statutory</th>
                                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Total Burn</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                                        {projections.map((p, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">{p.month}/{p.year}</td>
                                                <td className="px-4 py-2 text-right text-gray-700 dark:text-slate-300">{p.employeeCount}</td>
                                                <td className="px-4 py-2 text-right font-mono text-gray-700 dark:text-slate-300">{formatCurrency(p.totalPayrollCost, currency)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-gray-700 dark:text-slate-300">{formatCurrency(p.employerStatutoryCost, currency)}</td>
                                                <td className="px-4 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(p.totalPayrollCost + p.employerStatutoryCost, currency)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
