import React, { useState } from 'react';
import {
  EnterpriseDirectDepositServiceHandler,
} from '../../../backend/src/services/EnterpriseDirectDepositService';
import {
  BankAccount,
  DirectDepositTransaction,
  DirectDepositFilterOptions,
} from '../../../backend/src/models/EnterpriseDirectDepositModel';
import { BankAccountCard } from '../../components/directdeposit/BankAccountCard';
import { DirectDepositActivityTimeline } from '../../components/directdeposit/DirectDepositActivityTimeline';
import {
  Building2,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  Send,
  CreditCard,
} from 'lucide-react';

export const EnterpriseDirectDepositDashboardPage: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>(() =>
    EnterpriseDirectDepositServiceHandler.fetchBankAccounts()
  );
  const [transactions, setTransactions] = useState<DirectDepositTransaction[]>(() =>
    EnterpriseDirectDepositServiceHandler.fetchDirectDepositTransactions()
  );

  const [filters, setFilters] = useState<DirectDepositFilterOptions>({
    bankName: 'All',
    accountType: 'All',
    verificationStatus: 'All',
    searchQuery: '',
  });

  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [transferAmount, setTransferAmount] = useState<number>(4500);
  const [payPeriod, setPayPeriod] = useState<string>('Aug 1 - Aug 15, 2026');
  const [isTransferSuccess, setIsTransferSuccess] = useState<boolean>(false);

  // Add Bank Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newEmployeeName, setNewEmployeeName] = useState<string>('');
  const [newEmployeeId, setNewEmployeeId] = useState<string>('');
  const [newBankName, setNewBankName] = useState<string>('');
  const [newAccountType, setNewAccountType] = useState<'checking' | 'savings'>('checking');
  const [newRouting, setNewRouting] = useState<string>('021000021');
  const [newAccountNum, setNewAccountNum] = useState<string>('884199201');
  const [newSplitType, setNewSplitType] = useState<'percentage' | 'fixed-amount' | 'remainder'>('percentage');
  const [newSplitValue, setNewSplitValue] = useState<number>(100);

  const applyFilterChanges = (updatedFilters: Partial<DirectDepositFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setAccounts(EnterpriseDirectDepositServiceHandler.fetchBankAccounts(nextFilters));
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    EnterpriseDirectDepositServiceHandler.processDirectDepositTransfer(
      selectedAccount.id,
      transferAmount,
      payPeriod
    );

    setTransactions(EnterpriseDirectDepositServiceHandler.fetchDirectDepositTransactions());
    setIsTransferSuccess(true);
    setTimeout(() => {
      setIsTransferSuccess(false);
      setSelectedAccount(null);
    }, 1800);
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    EnterpriseDirectDepositServiceHandler.registerNewBankAccount({
      employeeName: newEmployeeName,
      employeeId: newEmployeeId,
      bankName: newBankName,
      accountType: newAccountType,
      routingNumberMasked: `*****${newRouting.slice(-4)}`,
      accountNumberMasked: `******${newAccountNum.slice(-4)}`,
      splitType: newSplitType,
      splitValue: newSplitValue,
      priorityOrder: 1,
      isPrimary: true,
    });

    setAccounts(EnterpriseDirectDepositServiceHandler.fetchBankAccounts(filters));
    setShowAddModal(false);
    setNewEmployeeName('');
    setNewEmployeeId('');
    setNewBankName('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-200">
              <Sparkles className="w-4 h-4 text-blue-300" />
              Automated NACHA File Generation & Split Deposit Engine
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Enterprise Direct Deposit & Banking Suite
            </h1>
            <p className="text-blue-200 text-base sm:text-lg leading-relaxed">
              Manage multi-account payroll splits (checking, high-yield savings), real-time micro-deposit verification, and electronic ACH fund disbursements.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-white text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-blue-600" />
                Add Employee Bank Account
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
                placeholder="Search by employee name, bank name, or account number..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm text-gray-900"
              />
            </div>

            {/* Account Type Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.accountType}
                onChange={(e) => applyFilterChanges({ accountType: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Account Types</option>
                <option value="checking">Checking Account</option>
                <option value="savings">Savings Account</option>
              </select>

              {/* Status Dropdown */}
              <select
                value={filters.verificationStatus}
                onChange={(e) => applyFilterChanges({ verificationStatus: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Verification States</option>
                <option value="verified">Verified Account</option>
                <option value="micro-deposit-pending">Micro-Deposit Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Accounts Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              Configured Direct Deposit Accounts ({accounts.length})
            </h2>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No bank accounts found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or account type filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {accounts.map((a) => (
                <BankAccountCard
                  key={a.id}
                  account={a}
                  onDepositClick={(selected) => setSelectedAccount(selected)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Audit Log Timeline */}
        <DirectDepositActivityTimeline transactions={transactions} />

        {/* Transfer Modal */}
        {selectedAccount && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedAccount(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isTransferSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">ACH Transfer Disbursed!</h3>
                  <p className="text-sm text-gray-600">
                    Direct deposit of ${transferAmount} sent to {selectedAccount.bankName} ({selectedAccount.accountNumberMasked}). NACHA batch generated.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleTransferSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedAccount.employeeName}</h3>
                    <p className="text-xs text-blue-600 font-semibold mt-1">
                      Bank: {selectedAccount.bankName} ({selectedAccount.accountNumberMasked})
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Deposit Transfer Amount ($)</label>
                      <input
                        type="number"
                        required
                        min={10}
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Pay Period</label>
                      <input
                        type="text"
                        required
                        value={payPeriod}
                        onChange={(e) => setPayPeriod(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Process Direct Deposit ACH Transfer
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Add Account Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Add Employee Bank Account</h3>
                <p className="text-xs text-gray-500 mt-1">Configure checking or savings account for payroll direct deposit.</p>
              </div>

              <form onSubmit={handleAddAccountSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Mercer"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP-4091"
                      value={newEmployeeId}
                      onChange={(e) => setNewEmployeeId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. JPMorgan Chase"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Account Type</label>
                    <select
                      value={newAccountType}
                      onChange={(e) => setNewAccountType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Routing Number (9 digits)</label>
                    <input
                      type="text"
                      required
                      maxLength={9}
                      placeholder="021000021"
                      value={newRouting}
                      onChange={(e) => setNewRouting(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      required
                      placeholder="884199201"
                      value={newAccountNum}
                      onChange={(e) => setNewAccountNum(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Split Method</label>
                    <select
                      value={newSplitType}
                      onChange={(e) => setNewSplitType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed-amount">Fixed Amount ($)</option>
                      <option value="remainder">Remainder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Split Value</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newSplitValue}
                      onChange={(e) => setNewSplitValue(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Verify & Register Bank Account
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
