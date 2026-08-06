import { useSelector } from 'react-redux';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { createChartTooltip, formatTooltipValue } from './chartTooltip';



export default function OvertimeChart({ data }) {
  const themeMode = useSelector((state) => state.ui.themeMode);
  const isDark = themeMode === 'dark';
  const tooltipContent = createChartTooltip({
    isDark,
    formatValue: formatTooltipValue,
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        Overtime vs Deductions
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="month" />

            <YAxis />

            <Tooltip
              cursor={{ fill: isDark ? 'rgba(30, 41, 59, 0.12)' : 'rgba(148, 163, 184, 0.16)' }}
              content={tooltipContent}
            />

            <Legend />

            <Bar
              dataKey="overtime"
              fill="#2563eb"
              radius={[6, 6, 0, 0]}
            />

            <Bar
              dataKey="deductions"
              fill="#ef4444"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}