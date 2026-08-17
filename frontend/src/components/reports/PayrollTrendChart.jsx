import { useAppStore } from '../../store/useAppStore';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { createChartTooltip, formatTooltipValue } from './chartTooltip';

export default function PayrollTrendChart({ data = [] }) {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const tooltipContent = createChartTooltip({
    isDark,
    formatValue: formatTooltipValue,
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        Monthly Payroll Trend
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="month" />

            <YAxis />

            <Tooltip
              cursor={{ fill: isDark ? 'rgba(30, 41, 59, 0.12)' : 'rgba(148, 163, 184, 0.16)' }}
              content={tooltipContent}
            />

            <Line
              type="monotone"
              dataKey="payroll"
              stroke="#2563eb"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
