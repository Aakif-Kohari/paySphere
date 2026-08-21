/* ═══════════════════════════════════════════════════════════════
   HeadcountTrendChart — Stacked area chart showing headcount
   trends by department over time.
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import type { HeadcountSnapshot } from '../../services/workforce/workforceService';
import { formatNumber } from '../../services/workforce/workforceService';

/* ─────────────── Mini Sparkline ────────────────── */

function Sparkline({ data, color = '#10b981', height = 32, width = 100 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return <div style={{ width, height }} className="bg-slate-800/50 rounded" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={((data.length - 1) / (data.length - 1)) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2} r="2" fill={color} />
    </svg>
  );
}

/* ─────────────── Main Component ────────────────── */

interface HeadcountTrendChartProps {
  data: HeadcountSnapshot[];
  title?: string;
}

const DEPT_COLORS: Record<string, string> = {
  engineering: '#6366f1',
  product: '#8b5cf6',
  sales: '#f59e0b',
  operations: '#ef4444',
  hr: '#10b981',
  finance: '#3b82f6',
  marketing: '#ec4899',
  customerSuccess: '#14b8a6',
};

const DEPT_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  product: 'Product',
  sales: 'Sales',
  operations: 'Operations',
  hr: 'HR',
  finance: 'Finance',
  marketing: 'Marketing',
  customerSuccess: 'CS',
};

export default function HeadcountTrendChart({ data, title = 'Headcount Trend' }: HeadcountTrendChartProps) {
  const [expanded, setExpanded] = useState(true);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);

  const departments = Object.keys(DEPT_COLORS);
  const latestSnapshot = data[data.length - 1];
  const earliestSnapshot = data[0];
  const totalGrowth = latestSnapshot.total - earliestSnapshot.total;
  const growthPct = Math.round((totalGrowth / earliestSnapshot.total) * 100);

  // SVG chart dimensions
  const chartWidth = 600;
  const chartHeight = 160;
  const padding = { top: 10, right: 10, bottom: 25, left: 45 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const maxTotal = Math.max(...data.map((d) => d.total));

  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => padding.top + innerH - (v / (maxTotal * 1.1)) * innerH;

  // Build stacked area paths per department
  const stackedPaths = useMemo(() => {
    return departments.map((dept) => {
      const points: string[] = [];
      data.forEach((d, i) => {
        const stackBelow = departments
          .filter((dep) => departments.indexOf(dep) < departments.indexOf(dept))
          .reduce((sum, dep) => sum + (d as Record<string, number>)[dep], 0);
        const val = (d as Record<string, number>)[dept];
        const top = stackBelow + val;
        const x = xScale(i);
        const y = yScale(top);
        points.push(`${x},${y}`);
      });
      // Bottom line (reverse)
      const bottomPoints: string[] = [];
      for (let i = data.length - 1; i >= 0; i--) {
        const stackBelow = departments
          .filter((dep) => departments.indexOf(dep) < departments.indexOf(dept))
          .reduce((sum, dep) => sum + (data[i] as Record<string, number>)[dep], 0);
        const x = xScale(i);
        const y = yScale(stackBelow);
        bottomPoints.push(`${x},${y}`);
      }
      return {
        dept,
        path: `M${points.join(' L')} L${bottomPoints.join(' L')} Z`,
        color: DEPT_COLORS[dept],
      };
    });
  }, [data, departments]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-3 border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-black text-white font-mono">{formatNumber(latestSnapshot.total)}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> +{totalGrowth} ({growthPct}%) since {data[0].month}
              </div>
            </div>
            <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-slate-300 transition">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-5">
          {/* SVG Chart */}
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto" style={{ minWidth: 400 }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padding.top + innerH * (1 - pct);
                const val = Math.round(maxTotal * 1.1 * pct);
                return (
                  <g key={pct}>
                    <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="rgb(30 41 59)" strokeWidth="1" />
                    <text x={padding.left - 5} y={y + 3} textAnchor="end" className="fill-slate-600" fontSize="9" fontFamily="monospace">
                      {val}
                    </text>
                  </g>
                );
              })}
              {/* X axis labels */}
              {data.map((d, i) => (
                <text key={i} x={xScale(i)} y={chartHeight - 5} textAnchor="middle" className="fill-slate-500" fontSize="9" fontFamily="monospace">
                  {d.month.split('-')[1]}
                </text>
              ))}
              {/* Stacked areas */}
              {stackedPaths.map((sp) => (
                <path
                  key={sp.dept}
                  d={sp.path}
                  fill={sp.color}
                  opacity={hoveredDept && hoveredDept !== sp.dept ? 0.15 : 0.6}
                  className="transition-opacity duration-300"
                  onMouseEnter={() => setHoveredDept(sp.dept)}
                  onMouseLeave={() => setHoveredDept(null)}
                />
              ))}
            </svg>
          </div>

          {/* Department Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {departments.map((dept) => {
              const latest = latestSnapshot as Record<string, number>;
              const prev = earliestSnapshot as Record<string, number>;
              const delta = latest[dept] - prev[dept];
              return (
                <div
                  key={dept}
                  className={`flex items-center gap-1.5 text-[10px] cursor-pointer transition-opacity ${hoveredDept && hoveredDept !== dept ? 'opacity-30' : 'opacity-100'}`}
                  onMouseEnter={() => setHoveredDept(dept)}
                  onMouseLeave={() => setHoveredDept(null)}
                >
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: DEPT_COLORS[dept] }} />
                  <span className="text-slate-400">{DEPT_LABELS[dept]}</span>
                  <span className="text-white font-mono font-bold">{latest[dept]}</span>
                  {delta !== 0 && (
                    <span className={`font-mono ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
