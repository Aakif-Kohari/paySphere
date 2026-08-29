import { useAppStore } from '../../store/useAppStore';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { formatCurrency } from '../../utils/currency';
import { createChartTooltip } from './chartTooltip';

export default function DepartmentChart({ data = [] }) {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const tooltipContent = createChartTooltip({
    isDark,
    formatValue: (value) => formatCurrency(Number(value), localStorage.getItem('currency') || 'INR'),
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        Payroll by Department
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="department" />

            <YAxis />

            <Tooltip
              cursor={{ fill: isDark ? 'rgba(30, 41, 59, 0.12)' : 'rgba(148, 163, 184, 0.16)' }}
              content={tooltipContent}
            />

            <Bar
              dataKey="payroll"
              fill="#2563eb"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
