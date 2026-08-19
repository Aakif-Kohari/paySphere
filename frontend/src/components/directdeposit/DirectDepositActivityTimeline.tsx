import React from 'react';
import { DirectDepositTransaction } from '../../../backend/src/models/EnterpriseDirectDepositModel';
import { Send, Clock, CheckCircle2, Building2, DollarSign, FileSpreadsheet } from 'lucide-react';

interface TimelineProps {
  transactions: DirectDepositTransaction[];
}

export const DirectDepositActivityTimeline: React.FC<TimelineProps> = ({ transactions }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">NACHA Direct Deposit Audit Log</h3>
          <p className="text-sm text-gray-500">Track electronic ACH funds transfers, settlement status, and batch IDs</p>
        </div>
        <span className="bg-blue-50 text-blue-700 font-semibold px-3 py-1 rounded-full text-xs">
          {transactions.length} Settled Transfers
        </span>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Send className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No direct deposit transfers logged</p>
          <p className="text-xs text-gray-400 mt-1">Select an active bank account above to trigger a direct deposit payroll transfer.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100/60 text-blue-700 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">
                    {tx.employeeName} ({tx.bankName})
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded">
                      Batch: {tx.nachaBatchId}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Settled {tx.transferredDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Amount */}
              <div className="flex items-center justify-between md:justify-end gap-6 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Direct Deposit Amount</span>
                  <span className="font-extrabold text-blue-700 text-base">${tx.amountTransferred.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ACH Settled
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
