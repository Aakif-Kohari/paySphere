import React from 'react';
import { TaxFilingRecord } from '../../../backend/src/models/EnterpriseTaxModel';
import { Percent, Clock, CheckCircle2, DollarSign, Users, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface TimelineProps {
  records: TaxFilingRecord[];
}

export const TaxActivityTimeline: React.FC<TimelineProps> = ({ records }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Processed Payroll Tax Filings</h3>
          <p className="text-sm text-gray-500">Historical records of federal, state, and FICA tax withholdings</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {records.length} Processed Filings
        </span>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Percent className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No tax withholding records generated</p>
          <p className="text-xs text-gray-400 mt-1">Run a simulation or process employee payroll to compute tax withholdings.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">
                    {rec.employeeName} ({rec.employeeId})
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="bg-gray-100 text-gray-800 font-bold px-2 py-0.5 rounded">
                      {rec.stateJurisdiction}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {rec.payPeriod}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tax Breakdowns */}
              <div className="flex items-center justify-between md:justify-end gap-6 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Gross Pay</span>
                  <span className="font-bold text-gray-900 text-sm">${rec.grossPay.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Fed / State Tax</span>
                  <span className="font-bold text-red-600 text-sm">
                    ${rec.federalTaxWithheld} / ${rec.stateTaxWithheld}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Net Pay</span>
                  <span className="font-bold text-emerald-600 text-sm">${rec.netPay.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Filed
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
