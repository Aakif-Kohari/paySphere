import React, { useState } from 'react';
import { PensionAccountCard, PensionAccount } from '../../components/pension/PensionAccountCard';
import { PensionDisbursementTimeline } from '../../components/pension/PensionDisbursementTimeline';

/**
 * Enterprise Payroll Pension & Annuity Fund Management Dashboard Page.
 * Surveillance platform for retiree defined benefit and defined contribution accounts,
 * monthly annuity payouts, tax withholding administration, and ERISA statutory compliance.
 */
export default function EnterprisePensionAnnuityPage() {
  const [accounts, setAccounts] = useState<PensionAccount[]>([
    {
      pensionAccountId: 'PENS-901',
      retireeEmployeeId: 'EMP-7011',
      retireeFullName: 'Arthur Pendelton',
      pensionPlanType: 'DEFINED_BENEFIT',
      accumulatedCorpusAmount: 485000,
      monthlyAnnuityPayout: 3250.0,
      vestingStatus: 'FULLY_VESTED',
      taxWithholdingRatePercentage: 12.0,
      accountStatus: 'ACTIVE_DISBURSEMENT',
    },
    {
      pensionAccountId: 'PENS-902',
      retireeEmployeeId: 'EMP-7012',
      retireeFullName: 'Eleanor Vance',
      pensionPlanType: 'ANNUITY_GUARANTEED',
      accumulatedCorpusAmount: 620000,
      monthlyAnnuityPayout: 4150.0,
      vestingStatus: 'FULLY_VESTED',
      taxWithholdingRatePercentage: 10.0,
      accountStatus: 'ACTIVE_DISBURSEMENT',
    },
  ]);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [newRetiree, setNewRetiree] = useState({
    retireeFullName: '',
    retireeEmployeeId: '',
    pensionPlanType: 'DEFINED_BENEFIT',
    yearsOfService: 25,
    averageFinalSalary: 95000,
    accumulatedCorpusAmount: 350000,
    taxWithholdingRatePercentage: 10.0,
  });

  const handleExecuteDisbursement = (accountId: string) => {
    alert(`Triggered monthly annuity disbursement protocol for Pension Account ${accountId}`);
  };

  const handleEnrollRetiree = (e: React.FormEvent) => {
    e.preventDefault();
    const annual = newRetiree.yearsOfService * newRetiree.averageFinalSalary * 0.015;
    const monthlyPayout = parseFloat((annual / 12).toFixed(2));

    const created: PensionAccount = {
      pensionAccountId: `PENS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      retireeEmployeeId: newRetiree.retireeEmployeeId,
      retireeFullName: newRetiree.retireeFullName,
      pensionPlanType: newRetiree.pensionPlanType,
      accumulatedCorpusAmount: newRetiree.accumulatedCorpusAmount,
      monthlyAnnuityPayout: monthlyPayout,
      vestingStatus: 'FULLY_VESTED',
      taxWithholdingRatePercentage: newRetiree.taxWithholdingRatePercentage,
      accountStatus: 'ACTIVE_DISBURSEMENT',
    };

    setAccounts([created, ...accounts]);
    setShowEnrollModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 rounded-3xl p-8 mb-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                ERISA & IRS Section 401(a) Compliant
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                Defined Benefit & Annuity Engine
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">
              Enterprise Pension & Annuity Fund Hub
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              High-assurance enterprise engine for managing retiree pension funds, calculating defined benefit annuity disbursements, statutory tax withholding, and audit telemetry.
            </p>
          </div>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5"
          >
            + Enroll Retiree Account
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Active Retiree Accounts
          </span>
          <span className="text-white text-3xl font-black">{accounts.length}</span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Total Pension Corpus
          </span>
          <span className="text-emerald-400 text-3xl font-black">
            ${(accounts.reduce((acc, a) => acc + a.accumulatedCorpusAmount, 0) / 1000000).toFixed(2)}M
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Monthly Payout Outflow
          </span>
          <span className="text-cyan-400 text-3xl font-black">
            ${accounts.reduce((acc, a) => acc + a.monthlyAnnuityPayout, 0).toLocaleString()}
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Vested Rate
          </span>
          <span className="text-amber-400 text-3xl font-black">100%</span>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {accounts.map((acc) => (
          <PensionAccountCard
            key={acc.pensionAccountId}
            account={acc}
            onExecuteDisbursement={handleExecuteDisbursement}
          />
        ))}
      </div>

      {/* Audit Timeline */}
      <PensionDisbursementTimeline accounts={accounts} />

      {/* Enroll Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl">
            <h3 className="text-white font-extrabold text-2xl mb-6">Enroll Retiree Pension Account</h3>
            <form onSubmit={handleEnrollRetiree} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1">Retiree Full Name</label>
                <input
                  type="text"
                  required
                  value={newRetiree.retireeFullName}
                  onChange={(e) => setNewRetiree({ ...newRetiree, retireeFullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Employee ID Ref</label>
                  <input
                    type="text"
                    required
                    value={newRetiree.retireeEmployeeId}
                    onChange={(e) => setNewRetiree({ ...newRetiree, retireeEmployeeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Plan Type</label>
                  <select
                    value={newRetiree.pensionPlanType}
                    onChange={(e) => setNewRetiree({ ...newRetiree, pensionPlanType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  >
                    <option value="DEFINED_BENEFIT">Defined Benefit</option>
                    <option value="DEFINED_CONTRIBUTION">Defined Contribution</option>
                    <option value="HYBRID_CASH_BALANCE">Hybrid Cash Balance</option>
                    <option value="ANNUITY_GUARANTEED">Guaranteed Annuity</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Years of Service</label>
                  <input
                    type="number"
                    value={newRetiree.yearsOfService}
                    onChange={(e) => setNewRetiree({ ...newRetiree, yearsOfService: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Average Final Salary ($)</label>
                  <input
                    type="number"
                    value={newRetiree.averageFinalSalary}
                    onChange={(e) => setNewRetiree({ ...newRetiree, averageFinalSalary: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="bg-slate-800 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  Enroll Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
