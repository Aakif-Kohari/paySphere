import React, { useState } from 'react';
import {
  EnterpriseTaxServiceHandler,
} from '../../../backend/src/services/EnterpriseTaxService';
import {
  TaxBracket,
  TaxFilingRecord,
  TaxFilterOptions,
} from '../../../backend/src/models/EnterpriseTaxModel';
import { TaxBracketCard } from '../../components/tax/TaxBracketCard';
import { TaxActivityTimeline } from '../../components/tax/TaxActivityTimeline';
import {
  Percent,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  X,
  Globe,
  Calculator,
} from 'lucide-react';

export const EnterpriseTaxDashboardPage: React.FC = () => {
  const [brackets, setBrackets] = useState<TaxBracket[]>(() =>
    EnterpriseTaxServiceHandler.fetchTaxBrackets()
  );
  const [records, setRecords] = useState<TaxFilingRecord[]>(() =>
    EnterpriseTaxServiceHandler.fetchTaxFilingRecords()
  );

  const [filters, setFilters] = useState<TaxFilterOptions>({
    jurisdiction: 'All',
    taxType: 'All',
    filingStatus: 'All',
    searchQuery: '',
  });

  const [selectedBracket, setSelectedBracket] = useState<TaxBracket | null>(null);
  const [simEmployeeName, setSimEmployeeName] = useState<string>('Alex Mercer');
  const [simEmployeeId, setSimEmployeeId] = useState<string>('EMP-4091');
  const [simState, setSimState] = useState<string>('California');
  const [simGrossPay, setSimGrossPay] = useState<number>(10000);
  const [simPayPeriod, setSimPayPeriod] = useState<string>('Aug 1 - Aug 15, 2026');
  const [isSimSuccess, setIsSimSuccess] = useState<boolean>(false);

  // Create Bracket Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newJurisdiction, setNewJurisdiction] = useState<string>('Federal (IRS)');
  const [newTaxType, setNewTaxType] = useState<'federal' | 'state' | 'local' | 'social-security' | 'medicare'>('federal');
  const [newFilingStatus, setNewFilingStatus] = useState<'single' | 'married-joint' | 'head-of-household'>('single');
  const [newRate, setNewRate] = useState<number>(24);
  const [newMinIncome, setNewMinIncome] = useState<number>(100525);
  const [newMaxIncome, setNewMaxIncome] = useState<number>(191950);
  const [newDescription, setNewDescription] = useState<string>('');

  const applyFilterChanges = (updatedFilters: Partial<TaxFilterOptions>) => {
    const nextFilters = { ...filters, ...updatedFilters };
    setFilters(nextFilters);
    setBrackets(EnterpriseTaxServiceHandler.fetchTaxBrackets(nextFilters));
  };

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    EnterpriseTaxServiceHandler.processEmployeeTaxWithholding(
      simEmployeeName,
      simEmployeeId,
      simState,
      'single',
      simGrossPay,
      simPayPeriod
    );

    setRecords(EnterpriseTaxServiceHandler.fetchTaxFilingRecords());
    setIsSimSuccess(true);
    setTimeout(() => {
      setIsSimSuccess(false);
      setSelectedBracket(null);
    }, 1800);
  };

  const handleCreateBracketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    EnterpriseTaxServiceHandler.createNewTaxBracket({
      jurisdiction: newJurisdiction,
      taxType: newTaxType,
      filingStatus: newFilingStatus,
      effectiveYear: 2026,
      ratePercentage: newRate,
      minIncome: newMinIncome,
      maxIncome: newMaxIncome,
      description: newDescription,
    });

    setBrackets(EnterpriseTaxServiceHandler.fetchTaxBrackets(filters));
    setShowCreateModal(false);
    setNewDescription('');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-200">
              <Sparkles className="w-4 h-4 text-blue-300" />
              Automated Federal, State & FICA Tax Computation Engine
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Enterprise Payroll Tax Withholding Suite
            </h1>
            <p className="text-blue-200 text-base sm:text-lg leading-relaxed">
              Manage multi-state income tax brackets, FICA Social Security & Medicare caps, and automated W-4 withholding calculations across global enterprise payrolls.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-indigo-950 font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2 text-sm"
              >
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                Configure Tax Bracket Rule
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
                placeholder="Search by jurisdiction, tax type, or bracket description..."
                value={filters.searchQuery}
                onChange={(e) => applyFilterChanges({ searchQuery: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-gray-900"
              />
            </div>

            {/* Tax Type Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.taxType}
                onChange={(e) => applyFilterChanges({ taxType: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Tax Types</option>
                <option value="federal">Federal Income Tax</option>
                <option value="state">State Income Tax</option>
                <option value="social-security">Social Security</option>
                <option value="medicare">Medicare</option>
              </select>

              {/* Jurisdiction Dropdown */}
              <select
                value={filters.jurisdiction}
                onChange={(e) => applyFilterChanges({ jurisdiction: e.target.value })}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-gray-800 font-medium bg-white"
              >
                <option value="All">All Jurisdictions</option>
                <option value="Federal (IRS)">Federal (IRS)</option>
                <option value="California (FTB)">California (FTB)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Brackets Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-gray-900 flex items-center gap-2">
              <Percent className="w-6 h-6 text-indigo-600" />
              Active Tax Bracket Rules ({brackets.length})
            </h2>
          </div>

          {brackets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-800 font-semibold text-lg">No tax brackets found</h3>
              <p className="text-gray-500 text-sm mt-1">Try broadening your search or tax type filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {brackets.map((b) => (
                <TaxBracketCard
                  key={b.id}
                  bracket={b}
                  onCalculateClick={(selected) => setSelectedBracket(selected)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tax Activity Timeline */}
        <TaxActivityTimeline records={records} />

        {/* Simulation Modal */}
        {selectedBracket && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button
                onClick={() => setSelectedBracket(null)}
                className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>

              {isSimSuccess ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-bold text-gray-900">Withholding Calculated!</h3>
                  <p className="text-sm text-gray-600">
                    Tax withholding record for {simEmployeeName} successfully created and stored in tax audit log.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSimulateSubmit} className="space-y-5">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{selectedBracket.jurisdiction}</h3>
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      Rule: {selectedBracket.description} ({selectedBracket.ratePercentage}%)
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Employee Name</label>
                      <input
                        type="text"
                        required
                        value={simEmployeeName}
                        onChange={(e) => setSimEmployeeName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID</label>
                        <input
                          type="text"
                          required
                          value={simEmployeeId}
                          onChange={(e) => setSimEmployeeId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Gross Pay ($)</label>
                        <input
                          type="number"
                          required
                          min={100}
                          value={simGrossPay}
                          onChange={(e) => setSimGrossPay(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Calculator className="w-4 h-4" />
                    Process Tax Withholding
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Create Bracket Modal */}
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
                <h3 className="text-2xl font-bold text-gray-900">Configure Tax Bracket</h3>
                <p className="text-xs text-gray-500 mt-1">Add new state or federal income tax withholding rule.</p>
              </div>

              <form onSubmit={handleCreateBracketSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Jurisdiction</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. New York (DTF)"
                    value={newJurisdiction}
                    onChange={(e) => setNewJurisdiction(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tax Type</label>
                    <select
                      value={newTaxType}
                      onChange={(e) => setNewTaxType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="federal">Federal Income Tax</option>
                      <option value="state">State Income Tax</option>
                      <option value="social-security">Social Security</option>
                      <option value="medicare">Medicare</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Percentage (%)</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min={0}
                      max={50}
                      value={newRate}
                      onChange={(e) => setNewRate(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rule Description</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Provide tax rule specification..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Publish Tax Bracket Rule
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
