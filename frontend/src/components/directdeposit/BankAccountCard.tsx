import React, { useState } from 'react';
import { BankAccount } from '../../../backend/src/models/EnterpriseDirectDepositModel';
import { Building2, ShieldCheck, Clock, DollarSign, Send, FileText, CheckCircle2, AlertCircle, PieChart } from 'lucide-react';

interface AccountCardProps {
  account: BankAccount;
  onDepositClick: (account: BankAccount) => void;
}

export const BankAccountCard: React.FC<AccountCardProps> = ({ account, onDepositClick }) => {
  const [copied, setCopied] = useState(false);

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'micro-deposit-pending':
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
        {/* Header Bank Name & Account Type */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              {account.bankName}
            </span>
            <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg text-xs uppercase">
              {account.accountType}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${getVerificationBadge(account.verificationStatus)}`}>
              {account.verificationStatus.replace('-', ' ')}
            </span>
          </div>
          {account.isPrimary && (
            <span className="bg-indigo-600 text-white font-bold px-2 py-0.5 rounded text-xs">
              Primary
            </span>
          )}
        </div>

        {/* Employee & Account Numbers */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1">{account.employeeName}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">
          Account Number: <span className="text-gray-800 font-semibold">{account.accountNumberMasked}</span> (Routing: {account.routingNumberMasked})
        </p>

        {/* Split Allocation */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium flex items-center gap-1">
              <PieChart className="w-3.5 h-3.5 text-indigo-500" /> Pay Allocation:
            </span>
            <span className="font-extrabold text-indigo-700">
              {account.splitValue}{account.splitType === 'percentage' ? '%' : account.splitType === 'fixed-amount' ? ' Fixed' : ' Remainder'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onDepositClick(account)}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Transfer Direct Deposit
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Bank Account Info"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
