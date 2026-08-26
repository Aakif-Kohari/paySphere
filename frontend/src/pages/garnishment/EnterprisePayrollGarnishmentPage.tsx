import React, { useState } from 'react';
import { GarnishmentCard, GarnishmentOrder } from '../../components/garnishment/GarnishmentCard';
import { GarnishmentRemittanceTimeline } from '../../components/garnishment/GarnishmentRemittanceTimeline';

/**
 * Enterprise Payroll Garnishment & Statutory Tax Liens Dashboard Page.
 * Compliance dashboard for court-ordered child support, tax liens, student loan withholdings,
 * CCPA disposable earnings limits, and agency payment remittances.
 */
export default function EnterprisePayrollGarnishmentPage() {
  const [orders, setOrders] = useState<GarnishmentOrder[]>([
    {
      garnishmentId: 'GARN-901',
      employeeId: 'EMP-3011',
      employeeFullName: 'David Miller',
      garnishmentType: 'CHILD_SUPPORT',
      courtOrderCaseNumber: 'CS-2026-9901',
      issuingAgencyName: 'State Disbursement Unit',
      totalOrderedAmountUsd: 12000,
      remainingBalanceUsd: 4500,
      deductionPerPayPeriodUsd: 450,
      disposableEarningsCapPercentage: 50.0,
      garnishmentStatus: 'ACTIVE_DEDUCTION',
    },
    {
      garnishmentId: 'GARN-902',
      employeeId: 'EMP-3012',
      employeeFullName: 'Rachel Thorne',
      garnishmentType: 'FEDERAL_TAX_LIEN',
      courtOrderCaseNumber: 'IRS-TL-8812',
      issuingAgencyName: 'Internal Revenue Service',
      totalOrderedAmountUsd: 18500,
      remainingBalanceUsd: 11200,
      deductionPerPayPeriodUsd: 600,
      disposableEarningsCapPercentage: 25.0,
      garnishmentStatus: 'ACTIVE_DEDUCTION',
    },
  ]);

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    employeeFullName: '',
    employeeId: '',
    garnishmentType: 'CHILD_SUPPORT',
    courtOrderCaseNumber: '',
    issuingAgencyName: '',
    totalOrderedAmountUsd: 5000,
    deductionPerPayPeriodUsd: 300,
    disposableEarningsCapPercentage: 50.0,
  });

  const handleProcessRemittance = (garnishmentId: string) => {
    alert(`Triggered pay-period agency remittance for Garnishment ${garnishmentId}`);
  };

  const handleRegisterGarnishment = (e: React.FormEvent) => {
    e.preventDefault();
    const created: GarnishmentOrder = {
      garnishmentId: `GARN-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      employeeId: newOrder.employeeId,
      employeeFullName: newOrder.employeeFullName,
      garnishmentType: newOrder.garnishmentType,
      courtOrderCaseNumber: newOrder.courtOrderCaseNumber,
      issuingAgencyName: newOrder.issuingAgencyName,
      totalOrderedAmountUsd: newOrder.totalOrderedAmountUsd,
      remainingBalanceUsd: newOrder.totalOrderedAmountUsd,
      deductionPerPayPeriodUsd: newOrder.deductionPerPayPeriodUsd,
      disposableEarningsCapPercentage: newOrder.disposableEarningsCapPercentage,
      garnishmentStatus: 'ACTIVE_DEDUCTION',
    };

    setOrders([created, ...orders]);
    setShowRegisterModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-slate-800 rounded-3xl p-8 mb-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Consumer Credit Protection Act (CCPA) Compliant
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                Statutory Wage Garnishment & Tax Liens
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">
              Enterprise Payroll Garnishment & Liens Hub
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              Surveillance dashboard for managing court-ordered child support, IRS federal tax liens, disposable earnings limit enforcement, and automated state agency remittances.
            </p>
          </div>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl shadow-amber-600/25 transition-all transform hover:-translate-y-0.5"
          >
            + Register Garnishment Order
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Active Garnishment Orders
          </span>
          <span className="text-white text-3xl font-black">{orders.length}</span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Total Remaining Balance
          </span>
          <span className="text-amber-400 text-3xl font-black">
            ${orders.reduce((acc, o) => acc + o.remainingBalanceUsd, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Pay-Period Remittance Outflow
          </span>
          <span className="text-emerald-400 text-3xl font-black">
            ${orders.reduce((acc, o) => acc + o.deductionPerPayPeriodUsd, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            CCPA Compliance Rate
          </span>
          <span className="text-cyan-400 text-3xl font-black">100%</span>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {orders.map((o) => (
          <GarnishmentCard
            key={o.garnishmentId}
            order={o}
            onProcessRemittance={handleProcessRemittance}
          />
        ))}
      </div>

      {/* Audit Timeline */}
      <GarnishmentRemittanceTimeline orders={orders} />

      {/* Register Garnishment Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl">
            <h3 className="text-white font-extrabold text-2xl mb-6">Register Court Garnishment Order</h3>
            <form onSubmit={handleRegisterGarnishment} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1">Employee Full Name</label>
                <input
                  type="text"
                  required
                  value={newOrder.employeeFullName}
                  onChange={(e) => setNewOrder({ ...newOrder, employeeFullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Employee ID Ref</label>
                  <input
                    type="text"
                    required
                    value={newOrder.employeeId}
                    onChange={(e) => setNewOrder({ ...newOrder, employeeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Garnishment Type</label>
                  <select
                    value={newOrder.garnishmentType}
                    onChange={(e) => setNewOrder({ ...newOrder, garnishmentType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  >
                    <option value="CHILD_SUPPORT">Child Support</option>
                    <option value="FEDERAL_TAX_LIEN">Federal Tax Lien (IRS)</option>
                    <option value="STUDENT_LOAN">Student Loan Garnishment</option>
                    <option value="CREDITOR_GARNISHMENT">Creditor Garnishment</option>
                    <option value="STATE_TAX_LIEN">State Tax Lien</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Court Case Number</label>
                  <input
                    type="text"
                    required
                    value={newOrder.courtOrderCaseNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, courtOrderCaseNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Issuing Agency Name</label>
                  <input
                    type="text"
                    required
                    value={newOrder.issuingAgencyName}
                    onChange={(e) => setNewOrder({ ...newOrder, issuingAgencyName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Total Ordered ($)</label>
                  <input
                    type="number"
                    value={newOrder.totalOrderedAmountUsd}
                    onChange={(e) => setNewOrder({ ...newOrder, totalOrderedAmountUsd: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Deduction / Pay Period ($)</label>
                  <input
                    type="number"
                    value={newOrder.deductionPerPayPeriodUsd}
                    onChange={(e) => setNewOrder({ ...newOrder, deductionPerPayPeriodUsd: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="bg-slate-800 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  Register Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
