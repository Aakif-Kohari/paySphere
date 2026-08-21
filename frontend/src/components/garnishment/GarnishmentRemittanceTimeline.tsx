import React from 'react';
import { GarnishmentOrder } from './GarnishmentCard';

interface GarnishmentTimelineProps {
  orders: GarnishmentOrder[];
}

/**
 * Garnishment Remittance Audit Timeline Component.
 * Audits pay-period wage deductions, agency remittances, and CCPA disposable earnings limits.
 */
export const GarnishmentRemittanceTimeline: React.FC<GarnishmentTimelineProps> = ({ orders }) => {
  if (!orders || orders.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center backdrop-blur-xl">
        <p className="text-slate-400 text-sm">No wage garnishment orders found in registry.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
      <h3 className="text-white font-extrabold text-xl mb-6 flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
        Wage Garnishment & Statutory Lien Remittance Audit Ledger
      </h3>

      <div className="space-y-4">
        {orders.map((o) => (
          <div
            key={o.garnishmentId}
            className="relative pl-6 border-l-2 border-slate-800 hover:border-amber-500 transition-colors"
          >
            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-amber-500 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-amber-400 font-extrabold text-sm">{o.garnishmentId}</span>
                  <span className="text-slate-400 text-xs">Employee: {o.employeeFullName}</span>
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {o.garnishmentType}
                  </span>
                </div>
                <p className="text-slate-300 text-xs">
                  Remaining Balance: <strong className="text-amber-400">${o.remainingBalanceUsd.toLocaleString()}</strong> | Deduction:{' '}
                  <strong className="text-white">${o.deductionPerPayPeriodUsd.toLocaleString()}/pay period</strong> | Case:{' '}
                  <strong className="text-slate-400">{o.courtOrderCaseNumber}</strong>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="text-emerald-400 font-extrabold text-xs">
                    {o.garnishmentStatus}
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
