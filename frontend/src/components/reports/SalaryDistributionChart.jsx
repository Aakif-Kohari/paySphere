import { useAppStore } from '../../store/useAppStore';
import {
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { createChartTooltip, formatTooltipValue } from './chartTooltip';



const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
];

export default function SalaryDistributionChart({ data = [] }) {
  const themeMode = useAppStore((state) => state.themeMode);
  const isDark = themeMode === 'dark';
  const tooltipContent = createChartTooltip({
    isDark,
    formatValue: formatTooltipValue,
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">
        Salary Distribution
      </h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              label
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              cursor={{ fill: isDark ? 'rgba(30, 41, 59, 0.12)' : 'rgba(148, 163, 184, 0.16)' }}
              content={tooltipContent}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
