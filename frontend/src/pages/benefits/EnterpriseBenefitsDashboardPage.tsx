import React, { useState } from 'react';
import {
  EnterpriseBenefitsServiceHandler,
} from '../../../backend/src/services/EnterpriseBenefitsService';
import {
  BenefitPlan,
  BenefitEnrollment,
  BenefitFilterOptions,
} from '../../../backend/src/models/EnterpriseBenefitsModel';
import { BenefitPlanCard } from '../../components/benefits/BenefitPlanCard';
import { BenefitActivityTimeline } from '../../components/benefits/BenefitActivityTimeline';
import {
  Shield,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  Heart,
  DollarSign,
} from 'lucide-react';

export const EnterpriseBenefitsDashboardPage: React.FC = () => {
  const [plans, setPlans] = useState<BenefitPlan[]>(() =>
    EnterpriseBenefitsServiceHandler.fetchBenefitPlans()
  );
  const [enrollments, setEnrollments] = useState<BenefitEnrollment[]>(() =>
    EnterpriseBenefitsServiceHandler.fetchUserEnrollments()
  );

  const [filters, setFilters] = useState<BenefitFilterOptions>({
    category: 'All',
    tier: 'All',
    maxMonthlyCost: 500,
    searchQuery: '',
  });

  const [selectedPlan, setSelectedPlan] = useState<BenefitPlan | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('Alex Mercer');
  const [employeeId, setEmployeeId] = useState<string>('EMP-4091');
  const [dependentsCount, setDependentsCount] = useState<number>(0);
  const [isEnrollSuccess, setIsEnrollSuccess] = useState<boolean>(false);

  // Create Plan State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newPlanName, setNewPlanName] = useState<string>('');
  const [newProvider, setNewProvider] = useState<string>('');
  const [newCategory, setNewCategory] = useState<'health' | 'dental' | 'vision' | '401k' | 'life' | 'fsa'>('health');
  const [newTier, setNewTier] = useState<'silver' | 'gold' | 'platinum'>('gold');
  const [newEmployeeCost, setNewEmployeeCost] = useState<number>(100);
  const [newEmployerMatch, setNewEmployerMatch] = useState<number>(300);
  const [newDescription, setNewDescription] = useState<string>('');
  const [newFeatures, setNewFeatures] = useState<string>('Full Medical, Low Deductible');

  const applyFilterChanges = (updatedFilters: Partial<BenefitFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setPlans(EnterpriseBenefitsServiceHandler.fetchBenefitPlans(nextFilters));
  };

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    EnterpriseBenefitsServiceHandler.submitEnrollment(
      selectedPlan.id,
      employeeName,
      employeeId,
      dependentsCount
    );

    setEnrollments(EnterpriseBenefitsServiceHandler.fetchUserEnrollments());
    setIsEnrollSuccess(true);
    setTimeout(() => {
      setIsEnrollSuccess(false);
      setSelectedPlan(null);
    }, 1800);
  };

  const handleCancelEnrollment = (enrollmentId: string) => {
    EnterpriseBenefitsServiceHandler.cancelEnrollment(enrollmentId);
    setEnrollments(EnterpriseBenefitsServiceHandler.fetchUserEnrollments());
  };

  const handleCreatePlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    EnterpriseBenefitsServiceHandler.createNewBenefitPlan({
      planName: newPlanName,
      provider: newProvider,
      category: newCategory,
      tier: newTier,
      employeeMonthlyCost: newEmployeeCost,
      employerMonthlyMatch: newEmployerMatch,
      coverageLimit: 500000,
      deductible: 250,
      description: newDescription,
      features: newFeatures.split(',').map((f) => f.trim()),
      enrollmentDeadline: 'Dec 31, 2026',
    });

    setPlans(EnterpriseBenefitsServiceHandler.fetchBenefitPlans(filters));
    setShowCreateModal(false);
    setNewPlanName('');
    setNewProvider('');
    setNewDescription('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-300" />
              Automated Payroll Benefits & Health Administration
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Enterprise Benefits Enrollment & Deductions Suite
            </h1>
            <p className="text-indigo-200 text-base sm:text-lg leading-relaxed">
              Manage employee health PPO plans, dental, vision, 401(k) employer matching, and FSA flex accounts with direct payroll deduction integration.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                Configure New Benefit Plan
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by plan name, provider, category, or key features..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-gray-900"
              />
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.category}
                onChange={(e) => applyFilterChanges({ category: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Categories</option>
                <option value="health">Health PPO/HMO</option>
                <option value="dental">Dental Care</option>
                <option value="vision">Vision Care</option>
                <option value="401k">401(k) Retirement</option>
              </select>

              {/* Tier Dropdown */}
              <select
                value={filters.tier}
                onChange={(e) => applyFilterChanges({ tier: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Tiers</option>
                <option value="platinum">Platinum Tier</option>
                <option value="gold">Gold Tier</option>
                <option value="silver">Silver Tier</option>
              </select>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              Available Corporate Benefit Plans ({plans.length})
            </h2>
          </div>

          {plans.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No benefit plans found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or category filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {plans.map((p) => (
                <BenefitPlanCard
                  key={p.id}
                  plan={p}
                  onEnrollClick={(selected) => setSelectedPlan(selected)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Enrollments Timeline */}
        <BenefitActivityTimeline
          enrollments={enrollments}
          onCancel={handleCancelEnrollment}
        />

        {/* Enroll Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedPlan(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isEnrollSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Enrollment Active!</h3>
                  <p className="text-sm text-gray-600">
                    Your enrollment in "{selectedPlan.planName}" has been registered. Monthly payroll deduction of ${selectedPlan.employeeMonthlyCost} configured.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEnrollSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedPlan.planName}</h3>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      Provider: {selectedPlan.provider} (${selectedPlan.employeeMonthlyCost}/mo)
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Full Name</label>
                      <input
                        type="text"
                        required
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID</label>
                      <input
                        type="text"
                        required
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Number of Covered Dependents</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={dependentsCount}
                        onChange={(e) => setDependentsCount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                  >
                    Confirm Policy Enrollment
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Create Plan Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Configure Benefit Plan</h3>
                <p className="text-xs text-gray-500 mt-1">Add corporate health, dental, or 401(k) plans to payroll.</p>
              </div>

              <form onSubmit={handleCreatePlanSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Executive Health PPO Advantage"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Provider</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kaiser Permanente"
                      value={newProvider}
                      onChange={(e) => setNewProvider(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="health">Health</option>
                      <option value="dental">Dental</option>
                      <option value="vision">Vision</option>
                      <option value="401k">401(k)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Cost ($/mo)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newEmployeeCost}
                      onChange={(e) => setNewEmployeeCost(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Employer Match ($/mo)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newEmployerMatch}
                      onChange={(e) => setNewEmployerMatch(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Features (comma separated)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zero Copay, Telehealth, Dental Coverage"
                    value={newFeatures}
                    onChange={(e) => setNewFeatures(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Description</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Provide overview of coverage terms..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Publish Corporate Benefit Plan
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
