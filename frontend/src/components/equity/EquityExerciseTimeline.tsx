import React from 'react';
import { EquityGrant } from './EquityGrantCard';

interface EquityStreamTimelineProps {
  grants: EquityGrant[];
}

/**
 * Equity Exercise Audit Timeline Component.
 * Audits stock option exercises, 409A FMV valuations, and IRS tax withholding events.
 */
export const EquityExerciseTimeline: React.FC<EquityStreamTimelineProps> = ({ grants }) => {
  if (!grants || grants.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center backdrop-blur-xl">
        <p className="text-slate-400 text-sm">No equity compensation grants found in registry.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
      <h3 className="text-white font-extrabold text-xl mb-6 flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-purple-500 animate-ping" />
        ESOP & Equity Option Exercise Audit Ledger
      </h3>

      <div className="space-y-4">
        {grants.map((g) => (
          <div
            key={g.grantId}
            className="relative pl-6 border-l-2 border-slate-800 hover:border-purple-500 transition-colors"
          >
            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-purple-500 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-purple-400 font-extrabold text-sm">{g.grantId}</span>
                  <span className="text-slate-400 text-xs">Employee: {g.employeeFullName}</span>
                  <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {g.grantType}
                  </span>
                </div>
                <p className="text-slate-300 text-xs">
                  Total Granted: <strong className="text-white">{g.totalOptionsGranted} shares</strong> | Vested:{' '}
                  <strong className="text-purple-300">{g.vestedOptionsCount}</strong> | Exercised:{' '}
                  <strong className="text-emerald-400">{g.exercisedOptionsCount}</strong>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">Grant Status</span>
                  <span className="text-cyan-400 font-extrabold text-xs">
                    {g.grantStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
