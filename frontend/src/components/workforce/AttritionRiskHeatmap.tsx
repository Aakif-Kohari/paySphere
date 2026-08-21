/* ═══════════════════════════════════════════════════════════════
   AttritionRiskHeatmap — Department x Tenure risk visualization
   ═══════════════════════════════════════════════════════════════ */

import React from 'react';
import { Flame, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { AttritionRiskProfile } from '../../services/workforce/workforceService';
import { riskColor } from '../../services/workforce/workforceService';

function heatmapCell(value: number): { bg: string; text: string } {
  if (value >= 75) return { bg: 'bg-red-500/40', text: 'text-red-300' };
  if (value >= 55) return { bg: 'bg-orange-500/35', text: 'text-orange-300' };
  if (value >= 40) return { bg: 'bg-amber-500/30', text: 'text-amber-300' };
  if (value >= 25) return { bg: 'bg-yellow-500/20', text: 'text-yellow-300' };
  if (value >= 10) return { bg: 'bg-emerald-500/20', text: 'text-emerald-300' };
  return { bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
}

interface AttritionRiskHeatmapProps {
  data: AttritionRiskProfile[];
  onRowClick?: (dept: AttritionRiskProfile) => void;
}

export default function AttritionRiskHeatmap({ data, onRowClick }: AttritionRiskHeatmapProps) {
  const columns = [
    { key: 'lowTenure' as const, label: '0–2 yrs', sublabel: 'Early-tenure' },
    { key: 'midTenure' as const, label: '2–4 yrs', sublabel: 'Mid-tenure' },
    { key: 'highTenure' as const, label: '4+ yrs', sublabel: 'Senior' },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-bold text-white">Attrition Risk Heatmap</h3>
        </div>
        <p className="text-[11px] text-slate-400">Departments ranked by risk across tenure bands. Click a row for details.</p>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              <th className="text-left text-[10px] text-slate-500 uppercase tracking-wider px-5 py-3 font-semibold w-44">Department</th>
              {columns.map((col) => (
                <th key={col.key} className="text-center px-4 py-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{col.label}</div>
                  <div className="text-[9px] text-slate-600">{col.sublabel}</div>
                </th>
              ))}
              <th className="text-center text-[10px] text-slate-500 uppercase tracking-wider px-4 py-3 font-semibold">Overall</th>
              <th className="text-center text-[10px] text-slate-500 uppercase tracking-wider px-4 py-3 font-semibold">Predicted</th>
            </tr>
          </thead>
          <tbody>
            {data.map((dept) => (
              <tr
                key={dept.department}
                onClick={() => onRowClick?.(dept)}
                className="border-b border-slate-800/30 hover:bg-slate-800/30 transition cursor-pointer"
              >
                <td className="px-5 py-3">
                  <span className="text-xs font-semibold text-white">{dept.department}</span>
                </td>
                {columns.map((col) => {
                  const val = dept[col.key];
                  const cell = heatmapCell(val);
                  return (
                    <td key={col.key} className="px-4 py-3 text-center">
                      <div className={`inline-flex items-center justify-center w-14 h-8 rounded-lg ${cell.bg} transition-all duration-300`}>
                        <span className={`text-xs font-bold font-mono ${cell.text}`}>{val}%</span>
                      </div>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${riskColor(dept.overallRisk)}`}>
                    {dept.overallRisk}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-black font-mono text-white">{dept.predictedAttrition}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-slate-800/50 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Risk scale:</span>
        {[
          { label: 'Critical (75%+)', cls: 'bg-red-500/40' },
          { label: 'High (55–74%)', cls: 'bg-orange-500/35' },
          { label: 'Medium (40–54%)', cls: 'bg-amber-500/30' },
          { label: 'Low (< 40%)', cls: 'bg-emerald-500/20' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded ${l.cls}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
