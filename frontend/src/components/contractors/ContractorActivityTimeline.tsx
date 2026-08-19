import React from 'react';
import { ContractorPayout } from '../../../backend/src/models/EnterpriseContractorModel';
import { Send, Clock, CheckCircle2, AlertTriangle, DollarSign, Globe, FileSpreadsheet } from 'lucide-react';

interface TimelineProps {
  payouts: ContractorPayout[];
}

export const ContractorActivityTimeline: React.FC<TimelineProps> = ({ payouts }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Global Contractor Payout History</h3>
          <p className="text-sm text-gray-500">Cross-border invoice disbursements, SWIFT transfers, and W-8BEN tax audit trail</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {payouts.length} Disbursed Invoices
        </span>
      </div>

      {payouts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Send className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No contractor payouts recorded</p>
          <p className="text-xs text-gray-400 mt-1">Select an active contractor above to disburse an invoice payout.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">
                    {p.contractorName} ({p.invoiceNumber})
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded">
                      {p.currency}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Disbursed {p.payoutDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="flex items-center justify-between md:justify-end gap-6 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Invoice Amount</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {p.amount} {p.currency}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Withheld Tax</span>
                  <span className="font-bold text-red-600 text-sm">
                    {p.taxWithheld} {p.currency}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Net Disbursed</span>
                  <span className="font-extrabold text-emerald-600 text-sm">
                    {p.netPayoutAmount} {p.currency}
                  </span>
                </div>
                <div>
                  {p.status === 'completed' && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed
                    </span>
                  )}
                  {p.status === 'held-for-tax-form' && (
                    <span className="text-amber-600 font-semibold flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5" /> 30% Tax Hold
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
