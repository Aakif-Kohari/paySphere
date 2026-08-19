import React from 'react';
import { BenefitEnrollment } from '../../../backend/src/models/EnterpriseBenefitsModel';
import { Shield, Clock, CheckCircle2, XCircle, DollarSign, Users, AlertCircle } from 'lucide-react';

interface TimelineProps {
  enrollments: BenefitEnrollment[];
  onCancel: (enrollmentId: string) => void;
}

export const BenefitActivityTimeline: React.FC<TimelineProps> = ({ enrollments, onCancel }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Active Benefit Enrollments</h3>
          <p className="text-sm text-gray-500">Manage payroll deductions and active employee benefit policies</p>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-full text-xs">
          {enrollments.length} Enrolled Policies
        </span>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Shield className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">No benefit enrollments active</p>
          <p className="text-xs text-gray-400 mt-1">Select an open benefit plan above to enroll and configure payroll deductions.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {enrollments.map((enr) => (
            <div
              key={enr.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100/60 text-indigo-700 mt-0.5">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">{enr.planName}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {enr.dependentsCount} Dependents Included
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Effective {enr.effectiveDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Price */}
              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-0.5 font-extrabold text-gray-900 text-lg">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span>{enr.monthlyDeduction}/mo</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {enr.status === 'active' && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active Coverage
                      </span>
                    )}
                    {enr.status === 'terminated' && (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Terminated
                      </span>
                    )}
                  </div>
                </div>

                {enr.status === 'active' && (
                  <button
                    onClick={() => onCancel(enr.id)}
                    className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Terminate Policy
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
