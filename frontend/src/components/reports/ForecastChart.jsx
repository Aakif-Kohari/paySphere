import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PropTypes from 'prop-types';

/**
 * Formats large currency numbers for chart axes (e.g., 1500000 -> 1.5M)
 */
const formatYAxis = (value) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ForecastChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-80 text-gray-500 dark:text-slate-400">
                No forecast data available. Generate a scenario to view projections.
            </div>
        );
    }

    const chartData = data.map(d => ({
        name: `${MONTH_NAMES[d.month - 1]} ${d.year}`,
        'Net Payroll': d.totalPayrollCost,
        'Employer Statutory': d.employerStatutoryCost,
        'Total Burn': d.totalPayrollCost + d.employerStatutoryCost,
        headcount: d.employeeCount
    }));

    return (
        <div className="w-full h-80 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorStatutory" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#f8fafc'
                        }}
                        formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="Net Payroll" stroke="#2563eb" fillOpacity={1} fill="url(#colorPayroll)" />
                    <Area type="monotone" dataKey="Employer Statutory" stroke="#10b981" fillOpacity={1} fill="url(#colorStatutory)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

ForecastChart.propTypes = {
    data: PropTypes.arrayOf(PropTypes.object)
};
