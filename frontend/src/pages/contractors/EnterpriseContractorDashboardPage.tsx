import React, { useState } from 'react';
import {
  EnterpriseContractorServiceHandler,
} from '../../../backend/src/services/EnterpriseContractorService';
import {
  ContractorProfile,
  ContractorPayout,
  ContractorFilterOptions,
} from '../../../backend/src/models/EnterpriseContractorModel';
import { ContractorProfileCard } from '../../components/contractors/ContractorProfileCard';
import { ContractorActivityTimeline } from '../../components/contractors/ContractorActivityTimeline';
import {
  Globe,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  Send,
  FileCheck,
} from 'lucide-react';

export const EnterpriseContractorDashboardPage: React.FC = () => {
  const [contractors, setContractors] = useState<ContractorProfile[]>(() =>
    EnterpriseContractorServiceHandler.fetchContractors()
  );
  const [payouts, setPayouts] = useState<ContractorPayout[]>(() =>
    EnterpriseContractorServiceHandler.fetchContractorPayouts()
  );

  const [filters, setFilters] = useState<ContractorFilterOptions>({
    country: 'All',
    taxFormType: 'All',
    taxFormStatus: 'All',
    searchQuery: '',
  });

  const [selectedContractor, setSelectedContractor] = useState<ContractorProfile | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-2026-090');
  const [payoutAmount, setPayoutAmount] = useState<number>(3500);
  const [isPayoutSuccess, setIsPayoutSuccess] = useState<boolean>(false);

  // Onboard Modal
  const [showOnboardModal, setShowOnboardModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newTaxId, setNewTaxId] = useState<string>('');
  const [newCountry, setNewCountry] = useState<string>('United Kingdom');
  const [newCurrency, setNewCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'CAD' | 'INR' | 'AUD'>('GBP');
  const [newTaxForm, setNewTaxForm] = useState<'W-9' | 'W-8BEN' | 'W-8BEN-E'>('W-8BEN');
  const [newRate, setNewRate] = useState<number>(75);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'SWIFT' | 'SEPA' | 'ACH' | 'Wise'>('Wise');
  const [newTitle, setNewTitle] = useState<string>('');

  const applyFilterChanges = (updatedFilters: Partial<ContractorFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setContractors(EnterpriseContractorServiceHandler.fetchContractors(nextFilters));
  };

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractor) return;

    EnterpriseContractorServiceHandler.executeContractorPayout(
      selectedContractor.id,
      invoiceNumber,
      payoutAmount
    );

    setPayouts(EnterpriseContractorServiceHandler.fetchContractorPayouts());
    setIsPayoutSuccess(true);
    setTimeout(() => {
      setIsPayoutSuccess(false);
      setSelectedContractor(null);
    }, 1800);
  };

  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    EnterpriseContractorServiceHandler.onboardNewContractor({
      contractorName: newName,
      taxIdOrEin: newTaxId,
      country: newCountry,
      currency: newCurrency,
      taxFormType: newTaxForm,
      taxFormStatus: 'verified',
      hourlyRateOrRetainer: newRate,
      paymentMethod: newPaymentMethod,
      contractTitle: newTitle,
    });

    setContractors(EnterpriseContractorServiceHandler.fetchContractors(filters));
    setShowOnboardModal(false);
    setNewName('');
    setNewTaxId('');
    setNewTitle('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              Cross-Border Contractor Compliance & Multi-Currency Payout Engine
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Global Contractor Compliance & Payout Suite
            </h1>
            <p className="text-emerald-200 text-base sm:text-lg leading-relaxed">
              Streamline international contractor onboarding, IRS W-8BEN / W-9 verification, 1099 compliance, and multi-currency global invoice payouts.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowOnboardModal(true)}
                className="bg-white text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                Onboard International Contractor
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
                placeholder="Search by contractor name, contract title, or Tax ID / TIN..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-sm text-gray-900"
              />
            </div>

            {/* Tax Form Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.taxFormType}
                onChange={(e) => applyFilterChanges({ taxFormType: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Tax Forms</option>
                <option value="W-9">US W-9 Form</option>
                <option value="W-8BEN">Foreign W-8BEN</option>
                <option value="W-8BEN-E">Entity W-8BEN-E</option>
              </select>

              {/* Status Dropdown */}
              <select
                value={filters.taxFormStatus}
                onChange={(e) => applyFilterChanges({ taxFormStatus: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Verification States</option>
                <option value="verified">Verified Tax Form</option>
                <option value="pending-review">Pending Review</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contractors Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Globe className="w-6 h-6 text-emerald-600" />
              Active International Contractors ({contractors.length})
            </h2>
          </div>

          {contractors.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No contractors found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or tax form filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {contractors.map((c) => (
                <ContractorProfileCard
                  key={c.id}
                  contractor={c}
                  onPayoutClick={(selected) => setSelectedContractor(selected)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Payout History Timeline */}
        <ContractorActivityTimeline payouts={payouts} />

        {/* Payout Modal */}
        {selectedContractor && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedContractor(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isPayoutSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Payout Executed!</h3>
                  <p className="text-sm text-gray-600">
                    Payout of {payoutAmount} {selectedContractor.currency} for invoice #{invoiceNumber} sent via {selectedContractor.paymentMethod}.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePayoutSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedContractor.contractorName}</h3>
                    <p className="text-xs text-emerald-600 font-semibold mt-1">
                      Tax Form: {selectedContractor.taxFormType} ({selectedContractor.taxFormStatus})
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number</label>
                      <input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Amount ({selectedContractor.currency})</label>
                      <input
                        type="number"
                        required
                        min={50}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Disburse Global Invoice Payout
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Onboard Modal */}
        {showOnboardModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowOnboardModal(false)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Onboard Contractor Profile</h3>
                <p className="text-xs text-gray-500 mt-1">Register international vendor with IRS W-8/W-9 tax forms.</p>
              </div>

              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contractor / Entity Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Liam O'Connor"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tax ID / SSN / EIN</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. W8BEN-IE-901"
                      value={newTaxId}
                      onChange={(e) => setNewTaxId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ireland"
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="INR">INR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tax Form</label>
                    <select
                      value={newTaxForm}
                      onChange={(e) => setNewTaxForm(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    >
                      <option value="W-8BEN">W-8BEN</option>
                      <option value="W-9">W-9</option>
                      <option value="W-8BEN-E">W-8BEN-E</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Rate / Retainer ($)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={newRate}
                      onChange={(e) => setNewRate(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Payout Method</label>
                    <select
                      value={newPaymentMethod}
                      onChange={(e) => setNewPaymentMethod(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    >
                      <option value="SEPA">SEPA</option>
                      <option value="SWIFT">SWIFT</option>
                      <option value="ACH">ACH</option>
                      <option value="Wise">Wise</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contract Title / Statement of Work</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Full-Stack React Consulting"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Onboard & Verify Tax Document
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
