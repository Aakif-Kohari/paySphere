import React, { useState } from 'react';
import { Building2, User, Mail, Lock, Users, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from 'lucide-react';

export interface RegistrationFormData {
  companyName: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  employeeCount: string;
  agreeToTerms: boolean;
}

export interface RegistrationFormProps {
  onSubmit: (data: RegistrationFormData) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
  onLoginRedirect?: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  onSubmit,
  loading = false,
  error = null,
  onLoginRedirect,
}) => {
  const [formData, setFormData] = useState<RegistrationFormData>({
    companyName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    employeeCount: '1-10',
    agreeToTerms: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      errors.companyName = 'Company name is required';
    }
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the Terms of Service';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onSubmit(formData);
    }
  };

  return (
    <div
      data-testid="registration-form"
      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl max-w-xl mx-auto backdrop-blur-xl text-slate-100"
    >
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black text-white tracking-tight">Create your PaySphere Account</h2>
        <p className="text-xs text-slate-400 mt-1">Start streamlining your global payroll and compliance operations</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Name */}
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5">Company Name</label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="companyName"
              placeholder="Acme Corporation"
              value={formData.companyName}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
          {validationErrors.companyName && (
            <p className="text-rose-400 text-[11px] mt-1">{validationErrors.companyName}</p>
          )}
        </div>

        {/* Full Name & Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="fullName"
                placeholder="Jane Doe"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            {validationErrors.fullName && (
              <p className="text-rose-400 text-[11px] mt-1">{validationErrors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                placeholder="jane@acme.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            {validationErrors.email && (
              <p className="text-rose-400 text-[11px] mt-1">{validationErrors.email}</p>
            )}
          </div>
        </div>

        {/* Passwords */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {validationErrors.password && (
              <p className="text-rose-400 text-[11px] mt-1">{validationErrors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p className="text-rose-400 text-[11px] mt-1">{validationErrors.confirmPassword}</p>
            )}
          </div>
        </div>

        {/* Employee Count */}
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5">Employee Size</label>
          <div className="relative">
            <Users className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              name="employeeCount"
              value={formData.employeeCount}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="1-10">1 - 10 Employees (Startup)</option>
              <option value="11-50">11 - 50 Employees (Growth)</option>
              <option value="51-250">51 - 250 Employees (Mid-Market)</option>
              <option value="250+">250+ Employees (Enterprise)</option>
            </select>
          </div>
        </div>

        {/* Terms Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400">
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className="mt-0.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              I agree to the <span className="text-indigo-400 hover:underline">Terms of Service</span> and <span className="text-indigo-400 hover:underline">Privacy Policy</span>.
            </span>
          </label>
          {validationErrors.agreeToTerms && (
            <p className="text-rose-400 text-[11px] mt-1">{validationErrors.agreeToTerms}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 mt-4"
        >
          {loading ? (
            <span>Creating Account...</span>
          ) : (
            <>
              <span>Get Started with PaySphere</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {onLoginRedirect && (
        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onLoginRedirect}
            className="text-indigo-400 hover:underline font-semibold"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );
};

export default RegistrationForm;
