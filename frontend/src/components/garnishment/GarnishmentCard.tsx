import React from 'react';

export interface GarnishmentOrder {
  garnishmentId: string;
  employeeId: string;
  employeeFullName: string;
  garnishmentType: string;
  courtOrderCaseNumber: string;
  issuingAgencyName: string;
  totalOrderedAmountUsd: number;
  remainingBalanceUsd: number;
  deductionPerPayPeriodUsd: number;
  disposableEarningsCapPercentage: number;
  garnishmentStatus: string;
  remittances?: any[];
}

interface GarnishmentCardProps {
  order: GarnishmentOrder;
  onProcessRemittance: (garnishmentId: string) => void;
}

/**
 * Glassmorphic Card Component displaying court garnishment details, remaining balance, and CCPA caps.
 */
export const GarnishmentCard: React.FC<GarnishmentCardProps> = ({ order, onProcessRemittance }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE_DEDUCTION':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'SATISFIED_PAID':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'COURT_ORDER_STAY':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl hover:border-amber-500/40 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <span className="bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          {order.garnishmentType.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${getStatusBadge(order.garnishmentStatus)}`}>
          {order.garnishmentStatus.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/50 flex items-center justify-center text-amber-400 text-2xl font-black">
          ⚖️
        </div>
        <div>
          <h4 className="text-white font-extrabold text-lg">{order.employeeFullName}</h4>
          <p className="text-slate-400 text-xs">
            Case: {order.courtOrderCaseNumber} | Agency: {order.issuingAgencyName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Remaining / Total</span>
          <span className="text-amber-400 font-bold text-sm">
            ${order.remainingBalanceUsd.toLocaleString()} / <span className="text-slate-400">${order.totalOrderedAmountUsd.toLocaleString()}</span>
          </span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">Pay-Period Deduction</span>
          <span className="text-white font-bold text-sm">${order.deductionPerPayPeriodUsd.toLocaleString()}</span>
        </div>
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <span className="text-slate-400 text-xs block">CCPA Cap</span>
          <span className="text-cyan-400 font-bold text-sm">{order.disposableEarningsCapPercentage}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-slate-400 text-xs">
          Order ID: <strong className="text-white">{order.garnishmentId}</strong>
        </span>
        <button
          onClick={() => onProcessRemittance(order.garnishmentId)}
          className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-amber-600/20"
        >
          Remit Payment ⚖️
        </button>
      </div>
    </div>
  );
};
