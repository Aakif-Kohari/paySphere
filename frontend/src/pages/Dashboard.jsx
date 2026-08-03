import DownloadIcon from '@mui/icons-material/Download';
import { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logout } from '../features/auth/authSlice';
import ThemeToggle from '../components/ThemeToggle';
import Sidebar from '../components/Sidebar';
import EmployeeCard from '../components/EmployeeCard';
import Approvals from './Approvals';
import Settlements from './Settlements';
import Loans from './Loans';
import SettingsModal from '../components/SettingsModal';
import EmptyState from '../components/common/EmptyState';
import {
  EmployeeBreakdownSkeleton,
  EmployeeCardSkeleton,
  StatCardSkeleton,
} from '../components/common/Skeleton';
import api from '../services/api';
import { exportEmployeesToCsv } from '../utils/exportEmployeesToCsv';
import useCtrlEnterSubmit from '../hooks/useCtrlEnterSubmit';

// Trigger a file download from the browser
const downloadFile = (url, filename) => {
  const token = localStorage.getItem('token');
  const baseUrl =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
      ? typeof window !== 'undefined'
        ? window.location.origin
        : ''
      : 'http://localhost:5000');
  fetch(`${baseUrl}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error('No data to export');
      return res.blob();
    })
    .then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    })
    .catch((err) => {
      console.error('Export failed:', err);
      alert(
        'No payroll data found for the current month. Finalize payroll first.',
      );
    });
};

// --- Dashboard Overview Component ---
const DashboardOverview = ({
  search,
  setSearch,
  filtered,
  navigate,
  onAddUpdate,
  onAddEmployee,
  totalPayout,
  employeeCount,
  loading,
  payrolls,
  onEditEmployee,
}) => {
  const payrollMap = {};
  (payrolls || []).forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const [gettingStarted, setGettingStarted] = useState(() => {
    return localStorage.getItem('showGettingStartedCard') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('showGettingStartedCard', gettingStarted);
  }, [gettingStarted]);

  function handleCloseBtn() {
    setGettingStarted(false);
  }

  return (
    <main className="p-4 sm:p-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Monthly Overview
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white">
            {new Date().toLocaleString('default', {
              month: 'long',
              year: 'numeric',
            })}
          </h1>
        </div>

        <div className="w-full sm:w-auto mt-4 md:mt-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full sm:w-auto px-4 py-3 border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:border-blue-500 outline-none transition-colors"
          />
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => navigate('/reports')}
            className="flex-1 cursor-pointer sm:flex-none px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 transition-colors"
          >
            Reports
          </button>

          <button
            onClick={() =>
              downloadFile('/api/payroll/export-csv', `payroll-export.csv`)
            }
            className="flex-1 cursor-pointer sm:flex-none px-5 py-2.5 border border-gray-200 dark:border-slate-800 dark:text-slate-200 rounded-lg text-sm font-semibold hover:shadow dark:hover:bg-slate-800 transition-colors"
          >
            Export CSV
          </button>

          <button
            onClick={onAddUpdate}
            className="flex-1 cursor-pointer sm:flex-none px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Run Payroll
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        {loading ? (
          <>
            <StatCardSkeleton />
            <div className="w-full sm:w-64">
              <StatCardSkeleton />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
              <p className="text-xs uppercase text-gray-500 dark:text-slate-500 font-bold mb-2">
                Total Monthly Payout
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                ₹{totalPayout.toLocaleString('en-IN')}
              </h2>
              <p className="text-gray-500 dark:text-slate-500 text-sm mt-2">
                {employeeCount} employees on payroll
              </p>
            </div>

            <div className="w-full sm:w-64 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
              <p className="text-xs uppercase text-gray-500 dark:text-slate-500 font-bold mb-2">
                Employees
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                {employeeCount}
              </h2>
              <p className="text-gray-500 dark:text-slate-500 text-sm">
                Active this month
              </p>
            </div>
          </>
        )}
      </div>

      {/* Getting Started */}
      {gettingStarted && (
        <div className="relative mx-auto my-8 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={handleCloseBtn}
            aria-label="Dismiss tutorial"
            className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            ✕
          </button>

          <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            Getting Started
          </h2>
          <p className="text-gray-600 dark:text-slate-500">
            New to PaySphere? Watch this quick tutorial to learn how to navigate
            the application and get started.
          </p>

          <a
            href="https://youtu.be/N3SizOsiNGw"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            ▶ Watch Tutorial
          </a>
        </div>
      )}

      {/* Search + Export Roster */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Employee Directory
        </h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:border-blue-500 outline-none transition-colors"
          />

          <button
            type="button"
            disabled={loading || filtered.length === 0}
            onClick={() =>
              exportEmployeesToCsv(filtered, {
                companyName: localStorage.getItem('companyName') || 'PaySphere',
              })
            }
            title={
              filtered.length === 0
                ? 'No employees to export'
                : `Export ${filtered.length} employee${filtered.length === 1 ? '' : 's'} to CSV`
            }
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-lg text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
          >
            <DownloadIcon sx={{ fontSize: 18 }} />
            Export Roster
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <EmployeeCardSkeleton key={i} />
          ))
        ) : filtered.length === 0 && !search ? (
          <EmptyState
            title="No employees yet"
            description="Add your first employee to get started with payroll."
            action={
              <button
                onClick={onAddEmployee}
                className="px-6 py-2.5 bg-blue-600 cursor-pointer hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                + Add Employee
              </button>
            }
          />
        ) : filtered.length === 0 && search ? (
          <EmptyState
            title="No employees found"
            description={`No employees match "${search}". Try a different name or role.`}
          />
        ) : (
          filtered.map((emp) => (
            <EmployeeCard
              key={emp._id}
              emp={emp}
              payroll={payrollMap[emp._id]}
              variant="overview"
              onAddUpdate={onAddUpdate}
              onEdit={() => onEditEmployee(emp)}
            />
          ))
        )}

        {!loading && (filtered.length > 0 || search) && (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
            onClick={onAddEmployee}
            className="border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-44 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition duration-200"
          >
            <p className="text-gray-500 dark:text-slate-500 font-semibold">
              + Add Employee
            </p>
          </div>
        )}
      </div>
    </main>
  );
};

// --- Employee Management Component ---
const EmployeeManagement = ({
  employees,
  loading,
  onAddEmployee,
  onAddUpdate,
  payrolls,
  currentPage,
  totalPages,
  setCurrentPage,
  onDeleteEmployee,
  onEditEmployee,
}) => {
  const payrollMap = {};
  (payrolls || []).forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const totalNet = employees.reduce((s, e) => {
    const p = payrollMap[e._id];
    return s + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  return (
    <main className="p-4 sm:p-8">
      {/* Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center mb-8 gap-6 transition-colors duration-200">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50 mb-4">
            Payroll done in 30 seconds
          </span>
          <p className="text-sm text-gray-500 dark:text-slate-500 mb-1">
            Final Summary
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-gray-900 dark:text-white mb-2">
            ₹{totalNet.toLocaleString('en-IN')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-500">
            Total Monthly Payout for{' '}
            <span className="text-gray-700 dark:text-slate-200 font-semibold">
              {employees.length} Employee{employees.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={onAddUpdate}
            className="flex-1 sm:flex-none cursor-pointer px-5 py-3 border border-gray-200 dark:border-slate-800 rounded-xl font-semibold text-gray-700 dark:text-slate-200 hover:shadow dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Edit Updates
          </button>
          <button
            className="flex-1 sm:flex-none cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            onClick={() =>
              api
                .post('/api/payroll/submit', {
                  activities: [],
                  month: new Date().getMonth() + 1,
                  year: new Date().getFullYear(),
                })
                .then(() => alert('Submitted!'))
                .catch(console.error)
            }
          >
            Submit for Review
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <EmployeeBreakdownSkeleton key={i} />
          ))
        ) : employees.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Add employees to see their salary breakdown here."
            action={
              <button
                onClick={onAddEmployee}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-blue-200 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                + Add Employee
              </button>
            }
          />
        ) : (
          employees.map((emp) => (
            <EmployeeCard
              key={emp._id}
              emp={emp}
              payroll={payrollMap[emp._id]}
              variant="breakdown"
              onDeleteEmployee={onDeleteEmployee}
              onEdit={() => onEditEmployee(emp)}
            />
          ))
        )}

        {!loading && employees.length > 0 && (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && e.target.click()}
            onClick={onAddEmployee}
            className="border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-48 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition duration-200"
          >
            <p className="text-gray-500 dark:text-slate-500 font-semibold">
              + Add more employees
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
};

// --- Edit Employee Modal Component ---
const EditEmployeeModal = ({ employee, onClose, onSave }) => {
  const formRef = useRef(null);
  useCtrlEnterSubmit(formRef);
  const [formData, setFormData] = useState({
    fullName: employee?.fullName || '',
    role: employee?.role || '',
    monthlySalary: employee?.monthlySalary || '',
    overtimeRate: employee?.overtimeRate || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const salary = Number(formData.monthlySalary);
    const otRate = Number(formData.overtimeRate);

    // Validation Check (Step 5)
    if (salary <= 0) {
      return setError('Monthly salary must be a positive number.');
    }
    if (otRate < 0) {
      return setError('Overtime rate cannot be negative.');
    }

    try {
      setSubmitting(true);
      await onSave(employee._id, {
        fullName: formData.fullName,
        role: formData.role,
        monthlySalary: salary,
        overtimeRate: otRate,
      });
    } catch {
      setError('Failed to update employee details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Edit Employee
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              required
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Role
            </label>
            <input
              required
              type="text"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Monthly Salary (₹)
              </label>
              <input
                required
                type="number"
                name="monthlySalary"
                min="1"
                value={formData.monthlySalary}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Overtime Rate (₹)
              </label>
              <input
                required
                type="number"
                name="overtimeRate"
                min="0"
                value={formData.overtimeRate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Payroll Table Component ---
const PayrollTable = ({
  payrolls,
  loading,
  currentPage,
  totalPages,
  totalCount,
  setCurrentPage,
}) => {
  const PAYROLL_LIMIT = 10;
  const startIdx = (currentPage - 1) * PAYROLL_LIMIT + 1;
  const endIdx = Math.min(currentPage * PAYROLL_LIMIT, totalCount);

  const STATUS_STYLE = {
    pending_approval: 'bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800/40',
    approved: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/40',
    paid: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/40',
    rejected: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/40',
    finalized: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/40',
  };

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const formatStatus = (s) => {
    if (!s) return 'Unknown';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <main className="p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Payroll History</h1>
          {!loading && totalCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
              Showing {startIdx}–{endIdx} of {totalCount} record{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="hidden sm:grid grid-cols-5 px-6 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
          <span>Employee</span>
          <span className="text-center">Period</span>
          <span className="text-right">Base Salary</span>
          <span className="text-right">Net Salary</span>
          <span className="text-center">Status</span>
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2" />
            </div>
          ))
        ) : payrolls.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-gray-500 dark:text-slate-500 text-sm">No payroll records found for this month.</p>
            <p className="text-gray-400 dark:text-slate-600 text-xs mt-1">Run payroll from Monthly Updates to see records here.</p>
          </div>
        ) : (
          payrolls.map((p) => (
            <div key={p._id} className="grid grid-cols-1 sm:grid-cols-5 px-6 py-4 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors items-center gap-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{p.employeeName}</p>
              </div>
              <div className="text-center text-sm text-gray-600 dark:text-slate-400">
                {MONTH_NAMES[(p.month || 1) - 1]} {p.year}
              </div>
              <div className="text-right text-sm text-gray-700 dark:text-slate-300">
                ₹{(p.baseSalary || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-right font-bold text-sm text-slate-900 dark:text-white">
                ₹{(p.netSalary || 0).toLocaleString('en-IN')}
              </div>
              <div className="flex sm:justify-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[p.status] || STATUS_STYLE['finalized']}`}>
                  {formatStatus(p.status)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm font-semibold disabled:opacity-50 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
};

export default function PaySphereDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activePage, setActivePage] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [payrolls, setPayrolls] = useState([]);

  // Payroll-summary pagination state
  const [payrollPage, setPayrollPage] = useState(1);
  const [payrollTotalPages, setPayrollTotalPages] = useState(1);
  const [payrollTotalCount, setPayrollTotalCount] = useState(0);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [paginatedPayrolls, setPaginatedPayrolls] = useState([]);

  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [employeeToEdit, setEmployeeToEdit] = useState(null);
  const [prevDebouncedSearch, setPrevDebouncedSearch] =
    useState(debouncedSearch);
  const companyName = localStorage.getItem('companyName') || 'Acme Corp';
  const token = useSelector((state) => state.auth.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const qParam = searchParams.get('q');

  // Deep-link support: /dashboard?tab=employees&q=Rahul lets the command
  // palette (Cmd+K) jump straight to a tab and pre-fill the search box.
  useEffect(() => {
    const TAB_IDS = ['Dashboard', 'Employees', 'Payroll', 'Approvals', 'Loans'];
    const targetTab = TAB_IDS.find(
      (id) => id.toLowerCase() === (tabParam || '').toLowerCase(),
    );

    if (targetTab) setActivePage(targetTab);

    if (qParam) {
      setSearch(qParam);
      // Consume the q param so it does not re-apply on the next mount.
      if (targetTab) setSearchParams({ tab: targetTab }, { replace: true });
    }
  }, [tabParam, qParam, setActivePage, setSearch, setSearchParams]);

  useEffect(() => {
    if (!token) {
      navigate('/auth');
    }
  }, [token, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when the search term changes (adjusted during render, not in an effect)
  if (debouncedSearch !== prevDebouncedSearch) {
    setPrevDebouncedSearch(debouncedSearch);
    setCurrentPage(1);
  }
  useEffect(() => {
    const fetchData = async () => {
      try {
        const searchParam = debouncedSearch
          ? `&search=${encodeURIComponent(debouncedSearch)}`
          : '';
        const [empRes, payRes] = await Promise.all([
          api.get(`/api/employees?page=${currentPage}&limit=10${searchParam}`),
          api.get(`/api/payroll/summary?limit=0`),
        ]);

        setEmployees(empRes.data.employees);
        setTotalPages(empRes.data.totalPages);
        setTotalEmployees(empRes.data.totalEmployees || 0);
        setPayrolls(payRes.data.payrolls || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
    else setTimeout(() => setLoading(false), 0);
  }, [token, currentPage, debouncedSearch]);

  // Fetch paginated payroll records when viewing the Payroll tab
  useEffect(() => {
    if (!token) return;
    const fetchPayrollPage = async () => {
      setPayrollLoading(true);
      try {
        const res = await api.get(`/api/payroll/summary?page=${payrollPage}&limit=10`);
        setPaginatedPayrolls(res.data.payrolls || []);
        setPayrollTotalPages(res.data.totalPages || 1);
        setPayrollTotalCount(res.data.totalCount || 0);
      } catch (err) {
        console.error('Failed to fetch payroll page:', err);
      } finally {
        setPayrollLoading(false);
      }
    };
    fetchPayrollPage();
  }, [token, payrollPage]);

  const payrollMap = {};
  payrolls.forEach((p) => {
    payrollMap[p.employeeId] = p;
  });

  const totalPayout = employees.reduce((sum, e) => {
    const p = payrollMap[e._id];
    return sum + (p ? p.netSalary : e.monthlySalary || 0);
  }, 0);

  const filtered = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (e.role || '').toLowerCase().includes(search.toLowerCase()),
  );

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setDeleting(true);

      await api.delete(`/api/employees/${employeeToDelete._id}`);

      setEmployees((prev) =>
        prev.filter((emp) => emp._id !== employeeToDelete._id),
      );

      setPayrolls((prev) =>
        prev.filter((p) => p.employeeId !== employeeToDelete._id),
      );

      setEmployeeToDelete(null);
    } catch (error) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.message || 'Failed to delete employee');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSubmit = async (id, updatedData) => {
    try {
      await api.put(`/api/employees/${id}`, updatedData);

      setEmployees((prev) =>
        prev.map((emp) => (emp._id === id ? { ...emp, ...updatedData } : emp)),
      );
      setEmployeeToEdit(null);
    } catch (error) {
      console.error('Failed to update employee:', error);
      alert('Failed to update employee. Please try again.');
    }
  };

  const getInitials = (name) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex font-sans text-slate-800 dark:text-slate-200 transition-colors duration-200">
      <Helmet>
        <title>
          {activePage === 'Dashboard'
            ? 'Payroll Dashboard | PaySphere'
            : 'Employee Management | PaySphere'}
        </title>
        <meta
          name="description"
          content={`Manage ${companyName}'s payroll and employees with ease.`}
        />
      </Helmet>

      {/* Sidebar */}
      <Sidebar
        companyName={companyName}
        activePage={activePage}
        setActivePage={(page) => {
          if (page === 'Reports') {
            navigate('/reports');
          } else {
            setActivePage(page);
          }
        }}
        isSidebarOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-56 transition-all duration-300">
        {/* Topbar */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              className="md:hidden p-2 -ml-2 text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              onClick={() => setIsSidebarOpen(true)}
            >
              ☰
            </button>
            <span className="font-bold text-blue-900 dark:text-blue-400 truncate">
              Ledger Payroll
            </span>
            <button className="hidden sm:block text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-blue-600 dark:border-blue-400 pb-0.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
              {new Date().toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-500">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {getInitials(companyName)}
            </div>
            <button
              onClick={() => {
                dispatch(logout());
                localStorage.removeItem('companyName');
                navigate('/');
              }}
              className="px-3 py-1.5 cursor-pointer text-sm font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        {activePage === 'Approvals' ? (
          <Approvals />
        ) : activePage === 'Settlements' ? (
          <Settlements />
        ) : activePage === 'Loans' ? (
          <Loans />
        ) : activePage === 'Payroll' ? (
          <PayrollTable
            payrolls={paginatedPayrolls}
            loading={payrollLoading}
            currentPage={payrollPage}
            totalPages={payrollTotalPages}
            totalCount={payrollTotalCount}
            setCurrentPage={setPayrollPage}
          />
        ) : activePage === 'Dashboard' ? (
          <DashboardOverview
            search={search}
            setSearch={setSearch}
            filtered={filtered}
            navigate={navigate}
            onAddUpdate={() => navigate('/monthly-updates')}
            onAddEmployee={() => navigate('/add-employee')}
            totalPayout={totalPayout}
            employeeCount={totalEmployees}
            loading={loading}
            payrolls={payrolls}
            onEditEmployee={(emp) => setEmployeeToEdit(emp)}
          />
        ) : (
          <EmployeeManagement
            search={search}
            setSearch={setSearch}
            employees={employees}
            loading={loading}
            onAddEmployee={() => navigate('/add-employee')}
            onAddUpdate={() => navigate('/monthly-updates')}
            payrolls={payrolls}
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            onDeleteEmployee={(emp) => setEmployeeToDelete(emp)}
            onEditEmployee={(emp) => setEmployeeToEdit(emp)}
          />
        )}

        {/* Edit Form Modal (Steps 2-5) */}
        {employeeToEdit && (
          <EditEmployeeModal
            employee={employeeToEdit}
            onClose={() => setEmployeeToEdit(null)}
            onSave={handleEditSubmit}
          />
        )}

        {/* Delete Confirmation Modal */}
        {employeeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-96 shadow-xl border border-gray-200 dark:border-slate-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Delete Employee?
              </h2>

              <p className="mt-3 text-gray-600 dark:text-slate-500">
                Are you sure you want to delete{' '}
                <span className="font-semibold">
                  {employeeToDelete.fullName}
                </span>
                ?
                <br />
                Payroll records will also be deleted.
              </p>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEmployeeToDelete(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  disabled={deleting}
                  onClick={handleDeleteEmployee}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings modal (extracted component).
          Kept for future use; not wired to a trigger today, so
          no visual change occurs. */}
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      >
        <p className="text-sm text-gray-500 dark:text-slate-500">
          Settings will be available here soon.
        </p>
      </SettingsModal>
    </div>
  );
}
