import React, { useState } from 'react';
import { BenefitPlan } from '../../../backend/src/models/EnterpriseBenefitsModel';
import { Shield, DollarSign, CheckCircle2, Award, Heart, Eye, Lock, FileText, ArrowRight } from 'lucide-react';

interface PlanCardProps {
  plan: BenefitPlan;
  onEnrollClick: (plan: BenefitPlan) => void;
}

export const BenefitPlanCard: React.FC<PlanCardProps> = ({ plan, onEnrollClick }) => {
  const [copied, setCopied] = useState(false);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'gold':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'health':
        return <Heart className="w-4 h-4 text-red-500" />;
      case 'dental':
        return <Shield className="w-4 h-4 text-indigo-500" />;
      case 'vision':
        return <Eye className="w-4 h-4 text-emerald-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-amber-500" />;
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
        {/* Header Category & Tier */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 capitalize">
              {getCategoryIcon(plan.category)}
              {plan.category}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase ${getTierColor(plan.tier)}`}>
              {plan.tier}
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-gray-900">${plan.employeeMonthlyCost}</span>
            <span className="text-xs text-gray-400 font-medium block">/ month</span>
          </div>
        </div>

        {/* Plan Name & Provider */}
        <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1 line-clamp-2">{plan.planName}</h3>
        <p className="text-xs text-gray-500 font-medium mb-3">
          Provider: <span className="text-gray-800 font-semibold">{plan.provider}</span>
        </p>

        {/* Description */}
        <p className="text-gray-600 text-xs mb-4 line-clamp-2 leading-relaxed">{plan.description}</p>

        {/* Features List */}
        <div className="space-y-1.5 mb-5">
          {plan.features.map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Financial Highlights */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Employer Match:</span>
            <span className="font-semibold text-emerald-700">
              {plan.category === '401k' ? `${plan.employerMonthlyMatch}% match` : `$${plan.employerMonthlyMatch}/mo`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 font-medium">Annual Deductible:</span>
            <span className="font-semibold text-gray-800">${plan.deductible}</span>
          </div>
        </div>
      </div>

      {/* Action Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onEnrollClick(plan)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Enroll In Benefit Plan
        </button>
        <button
          onClick={handleShare}
          className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          title="Share Plan Summary"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
