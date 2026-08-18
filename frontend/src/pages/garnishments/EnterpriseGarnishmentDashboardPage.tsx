import React, { useState } from 'react';
import {
  EnterpriseGarnishmentServiceHandler,
} from '../../../backend/src/services/EnterpriseGarnishmentService';
import {
  GarnishmentOrder,
  GarnishmentDeduction,
  GarnishmentFilterOptions,
} from '../../../backend/src/models/EnterpriseGarnishmentModel';
import { GarnishmentOrderCard } from '../../components/garnishments/GarnishmentOrderCard';
import { GarnishmentActivityTimeline } from '../../components/garnishments/GarnishmentActivityTimeline';
import {
  Scale,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  ShieldAlert,
} from 'lucide-react';

export const EnterpriseGarnishmentDashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<GarnishmentOrder[]>(() =>
    EnterpriseGarnishmentServiceHandler.fetchGarnishmentOrders()
  );
  const [deductions, setDeductions] = useState<GarnishmentDeduction[]>(() =>
    EnterpriseGarnishmentServiceHandler.fetchDeductionHistory()
  );

  const [filters, setFilters] = useState<GarnishmentFilterOptions>({
    garnishmentType: 'All',
    status: 'All',
    searchQuery: '',
  });

  const [selectedOrder, setSelectedOrder] = useState<GarnishmentOrder | null>(null);
  const [deductAmount, setDeductAmount] = useState<number>(300);
  const [payPeriod, setPayPeriod] = useState<string>('Aug 1 - Aug 15, 2026');
  const [isDeductSuccess, setIsDeductSuccess] = useState<boolean>(false);

  // Create Order Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newEmployeeName, setNewEmployeeName] = useState<string>('');
  const [newEmployeeId, setNewEmployeeId] = useState<string>('');
  const [newType, setNewType] = useState<'child-support' | 'tax-levy' | 'student-loan' | 'creditor-judgement'>('child-support');
  const [newAgency, setNewAgency] = useState<string>('');
  const [newCaseNumber, setNewCaseNumber] = useState<string>('');
  const [newTotalAmount, setNewTotalAmount] = useState<number>(5000);
  const [newMonthlyCap, setNewMonthlyCap] = useState<number>(400);
  const [newPriority, setNewPriority] = useState<number>(1);
  const [newNotes, setNewNotes] = useState<string>('');

  const applyFilterChanges = (updatedFilters: Partial<GarnishmentFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setOrders(EnterpriseGarnishmentServiceHandler.fetchGarnishmentOrders(nextFilters));
  };

  const handleDeductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    EnterpriseGarnishmentServiceHandler.processOrderDeduction(
      selectedOrder.id,
      deductAmount,
      payPeriod
    );

    setDeductions(EnterpriseGarnishmentServiceHandler.fetchDeductionHistory());
    setIsDeductSuccess(true);
    setTimeout(() => {
      setIsDeductSuccess(false);
      setSelectedOrder(null);
    }, 1800);
  };

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    EnterpriseGarnishmentServiceHandler.createNewGarnishmentOrder({
      employeeName: newEmployeeName,
      employeeId: newEmployeeId,
      garnishmentType: newType,
      issuingAgency: newAgency,
      caseNumber: newCaseNumber,
      totalOrderAmount: newTotalAmount,
      monthlyDeductionCap: newMonthlyCap,
      priorityLevel: newPriority,
      issuedDate: 'Aug 18, 2026',
      notes: newNotes,
    });

    setOrders(EnterpriseGarnishmentServiceHandler.fetchGarnishmentOrders(filters));
    setShowCreateModal(false);
    setNewEmployeeName('');
    setNewEmployeeId('');
    setNewAgency('');
    setNewCaseNumber('');
    setNewNotes('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-md border border-red-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-red-200">
              <Sparkles className="w-4 h-4 text-red-300" />
              Legal & Statutory Wage Garnishment Engine
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Enterprise Garnishments & Child Support Suite
            </h1>
            <p className="text-red-200 text-base sm:text-lg leading-relaxed">
              Automate CCPA-compliant child support withholdings, IRS tax levies, defaulted student loans, and creditor wage garnishments with priority rules.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-red-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-red-600" />
                Register Garnishment Order
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
                placeholder="Search by employee name, case number, or issuing agency..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm text-gray-900"
              />
            </div>

            {/* Type Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.garnishmentType}
                onChange={(e) => applyFilterChanges({ garnishmentType: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Types</option>
                <option value="child-support">Child Support (Priority 1)</option>
                <option value="tax-levy">IRS Tax Levy</option>
                <option value="student-loan">Student Loans</option>
                <option value="creditor-judgement">Creditor Judgements</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Scale className="w-6 h-6 text-red-600" />
              Active Court Orders & Levies ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No garnishment orders found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or type filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {orders.map((o) => (
                <GarnishmentOrderCard
                  key={o.id}
                  order={o}
                  onDeductClick={(selected) => setSelectedOrder(selected)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timeline Audit Log */}
        <GarnishmentActivityTimeline deductions={deductions} />

        {/* Deduct Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedOrder(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isDeductSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Deduction Processed!</h3>
                  <p className="text-sm text-gray-600">
                    Wage deduction of ${deductAmount} for Case #{selectedOrder.caseNumber} recorded and queued for disbursement.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleDeductSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedOrder.employeeName}</h3>
                    <p className="text-xs text-red-600 font-semibold mt-1">
                      Case #{selectedOrder.caseNumber} • {selectedOrder.issuingAgency}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Withholding Amount ($)</label>
                      <input
                        type="number"
                        required
                        min={10}
                        max={selectedOrder.monthlyDeductionCap}
                        value={deductAmount}
                        onChange={(e) => setDeductAmount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Pay Period</label>
                      <input
                        type="text"
                        required
                        value={payPeriod}
                        onChange={(e) => setPayPeriod(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                  >
                    Confirm & Queue Disbursement
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Register Order Modal */}
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
                <h3 className="text-2xl font-bold text-gray-900">Register Garnishment Order</h3>
                <p className="text-xs text-gray-500 mt-1">Add legal wage withholding or child support court mandate.</p>
              </div>

              <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Vance"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP-3012"
                      value={newEmployeeId}
                      onChange={(e) => setNewEmployeeId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-white"
                    >
                      <option value="child-support">Child Support</option>
                      <option value="tax-levy">IRS Tax Levy</option>
                      <option value="student-loan">Student Loans</option>
                      <option value="creditor-judgement">Creditor Judgement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Case Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS-994821"
                      value={newCaseNumber}
                      onChange={(e) => setNewCaseNumber(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Issuing Court / State Agency</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. California DCSS"
                    value={newAgency}
                    onChange={(e) => setNewAgency(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Total Order ($)</label>
                    <input
                      type="number"
                      required
                      min={100}
                      value={newTotalAmount}
                      onChange={(e) => setNewTotalAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Monthly Cap ($)</label>
                    <input
                      type="number"
                      required
                      min={50}
                      value={newMonthlyCap}
                      onChange={(e) => setNewMonthlyCap(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Order Notes & Statutory Limits</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Provide court mandate specification..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Register Court Order
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
