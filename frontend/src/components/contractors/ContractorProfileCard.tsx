import React, { useState } from 'react';
import { ContractorProfile } from '../../../backend/src/models/EnterpriseContractorModel';
import { Globe, ShieldCheck, Clock, DollarSign, Send, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ContractorCardProps {
  contractor: ContractorProfile;
  onPayoutClick: (contractor: ContractorProfile) => void;
}

export const ContractorProfileCard: React.FC<ContractorCardProps> = ({ contractor, onPayoutClick }) => {
  const [copied, setCopied] = useState(false);

  const getTaxStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending-review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-red-50 text-red-700 border-red-200';
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
        {/* Header Country & Tax Form */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              {contractor.country}
            </span>
            <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-xs">
              {contractor.taxFormType}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${getTaxStatusBadge(contractor.taxFormStatus)}`}>
              {contractor.taxFormStatus}
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900">${contractor.hourlyRateOrRetainer}</span>
            <span className="text-xs text-gray-400 font-medium block">/ hr ({contractor.currency})</span>
          </div>
        </div>

        {/* Contractor Name & Title */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1">{contractor.contractorName}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">{contractor.contractTitle}</p>

        {/* Financial Highlights */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Tax ID / TIN:</span>
            <span className="font-semibold text-gray-800">{contractor.taxIdOrEin}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Payout Method:</span>
            <span className="font-semibold text-indigo-700">{contractor.paymentMethod}</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onPayoutClick(contractor)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Disburse Invoice Payout
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Contractor Profile"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
