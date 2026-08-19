import React, { useState } from 'react';
import { GarnishmentOrder } from '../../../backend/src/models/EnterpriseGarnishmentModel';
import { Scale, AlertCircle, CheckCircle2, DollarSign, ShieldAlert, FileText, UserCheck } from 'lucide-react';

interface GarnishmentCardProps {
  order: GarnishmentOrder;
  onDeductClick: (order: GarnishmentOrder) => void;
}

export const GarnishmentOrderCard: React.FC<GarnishmentCardProps> = ({ order, onDeductClick }) => {
  const [copied, setCopied] = useState(false);

  const getGarnishmentBadge = (type: string) => {
    switch (type) {
      case 'child-support':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'tax-levy':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'student-loan':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between">
      <div>
        {/* Header Badge & Case Number */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-1 rounded-lg text-xs">
              Case: {order.caseNumber}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${getGarnishmentBadge(order.garnishmentType)}`}>
              Priority {order.priorityLevel} • {order.garnishmentType.replace('-', ' ')}
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900">${order.monthlyDeductionCap}</span>
            <span className="text-xs text-gray-400 font-medium block">/ month cap</span>
          </div>
        </div>

        {/* Employee & Agency Info */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1">{order.employeeName}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">
          Issuing Agency: <span className="text-gray-800 font-semibold">{order.issuingAgency}</span>
        </p>

        {/* Notes */}
        <p className="text-gray-600 text-xs mb-4 line-clamp-2 leading-relaxed">{order.notes}</p>

        {/* Financial Highlights */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Total Court Order:</span>
            <span className="font-semibold text-gray-900">${order.totalOrderAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Issued Date:</span>
            <span className="font-semibold text-gray-800">{order.issuedDate}</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onDeductClick(order)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Scale className="w-4 h-4" />
          Process Wage Deduction
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Court Order"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
