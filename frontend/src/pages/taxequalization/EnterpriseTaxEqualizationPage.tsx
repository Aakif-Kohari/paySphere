import React, { useState } from 'react';
import { TaxEqualizationCard, TaxEqualizationProfile } from '../../components/taxequalization/TaxEqualizationCard';
import { TaxEqualizationTimeline } from '../../components/taxequalization/TaxEqualizationTimeline';

/**
 * Enterprise Global Mobility & Tax Equalization Dashboard Page.
 * Surveillance platform for expatriate tax equalization, hypothetical home tax deductions,
 * host country tax liability calculation, OECD tax treaty exemptions, and year-end settlements.
 */
export default function EnterpriseTaxEqualizationPage() {
  const [profiles, setProfiles] = useState<TaxEqualizationProfile[]>([
    {
      profileId: 'TAX-EQ-901',
      expatriateEmployeeId: 'EXP-5011',
      expatriateFullName: 'Julian Sterling',
      homeCountryCode: 'USA',
      hostCountryCode: 'SGP',
      hypotheticalTaxPercentage: 28.0,
      actualHostTaxRatePercentage: 15.0,
      annualBaseSalaryUsd: 185000,
      annualExpatAllowancesUsd: 45000,
      equalizationDifferentialBalanceUsd: -17250,
      taxTreatyExemptionStatus: 'FEIE_SECTION_911_ACTIVE',
      profileStatus: 'ACTIVE_ASSIGNMENT',
    },
    {
      profileId: 'TAX-EQ-902',
      expatriateEmployeeId: 'EXP-5012',
      expatriateFullName: 'Claire Dupont',
      homeCountryCode: 'DEU',
      hostCountryCode: 'JPN',
      hypotheticalTaxPercentage: 42.0,
      actualHostTaxRatePercentage: 33.0,
      annualBaseSalaryUsd: 210000,
      annualExpatAllowancesUsd: 55000,
      equalizationDifferentialBalanceUsd: 12400,
      taxTreatyExemptionStatus: 'OECD_183_DAY_RULE_EXEMPT',
      profileStatus: 'ACTIVE_ASSIGNMENT',
    },
  ]);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [newProfile, setNewProfile] = useState({
    expatriateFullName: '',
    expatriateEmployeeId: '',
    homeCountryCode: 'USA',
    hostCountryCode: 'GBR',
    hypotheticalTaxPercentage: 30.0,
    actualHostTaxRatePercentage: 40.0,
    annualBaseSalaryUsd: 160000,
    annualExpatAllowancesUsd: 35000,
  });

  const handleProcessReconciliation = (profileId: string) => {
    alert(`Triggered year-end tax reconciliation settlement for Profile ${profileId}`);
  };

  const handleEnrollExpatriate = (e: React.FormEvent) => {
    e.preventDefault();
    const totalComp = newProfile.annualBaseSalaryUsd + newProfile.annualExpatAllowancesUsd;
    const hypo = (newProfile.annualBaseSalaryUsd * newProfile.hypotheticalTaxPercentage) / 100;
    const host = (totalComp * newProfile.actualHostTaxRatePercentage) / 100;
    const diff = parseFloat((host - hypo).toFixed(2));

    const created: TaxEqualizationProfile = {
      profileId: `TAX-EQ-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      expatriateEmployeeId: newProfile.expatriateEmployeeId,
      expatriateFullName: newProfile.expatriateFullName,
      homeCountryCode: newProfile.homeCountryCode,
      hostCountryCode: newProfile.hostCountryCode,
      hypotheticalTaxPercentage: newProfile.hypotheticalTaxPercentage,
      actualHostTaxRatePercentage: newProfile.actualHostTaxRatePercentage,
      annualBaseSalaryUsd: newProfile.annualBaseSalaryUsd,
      annualExpatAllowancesUsd: newProfile.annualExpatAllowancesUsd,
      equalizationDifferentialBalanceUsd: diff,
      taxTreatyExemptionStatus: 'FEIE_SECTION_911_ACTIVE',
      profileStatus: 'ACTIVE_ASSIGNMENT',
    };

    setProfiles([created, ...profiles]);
    setShowEnrollModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-slate-800 rounded-3xl p-8 mb-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                OECD Article 15 & US IRC Sec 911 Compliant
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                Global Mobility Tax Equalization
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-2">
              Enterprise Global Mobility & Tax Hub
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              High-assurance platform for managing expatriate tax equalization policies, calculating hypothetical home tax deductions, modeling host assignment liabilities, and year-end reconciliation settlements.
            </p>
          </div>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-xl shadow-cyan-600/25 transition-all transform hover:-translate-y-0.5"
          >
            + Enroll Expatriate Profile
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Active Expat Profiles
          </span>
          <span className="text-white text-3xl font-black">{profiles.length}</span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Avg Home Hypo Tax
          </span>
          <span className="text-cyan-400 text-3xl font-black">
            {(profiles.reduce((acc, p) => acc + p.hypotheticalTaxPercentage, 0) / (profiles.length || 1)).toFixed(1)}%
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Avg Host Tax Rate
          </span>
          <span className="text-amber-400 text-3xl font-black">
            {(profiles.reduce((acc, p) => acc + p.actualHostTaxRatePercentage, 0) / (profiles.length || 1)).toFixed(1)}%
          </span>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
            Treaty Compliance
          </span>
          <span className="text-emerald-400 text-3xl font-black">100%</span>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {profiles.map((p) => (
          <TaxEqualizationCard
            key={p.profileId}
            profile={p}
            onProcessReconciliation={handleProcessReconciliation}
          />
        ))}
      </div>

      {/* Audit Timeline */}
      <TaxEqualizationTimeline profiles={profiles} />

      {/* Enroll Expat Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl">
            <h3 className="text-white font-extrabold text-2xl mb-6">Enroll Expatriate Tax Profile</h3>
            <form onSubmit={handleEnrollExpatriate} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs font-bold block mb-1">Expatriate Full Name</label>
                <input
                  type="text"
                  required
                  value={newProfile.expatriateFullName}
                  onChange={(e) => setNewProfile({ ...newProfile, expatriateFullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Employee ID Ref</label>
                  <input
                    type="text"
                    required
                    value={newProfile.expatriateEmployeeId}
                    onChange={(e) => setNewProfile({ ...newProfile, expatriateEmployeeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Home Country</label>
                  <input
                    type="text"
                    required
                    value={newProfile.homeCountryCode}
                    onChange={(e) => setNewProfile({ ...newProfile, homeCountryCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Host Country</label>
                  <input
                    type="text"
                    required
                    value={newProfile.hostCountryCode}
                    onChange={(e) => setNewProfile({ ...newProfile, hostCountryCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Home Hypo Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newProfile.hypotheticalTaxPercentage}
                    onChange={(e) => setNewProfile({ ...newProfile, hypotheticalTaxPercentage: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Host Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newProfile.actualHostTaxRatePercentage}
                    onChange={(e) => setNewProfile({ ...newProfile, actualHostTaxRatePercentage: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Annual Base Salary ($)</label>
                  <input
                    type="number"
                    value={newProfile.annualBaseSalaryUsd}
                    onChange={(e) => setNewProfile({ ...newProfile, annualBaseSalaryUsd: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-xs font-bold block mb-1">Annual Expat Allowances ($)</label>
                  <input
                    type="number"
                    value={newProfile.annualExpatAllowancesUsd}
                    onChange={(e) => setNewProfile({ ...newProfile, annualExpatAllowancesUsd: parseFloat(e.target.value) })}
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
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  Enroll Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
