import React, { useState } from 'react';
import {
  Building2,
  Shield,
  DollarSign,
  Clock,
  Fingerprint,
  Mail,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sliders,
} from 'lucide-react';

export interface TenantSettings {
  companyName: string;
  fiscalYearStart: string;
  defaultCurrency: string;
  timezone: string;
  mfaEnforced: boolean;
  autoApproveExpensesUnder: number;
  allowBiometricClockIn: boolean;
  allowToilEncashment: boolean;
  notificationEmail: string;
}

export interface SettingsPanelProps {
  initialSettings?: Partial<TenantSettings>;
  onSave: (settings: TenantSettings) => Promise<void> | void;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: string | null;
}

const DEFAULT_SETTINGS: TenantSettings = {
  companyName: 'PaySphere Enterprise',
  fiscalYearStart: 'April',
  defaultCurrency: 'INR',
  timezone: 'Asia/Kolkata',
  mfaEnforced: true,
  autoApproveExpensesUnder: 1000,
  allowBiometricClockIn: true,
  allowToilEncashment: true,
  notificationEmail: 'finance@paysphere.io',
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialSettings = {},
  onSave,
  isLoading = false,
  isSaving = false,
  error = null,
}) => {
  const [settings, setSettings] = useState<TenantSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  const [activeTab, setActiveTab] = useState<'general' | 'payroll' | 'security' | 'attendance'>('general');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
    setSaveSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by parent
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 font-mono">
        Loading organization settings...
      </div>
    );
  }

  return (
    <div
      data-testid="settings-panel"
      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl text-slate-100 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-indigo-400" />
            Organization & System Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure tenant global payroll rules, statutory fiscal parameters, and security policies
          </p>
        </div>

        {saveSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800/80 my-6 pb-2 overflow-x-auto text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
            activeTab === 'general'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>General</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
            activeTab === 'payroll'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Payroll & Fiscal</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
            activeTab === 'security'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Security & MFA</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
            activeTab === 'attendance'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Fingerprint className="w-3.5 h-3.5" />
          <span>Attendance & TOIL</span>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Company Legal Name</label>
              <input
                type="text"
                name="companyName"
                value={settings.companyName}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Default Timezone</label>
                <select
                  name="timezone"
                  value={settings.timezone}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Billing Notification Email</label>
                <input
                  type="email"
                  name="notificationEmail"
                  value={settings.notificationEmail}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Fiscal Year Start Month</label>
                <select
                  name="fiscalYearStart"
                  value={settings.fiscalYearStart}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="April">April (Indian Statutory Standard)</option>
                  <option value="January">January (Calendar Year Standard)</option>
                  <option value="July">July (Australian Standard)</option>
                  <option value="October">October (US Federal Standard)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">Default Functional Currency</label>
                <select
                  name="defaultCurrency"
                  value={settings.defaultCurrency}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">
                Auto-Approve Micro-Expenses Under ({settings.defaultCurrency})
              </label>
              <input
                type="number"
                name="autoApproveExpensesUnder"
                value={settings.autoApproveExpensesUnder}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Claims below this threshold bypass Level 1 manager review.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Enforce Multi-Factor Authentication (MFA)</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Require TOTP authenticator app verification on every payroll & disbursement action.
                </p>
              </div>
              <input
                type="checkbox"
                name="mfaEnforced"
                checked={settings.mfaEnforced}
                onChange={handleChange}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Biometric & Geo-Fence Clock-In</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Allow mobile face/fingerprint sync and GPS-restricted attendance punches.
                </p>
              </div>
              <input
                type="checkbox"
                name="allowBiometricClockIn"
                checked={settings.allowBiometricClockIn}
                onChange={handleChange}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-200">Enable TOIL Encashment</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Allow employees to convert unutilized comp-off days into taxable overtime pay.
                </p>
              </div>
              <input
                type="checkbox"
                name="allowToilEncashment"
                checked={settings.allowToilEncashment}
                onChange={handleChange}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPanel;
