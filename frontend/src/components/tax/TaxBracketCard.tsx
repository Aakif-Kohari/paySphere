import React, { useState } from 'react';
import { TaxBracket } from '../../../backend/src/models/EnterpriseTaxModel';
import { Percent, ShieldAlert, CheckCircle2, DollarSign, Globe, Layers, FileText } from 'lucide-react';

interface TaxBracketCardProps {
  bracket: TaxBracket;
  onCalculateClick: (bracket: TaxBracket) => void;
}

export const TaxBracketCard: React.FC<TaxBracketCardProps> = ({ bracket, onCalculateClick }) => {
  const [copied, setCopied] = useState(false);

  const getTaxTypeBadge = (type: string) => {
    switch (type) {
      case 'federal':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'state':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'social-security':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'medicare':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
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
        {/* Header Jurisdiction & Rate */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              {bracket.jurisdiction}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${getTaxTypeBadge(bracket.taxType)}`}>
              {bracket.taxType}
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900">{bracket.ratePercentage}%</span>
            <span className="text-xs text-gray-400 font-medium block">Rate ({bracket.effectiveYear})</span>
          </div>
        </div>

        {/* Bracket Description */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 line-clamp-2">{bracket.description}</h3>
        <p className="text-xs text-gray-500 font-medium mb-4">
          W-4 Filing Status: <span className="text-gray-800 font-semibold uppercase">{bracket.filingStatus}</span>
        </p>

        {/* Income Range Bar */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Min Taxable Income:</span>
            <span className="font-semibold text-gray-900">${bracket.minIncome.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Max Taxable Limit:</span>
            <span className="font-semibold text-gray-900">${bracket.maxIncome.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onCalculateClick(bracket)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Percent className="w-4 h-4" />
          Simulate Withholding Calculation
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Tax Rule"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
