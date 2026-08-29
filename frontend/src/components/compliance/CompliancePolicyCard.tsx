import React from 'react';
import { Shield, FileCheck, Users, AlertCircle, Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';

export interface CompliancePolicy {
  id: string;
  policyName: string;
  category: 'STATUTORY' | 'LABOR_LAW' | 'DATA_PRIVACY' | 'HEALTH_SAFETY' | 'INTERNAL_GOVERNANCE';
  jurisdiction: string;
  status: 'ACTIVE' | 'DRAFT' | 'UNDER_REVIEW' | 'ARCHIVED';
  version: string;
  effectiveDate: string;
  lastReviewedAt?: string;
  mandatoryAcknowledgment: boolean;
  acknowledgedCount: number;
  totalEligibleEmployees: number;
  description?: string;
}

export interface CompliancePolicyCardProps {
  policy: CompliancePolicy;
  onView?: (policy: CompliancePolicy) => void;
  onEdit?: (policy: CompliancePolicy) => void;
  onAcknowledge?: (policy: CompliancePolicy) => void;
}

export const CompliancePolicyCard: React.FC<CompliancePolicyCardProps> = ({
  policy,
  onView,
  onEdit,
  onAcknowledge,
}) => {
  const complianceRate = policy.totalEligibleEmployees > 0
    ? Math.round((policy.acknowledgedCount / policy.totalEligibleEmployees) * 100)
    : 0;

  const getStatusBadge = (status: CompliancePolicy['status']) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'UNDER_REVIEW':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'DRAFT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getCategoryBadge = (category: CompliancePolicy['category']) => {
    switch (category) {
      case 'STATUTORY':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'LABOR_LAW':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'DATA_PRIVACY':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      data-testid="compliance-policy-card"
      className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-indigo-500/10 flex flex-col justify-between group"
    >
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2.5 py-0.5 rounded-lg font-mono font-semibold border ${getCategoryBadge(policy.category)}`}>
              {policy.category.replace('_', ' ')}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">v{policy.version}</span>
          </div>

          <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border uppercase ${getStatusBadge(policy.status)}`}>
            {policy.status}
          </span>
        </div>

        {/* Title & Jurisdiction */}
        <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition mb-1 leading-snug">
          {policy.policyName}
        </h3>
        <p className="text-xs text-slate-400 font-medium mb-4">
          Jurisdiction: <span className="text-slate-200 font-semibold">{policy.jurisdiction}</span>
        </p>

        {/* Description */}
        {policy.description && (
          <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
            {policy.description}
          </p>
        )}

        {/* Acknowledgment Progress */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-4 font-mono">
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Staff Acknowledgment
            </span>
            <span className="text-slate-200 font-bold">{complianceRate}%</span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                complianceRate >= 90
                  ? 'bg-emerald-500'
                  : complianceRate >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, complianceRate)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{policy.acknowledgedCount} signed</span>
            <span>{policy.totalEligibleEmployees} required</span>
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-1.5 text-xs font-mono text-slate-400 mb-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              Effective Date:
            </span>
            <span className="text-slate-300 font-medium">{policy.effectiveDate}</span>
          </div>
          {policy.lastReviewedAt && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileCheck className="w-3 h-3 text-slate-500" />
                Last Reviewed:
              </span>
              <span className="text-slate-300 font-medium">{policy.lastReviewedAt}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {policy.mandatoryAcknowledgment && (
          <button
            type="button"
            onClick={() => onAcknowledge?.(policy)}
            className="flex-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-500/30 transition flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sign Policy</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onView?.(policy)}
          className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-indigo-500/30 transition flex items-center gap-1"
        >
          <span>Inspect</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CompliancePolicyCard;
