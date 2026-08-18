import React from 'react';
import { GarnishmentDeduction } from '../../../backend/src/models/EnterpriseGarnishmentModel';
import { Scale, Clock, CheckCircle2, DollarSign, Building, FileSpreadsheet } from 'lucide-react';

interface TimelineProps {
  deductions: GarnishmentDeduction[];
}

export const GarnishmentActivityTimeline: React.FC<TimelineProps> = ({ deductions }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Garnishment Disbursement Audit Log</h3>
          <p className="text-sm text-gray-500">Track child support, tax levy, and court judgment wage withholdings</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {deductions.length} Disbursed Records
        </span>
      </div>

      {deductions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Scale className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No wage garnishment deductions recorded</p>
          <p className="text-xs text-gray-400 mt-1">Select an active garnishment order above to process a pay period deduction.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deductions.map((ded) => (
            <div
              key={ded.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">
                    {ded.employeeName} (Case: {ded.caseNumber})
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      {ded.disbursementAgency}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {ded.payPeriod}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Amount */}
              <div className="flex items-center justify-between md:justify-end gap-6 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Amount Withheld</span>
                  <span className="font-extrabold text-indigo-700 text-base">${ded.amountDeducted}</span>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed to State
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
